import { NextResponse, type NextRequest } from "next/server";

import { runAllAuditChecks } from "@/lib/audit/checks";
import type { Json } from "@/lib/database/types";
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

  const { leadId } = await context.params;
  const supabase = createSupabaseServiceClient();

  // Get lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,known_website,seed_source_url")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return jsonError("Lead not found.", 404);
  }

  const websiteUrl = lead.known_website ?? lead.seed_source_url;

  // Try to get the most recent source snapshot for raw HTML
  let rawHtml: string | null = null;
  let httpStatus: number | null = null;

  if (websiteUrl) {
    const { data: source } = await supabase
      .from("sources")
      .select("raw_text,http_status")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    rawHtml = source?.raw_text ?? null;
    httpStatus = source?.http_status ?? null;
  }

  // Run audit checks
  const auditResult = runAllAuditChecks({
    websiteUrl,
    httpStatus,
    rawHtml,
  });

  // Generate a run ID
  const auditRunId = `audit-${Date.now()}`;

  // Calculate gap score from checks
  const { computeDigitalGapScore } = await import("@/lib/audit/score");
  const gapResult = computeDigitalGapScore(auditResult.checks);

  // Save audit result
  const { data: audit, error: auditError } = await supabase
    .from("website_audits")
    .insert({
      lead_id: leadId,
      audit_run_id: auditRunId,
      website_url: websiteUrl,
      checks: auditResult.checks as unknown as Json,
      digital_gap_score: gapResult.score,
      commercial_fit_score: 0, // Will be computed in score step
      score_breakdown: gapResult.breakdown as unknown as Json,
    })
    .select()
    .single();

  if (auditError) {
    return jsonError(`Failed to save audit: ${auditError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    audit,
    checks: auditResult.checks,
    digitalGapScore: gapResult.score,
  });
}
