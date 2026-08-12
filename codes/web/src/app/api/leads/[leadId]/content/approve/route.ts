import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { Json } from "@/lib/database/types";
import { validateClaims } from "@/lib/content/claim-validator";
import { validateKannada } from "@/lib/content/kannada-validator";
import { evaluateApproval } from "@/lib/content/content-workflow";
import type { GeneratedContent } from "@/lib/content/content-schema";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const approveRequestSchema = z.object({
  stage: z.enum(["EN", "KN"]),
  reviewer: z.string().trim().min(1).default("local-admin"),
});

function jsonError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, message, ...(extra ? { issues: extra } : {}) },
    { status },
  );
}

/**
 * POST /api/leads/[leadId]/content/approve  { stage: "EN" | "KN" }
 *
 * The explicit human approval gate (P0-4). Approval is only granted after the
 * content re-passes deterministic validation, and the approving reviewer + time
 * are recorded.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError("Supabase is not configured.", 503);
  }

  const { leadId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = approveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid approval request.", 422, parsed.error.issues);
  }
  const { stage, reviewer } = parsed.data;

  const supabase = createSupabaseServiceClient();

  const { data: contentRow, error: contentError } = await supabase
    .from("generated_content")
    .select("id,content_en,content_kn,status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (contentError || !contentRow) {
    return jsonError("No generated content found. Generate first.", 404);
  }
  if (!contentRow.content_en) {
    return jsonError("English content is empty.", 422);
  }

  const { data: verifiedFacts } = await supabase
    .from("hospital_facts")
    .select("id,fact_type,value,source_excerpt")
    .eq("lead_id", leadId)
    .eq("verification_status", "VERIFIED");

  const facts = verifiedFacts ?? [];
  const verifiedIds = facts.map((f) => f.id);
  const english = contentRow.content_en as unknown as GeneratedContent;
  const kannada = contentRow.content_kn
    ? (contentRow.content_kn as unknown as GeneratedContent)
    : null;

  // Re-validate both languages, then let the pure gate decide the transition.
  const enValidation = validateClaims(english, facts);
  const knValidation = kannada
    ? validateKannada(english, kannada, verifiedIds)
    : { valid: true, issues: [] };

  const decision = evaluateApproval({
    stage,
    status: contentRow.status,
    hasKannada: Boolean(kannada),
    englishValid: enValidation.valid,
    kannadaValid: knValidation.valid,
  });

  if (!decision.ok) {
    // Persist BLOCKED when the failure was a validation failure (not a
    // missing-translation / wrong-state condition).
    const validationFailed =
      !enValidation.valid || (stage === "KN" && Boolean(kannada) && !knValidation.valid);
    if (validationFailed) {
      await supabase
        .from("generated_content")
        .update({
          status: "BLOCKED",
          validation_report: {
            english: enValidation,
            kannada: knValidation,
          } as unknown as Json,
        })
        .eq("id", contentRow.id);
    }
    return jsonError(decision.reason, decision.code, [
      ...enValidation.issues,
      ...knValidation.issues,
    ]);
  }

  const now = new Date().toISOString();
  const update =
    decision.nextStatus === "EN_APPROVED"
      ? { status: "EN_APPROVED" as const, en_approved_by: reviewer, en_approved_at: now }
      : { status: "KN_APPROVED" as const, kn_approved_by: reviewer, kn_approved_at: now };

  const { error } = await supabase
    .from("generated_content")
    .update(update)
    .eq("id", contentRow.id);
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, stage, status: decision.nextStatus });
}
