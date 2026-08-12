import { NextResponse, type NextRequest } from "next/server";

import { isLlmConfigured } from "@/lib/ai/client";
import { generateOutreachDraft } from "@/lib/outreach/draft";
import { runJobWithTracking } from "@/lib/jobs/runner";
import type { AuditCheckResult } from "@/lib/audit/checks";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * POST /api/leads/[leadId]/outreach
 *
 * Generates outreach DRAFTS only (email subject/body + WhatsApp message). It
 * never sends anything — a human copies and sends manually (SCOPE_RULES).
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

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id,hospital_name,city,digital_gap_score,commercial_fit_score",
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return jsonError("Lead not found.", 404);
  }

  // Latest preview (to share) and audit (to derive gap highlights).
  const [{ data: preview }, { data: audit }] = await Promise.all([
    supabase
      .from("previews")
      .select("slug,status")
      .eq("lead_id", leadId)
      .neq("status", "REMOVED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("website_audits")
      .select("checks")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const checks = (audit?.checks as AuditCheckResult[] | null) ?? [];
  const gapHighlights = checks
    .filter((c) => !c.passed)
    .map((c) => c.label)
    .slice(0, 5);

  const previewUrl = preview?.slug ? `/preview/${preview.slug}` : null;

  try {
    const { result: draft } = await runJobWithTracking({
      leadId,
      jobType: "generateOutreachDraft",
      execute: async () => {
        const llmResult = await generateOutreachDraft({
          lead: {
            hospitalName: lead.hospital_name,
            city: lead.city,
            contactName: null,
            digitalGapScore: lead.digital_gap_score ?? 0,
            commercialFitScore: lead.commercial_fit_score ?? 0,
            previewUrl,
            gapHighlights,
          },
        });
        return { result: llmResult.data, usage: llmResult.usage };
      },
    });

    return NextResponse.json({ ok: true, draft, previewUrl });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Outreach generation failed.",
      500,
    );
  }
}
