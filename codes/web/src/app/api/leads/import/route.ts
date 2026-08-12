import { NextResponse, type NextRequest } from "next/server";

import { buildLeadInsertPayloads, parseLeadCsv } from "@/lib/leads/import-csv";
import {
  domainOf,
  findPossibleDuplicates,
} from "@/lib/leads/duplicate-detection";
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

  // Cross-import fuzzy duplicate detection: compare each incoming row against
  // existing leads on name/city/phone/domain. Exact re-imports are skipped by
  // the unique import_fingerprint; fuzzy matches are FLAGGED (duplicate_of +
  // duplicate_group), never auto-merged, so a human can decide.
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id,normalized_name,normalized_city,known_phone,known_website");

  const existing = (existingLeads ?? []).map((l) => ({
    id: l.id,
    normalizedName: l.normalized_name,
    normalizedCity: l.normalized_city,
    knownPhone: l.known_phone,
    domain: domainOf(l.known_website),
  }));

  const possibleDuplicates: Array<{
    hospital_name: string;
    matches: ReturnType<typeof findPossibleDuplicates>;
  }> = [];

  parsed.records.forEach((record, i) => {
    const matches = findPossibleDuplicates(
      {
        normalizedName: record.normalizedName,
        normalizedCity: record.normalizedCity,
        knownPhone: record.knownPhone,
        domain: domainOf(record.knownWebsite),
      },
      existing,
    );
    if (matches.length > 0) {
      const strong = matches.find((m) => m.confidence === "strong");
      payload[i].duplicate_of = strong?.leadId ?? null;
      payload[i].duplicate_group =
        payload[i].duplicate_group ??
        (strong ? "possible-duplicate" : "possible-duplicate-weak");
      possibleDuplicates.push({ hospital_name: record.hospitalName, matches });
    }
  });

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, {
      onConflict: "import_fingerprint",
      ignoreDuplicates: true,
    })
    .select("id,hospital_name,status,duplicate_group");

  if (error) {
    return jsonError(error.message, 500);
  }

  const inserted = data?.length ?? 0;
  return NextResponse.json({
    ok: true,
    dryRun: false,
    parsed,
    inserted,
    skippedDuplicates: payload.length - inserted,
    possibleDuplicates,
    leads: data ?? [],
  });
}
