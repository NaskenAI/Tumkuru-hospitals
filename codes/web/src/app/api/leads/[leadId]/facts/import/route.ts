import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { buildHospitalFactPayloads } from "@/lib/extraction/facts";
import { parseExtractionOutput } from "@/lib/extraction/schema";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const importExtractionRequestSchema = z.object({
  sourceId: z.string().uuid().optional(),
  extraction: z.unknown(),
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(
      "Supabase is not configured. Fill .env.local and run the migration first.",
      503,
    );
  }

  const { leadId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsedRequest = importExtractionRequestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid extraction import request.",
        issues: parsedRequest.error.issues,
      },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const source =
    parsedRequest.data.sourceId != null
      ? await getSourceById(supabase, parsedRequest.data.sourceId)
      : await getLatestSource(supabase, leadId);

  if (!source) {
    return jsonError("No source snapshot found for this lead.", 404);
  }

  try {
    const extraction = parseExtractionOutput(parsedRequest.data.extraction);
    const { payloads, rejected } = buildHospitalFactPayloads({
      leadId,
      sourceId: source.id,
      extraction,
      sourceText: source.raw_text,
    });

    if (payloads.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        rejected,
        message:
          rejected.length > 0
            ? "All facts were rejected: excerpts not found in source text."
            : "Extraction contained no facts.",
      });
    }

    const { data, error } = await supabase
      .from("hospital_facts")
      .insert(payloads)
      .select("id,fact_type,risk_tier,verification_status");

    if (error) {
      return jsonError(error.message, 500);
    }

    await supabase
      .from("leads")
      .update({ status: "REVIEW_REQUIRED" })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      inserted: data?.length ?? 0,
      rejected,
      facts: data ?? [],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Extraction validation failed.",
      422,
    );
  }
}

type SourceRef = { id: string; raw_text: string | null };

async function getSourceById(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  sourceId: string,
): Promise<SourceRef | null> {
  const { data, error } = await supabase
    .from("sources")
    .select("id,raw_text")
    .eq("id", sourceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function getLatestSource(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  leadId: string,
): Promise<SourceRef | null> {
  const { data, error } = await supabase
    .from("sources")
    .select("id,raw_text")
    .eq("lead_id", leadId)
    .order("retrieved_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}
