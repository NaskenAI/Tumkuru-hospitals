import { NextResponse, type NextRequest } from "next/server";

import { computeAllScores } from "@/lib/audit/score";
import type { Json } from "@/lib/database/types";
import type { AuditCheckResult } from "@/lib/audit/checks";
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

  // Get latest audit checks
  const { data: audit } = await supabase
    .from("website_audits")
    .select("checks")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const auditChecks: AuditCheckResult[] = (audit?.checks as AuditCheckResult[] | null) ?? [];

  // Get verified facts
  const { data: facts } = await supabase
    .from("hospital_facts")
    .select("fact_type,value,risk_tier,verification_status")
    .eq("lead_id", leadId);

  // Compute scores
  const scores = computeAllScores({
    auditChecks,
    facts: facts ?? [],
  });

  // Update lead with scores
  const { error: updateError } = await supabase
    .from("leads")
    .update({
      digital_gap_score: scores.digitalGapScore,
      commercial_fit_score: scores.commercialFitScore,
      score_breakdown: scores.breakdown as unknown as Json,
    })
    .eq("id", leadId);

  if (updateError) {
    return jsonError(`Failed to update scores: ${updateError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    scores,
  });
}
