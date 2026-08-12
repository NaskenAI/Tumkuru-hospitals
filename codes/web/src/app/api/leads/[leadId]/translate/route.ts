import { NextResponse, type NextRequest } from "next/server";

import { isLlmConfigured } from "@/lib/ai/client";
import type { Json } from "@/lib/database/types";
import { translateToKannada } from "@/lib/content/translate-kannada";
import type { GeneratedContent } from "@/lib/content/content-schema";
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

  // Get latest English content
  const { data: contentRow, error: contentError } = await supabase
    .from("generated_content")
    .select("id,content_en,status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (contentError || !contentRow) {
    return jsonError("No generated content found. Generate English content first.", 404);
  }

  if (!contentRow.content_en) {
    return jsonError("English content is empty.", 422);
  }

  // Gate: English must be human-approved before we spend tokens translating it.
  if (contentRow.status !== "EN_APPROVED" && contentRow.status !== "KN_REVIEW_REQUIRED" && contentRow.status !== "KN_APPROVED") {
    return jsonError(
      `English content must be approved before translation (current status: ${contentRow.status}).`,
      409,
    );
  }

  const englishContent = contentRow.content_en as unknown as GeneratedContent;

  // Translate with job tracking
  const { result: kannadaContent } = await runJobWithTracking({
    leadId,
    jobType: "translateContent",
    execute: async () => {
      const llmResult = await translateToKannada({
        content: englishContent,
      });
      return { result: llmResult.data, usage: llmResult.usage };
    },
  });

  // Update the content row with Kannada
  const { error: updateError } = await supabase
    .from("generated_content")
    .update({
      content_kn: kannadaContent as unknown as Json,
      status: "KN_REVIEW_REQUIRED",
    })
    .eq("id", contentRow.id);

  if (updateError) {
    return jsonError(`Failed to save translation: ${updateError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    contentId: contentRow.id,
    kannadaContent,
  });
}
