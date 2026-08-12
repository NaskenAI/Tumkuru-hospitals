import { NextResponse, type NextRequest } from "next/server";

import { extractHospitalFacts } from "@/lib/ai/extract";
import { filterNewFactPayloads } from "@/lib/extraction/facts";
import { isLlmConfigured } from "@/lib/ai/client";
import { runJobWithTracking } from "@/lib/jobs/runner";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * POST /api/leads/[leadId]/extract
 *
 * Runs LLM extraction on the latest source text for a lead.
 * Creates hospital_facts rows from the extraction output.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError("Supabase is not configured.", 503);
  }
  if (!isLlmConfigured()) {
    return jsonError("LLM_API_KEY is not set.", 503);
  }

  const { leadId } = await context.params;
  const supabase = createSupabaseServiceClient();

  // Get the latest source with raw text
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id,raw_text,http_status")
    .eq("lead_id", leadId)
    .not("raw_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sourceError || !source || !source.raw_text) {
    return jsonError(
      "No source text found. Collect a source first.",
      404,
    );
  }

  // Do not extract facts from an error page (non-2xx response).
  if (source.http_status !== null && source.http_status >= 400) {
    return jsonError(
      `Latest source returned HTTP ${source.http_status}; re-collect a healthy source before extracting.`,
      422,
    );
  }

  // Run extraction with job tracking
  const { result } = await runJobWithTracking({
    leadId,
    jobType: "extractFacts",
    execute: async () => {
      const extractionResult = await extractHospitalFacts({
        sourceText: source.raw_text!,
        leadId,
        sourceId: source.id,
      });
      return { result: extractionResult, usage: extractionResult.usage };
    },
  });

  // Idempotency: skip facts already stored for this source (same fact_type +
  // excerpt) so re-running extraction never duplicates rows or clobbers a
  // human's verify/reject decision on an existing fact.
  const { data: existingFacts } = await supabase
    .from("hospital_facts")
    .select("fact_type,source_excerpt")
    .eq("lead_id", leadId)
    .eq("source_id", source.id);

  const newPayloads = filterNewFactPayloads(
    existingFacts ?? [],
    result.factPayloads,
  );
  const skippedExisting = result.factPayloads.length - newPayloads.length;

  // Insert facts
  if (newPayloads.length > 0) {
    const { error: insertError } = await supabase
      .from("hospital_facts")
      .insert(newPayloads);

    if (insertError) {
      return jsonError(`Failed to save facts: ${insertError.message}`, 500);
    }
  }

  // Update lead status
  await supabase
    .from("leads")
    .update({ status: "REVIEW_REQUIRED" })
    .eq("id", leadId);

  return NextResponse.json({
    ok: true,
    factsExtracted: newPayloads.length,
    factsSkippedExisting: skippedExisting,
    factsRejected: result.rejectedFacts.length,
    rejectedFacts: result.rejectedFacts,
    usage: result.usage,
  });
}
