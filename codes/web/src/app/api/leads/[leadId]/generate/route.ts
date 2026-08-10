import { NextResponse, type NextRequest } from "next/server";

import { isLlmConfigured } from "@/lib/ai/client";
import type { Json } from "@/lib/database/types";
import { generateEnglishContent } from "@/lib/content/generate-english";
import { countFactTypes, selectTemplate } from "@/lib/content/template-selector";
import { validateClaims } from "@/lib/content/claim-validator";
import { runJobWithTracking } from "@/lib/jobs/runner";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

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

  // Get verified facts only
  const { data: facts, error: factsError } = await supabase
    .from("hospital_facts")
    .select("id,fact_type,value,source_excerpt,verification_status")
    .eq("lead_id", leadId)
    .eq("verification_status", "VERIFIED");

  if (factsError) {
    return jsonError(`Failed to get facts: ${factsError.message}`, 500);
  }

  if (!facts || facts.length === 0) {
    return jsonError(
      "No verified facts found. Verify at least one fact before generating.",
      422,
    );
  }

  // Select template
  const factCounts = countFactTypes(facts);
  const templateKey = selectTemplate(factCounts);

  // Generate content with job tracking
  const { result } = await runJobWithTracking({
    leadId,
    jobType: "generateContent",
    execute: async () => {
      const llmResult = await generateEnglishContent({
        templateKey,
        facts,
      });
      return { result: llmResult.data, usage: llmResult.usage };
    },
  });

  // Validate claims
  const verifiedFactIds = facts.map((f) => f.id);
  const validation = validateClaims(result, verifiedFactIds);

  const contentStatus = validation.valid ? "EN_REVIEW_REQUIRED" : "BLOCKED";

  // Save generated content
  const { data: content, error: contentError } = await supabase
    .from("generated_content")
    .insert({
      lead_id: leadId,
      template_key: templateKey,
      content_en: result as unknown as Json,
      status: contentStatus,
      validation_report: validation as unknown as Json,
    })
    .select()
    .single();

  if (contentError) {
    return jsonError(`Failed to save content: ${contentError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    templateKey,
    content,
    validation,
  });
}
