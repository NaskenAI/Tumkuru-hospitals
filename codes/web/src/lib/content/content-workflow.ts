/**
 * Pure content state-machine gates (P0-4 / P0-9).
 *
 * The deploy and approve API routes delegate their allow/deny decisions to
 * these functions so the gate logic is unit-testable without a database.
 */

import type { ContentStatus } from "@/lib/database/types";

export type GateResult =
  | { ok: true }
  | { ok: false; code: number; reason: string };

/**
 * Status + presence gate, evaluated BEFORE running validation. Only fully
 * human-approved bilingual content is eligible to deploy.
 */
// KN_APPROVED = ready to deploy; VALIDATED = already deployed (re-deploy is
// idempotent and re-validates, so it is allowed and reuses the live preview).
const DEPLOYABLE_STATUSES = new Set<ContentStatus>(["KN_APPROVED", "VALIDATED"]);

export function evaluateDeployState(input: {
  status: ContentStatus;
  hasEnglish: boolean;
  hasKannada: boolean;
}): GateResult {
  if (!DEPLOYABLE_STATUSES.has(input.status)) {
    return {
      ok: false,
      code: 409,
      reason: `Preview is not approved for deployment (status: ${input.status}). English and Kannada must both be human-approved first.`,
    };
  }
  if (!input.hasEnglish || !input.hasKannada) {
    return {
      ok: false,
      code: 422,
      reason: "Both English and Kannada content are required to deploy.",
    };
  }
  return { ok: true };
}

/** Final validation gate, evaluated after re-running claim/Kannada validation. */
export function evaluateDeployValidation(input: {
  englishValid: boolean;
  kannadaValid: boolean;
}): GateResult {
  if (!input.englishValid || !input.kannadaValid) {
    return {
      ok: false,
      code: 422,
      reason: "Claim validation failed; preview blocked.",
    };
  }
  return { ok: true };
}

/**
 * Approval transition gate. Returns the next status on success.
 */
export function evaluateApproval(input: {
  stage: "EN" | "KN";
  status: ContentStatus;
  hasKannada: boolean;
  englishValid: boolean;
  kannadaValid: boolean;
}):
  | { ok: true; nextStatus: ContentStatus }
  | { ok: false; code: number; reason: string } {
  if (input.status === "BLOCKED") {
    return {
      ok: false,
      code: 409,
      reason: "Content is blocked; regenerate before approving.",
    };
  }
  if (!input.englishValid) {
    return {
      ok: false,
      code: 422,
      reason: "English claim validation failed. Cannot approve.",
    };
  }

  if (input.stage === "EN") {
    return { ok: true, nextStatus: "EN_APPROVED" };
  }

  // stage === "KN"
  if (!input.hasKannada) {
    return {
      ok: false,
      code: 422,
      reason: "No Kannada content. Approve English and run translation first.",
    };
  }
  if (!input.kannadaValid) {
    return {
      ok: false,
      code: 422,
      reason: "Kannada validation failed. Cannot approve.",
    };
  }
  return { ok: true, nextStatus: "KN_APPROVED" };
}
