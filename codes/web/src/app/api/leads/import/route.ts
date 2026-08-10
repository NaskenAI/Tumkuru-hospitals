import { NextResponse, type NextRequest } from "next/server";

import { buildLeadInsertPayloads, parseLeadCsv } from "@/lib/leads/import-csv";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "0";
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a CSV file in the file field.");
  }

  const csvText = await file.text();
  const parsed = parseLeadCsv(csvText);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      parsed,
      inserted: 0,
    });
  }

  if (!isSupabaseConfigured()) {
    return jsonError(
      "Supabase is not configured. Fill .env.local, run the migration, then import again.",
      503,
    );
  }

  if (parsed.issues.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        parsed,
        inserted: 0,
        message: "Fix CSV validation issues before importing.",
      },
      { status: 422 },
    );
  }

  const payload = buildLeadInsertPayloads(parsed.records);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select("id,hospital_name,status,duplicate_group");

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    parsed,
    inserted: data?.length ?? 0,
    leads: data ?? [],
  });
}
