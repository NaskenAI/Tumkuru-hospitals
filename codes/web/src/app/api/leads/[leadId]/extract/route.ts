import { NextResponse, type NextRequest } from "next/server";

import { extractHospitalFacts } from "@/lib/ai/extract";
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
    .select("id,raw_text")
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

  // Insert facts
  if (result.factPayloads.length > 0) {
    const { error: insertError } = await supabase
      .from("hospital_facts")
      .insert(result.factPayloads);

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
    factsExtracted: result.factPayloads.length,
    usage: result.usage,
  });
}
