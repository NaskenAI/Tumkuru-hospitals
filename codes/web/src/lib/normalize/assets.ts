/**
 * Asset approval state machine (Section 16) + classification mapping.
 *
 * DISCOVERED      exists, no policy applied yet.
 * AUTO_APPROVED   safe, non-attributive use (logo, exterior, interior, render,
 *                 generic decor) — makes no claim about a person/capability.
 * REVIEW_REQUIRED attributive/sensitive (doctor portrait, named facility,
 *                 equipment implying capability, insurer mark) — needs a human.
 * HUMAN_APPROVED  a reviewer approved the specific association/use.
 * REJECTED        must never be rendered publicly.
 *
 * This is the app-level model. The existing hospital_assets table keeps its
 * PENDING/APPROVED/REJECTED column (untouched to avoid frontend ripple); the
 * documented mapping is: DISCOVERED→(pre-policy), AUTO_APPROVED↔APPROVED,
 * REVIEW_REQUIRED↔PENDING, HUMAN_APPROVED↔APPROVED(by a human), REJECTED↔REJECTED.
 */

import type { ApprovalState, NormalizedAssetClassification } from "@/lib/normalize/model";

// Classes that assert something about a named person or specific capability.
const ATTRIBUTIVE = new Set<NormalizedAssetClassification>([
  "PORTRAIT",
  "INSURER_MARK",
  "FACILITY",
  "EQUIPMENT",
]);

/** Policy: initial approval state for a freshly classified asset. */
export function initialApprovalState(
  classification: NormalizedAssetClassification,
): ApprovalState {
  return ATTRIBUTIVE.has(classification) ? "REVIEW_REQUIRED" : "AUTO_APPROVED";
}

export function isAttributive(classification: NormalizedAssetClassification): boolean {
  return ATTRIBUTIVE.has(classification);
}

// Map the existing extractor's classification vocabulary to the normalized one.
const CLASS_MAP: Record<string, NormalizedAssetClassification> = {
  LOGO: "LOGO",
  HERO: "EXTERIOR",
  HOSPITAL_EXTERIOR: "EXTERIOR",
  HOSPITAL_INTERIOR: "INTERIOR",
  DOCTOR: "PORTRAIT",
  FACILITY: "FACILITY",
  DEPARTMENT: "FACILITY",
  INSURANCE_LOGO: "INSURER_MARK",
  GALLERY: "OTHER",
  ICON: "OTHER",
  OTHER: "OTHER",
};

export function mapClassification(raw: string): NormalizedAssetClassification {
  return CLASS_MAP[raw] ?? "OTHER";
}

/** Architectural renders must never be marked as real photographs. */
export function looksLikeRender(url: string, altOrCaption = ""): boolean {
  return /(render|3d|artist|impression|concept|proposed|architectural|elevation|walkthrough)/i.test(
    `${url} ${altOrCaption}`,
  );
}
