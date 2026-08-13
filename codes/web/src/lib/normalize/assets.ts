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

import { makeEvidence } from "@/lib/normalize/evidence";
import type {
  ApprovalState,
  NormalizedAsset,
  NormalizedAssetClassification,
} from "@/lib/normalize/model";
import { assetBaseKey, filenameWords, titleCaseLabel } from "@/lib/normalize/text";

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

// --- Live approval reconciliation (Section 6) -------------------------------
//
// Documented mapping from the persisted 3-state column to the normalized model.
// SAFETY: a persisted PENDING/attributive asset can NEVER become publicly
// approved through normalization.
//   REJECTED                         → REJECTED
//   APPROVED + non-attributive class → AUTO_APPROVED
//   APPROVED + attributive class     → REVIEW_REQUIRED (association not confirmed)
//   PENDING / anything else          → REVIEW_REQUIRED
export function reconcileApprovalState(
  dbStatus: string,
  classification: NormalizedAssetClassification,
): ApprovalState {
  if (dbStatus === "REJECTED") return "REJECTED";
  if (dbStatus === "APPROVED") {
    return isAttributive(classification) ? "REVIEW_REQUIRED" : "AUTO_APPROVED";
  }
  return "REVIEW_REQUIRED";
}

/** Only AUTO_APPROVED / HUMAN_APPROVED assets may be shown publicly. */
export function isPubliclyEligible(state: ApprovalState): boolean {
  return state === "AUTO_APPROVED" || state === "HUMAN_APPROVED";
}

/** A persisted hospital_assets row (the existing inventory — not a new store). */
export type PersistedAssetRow = {
  id: string;
  source_id: string | null;
  source_page_url: string | null;
  original_asset_url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  classification: string;
  approval_status: string;
};

/**
 * Map a persisted asset row into the normalized Asset model. Unknown fields
 * stay null (never fabricated); no vision scores are invented.
 */
export function normalizeAssetRow(
  row: PersistedAssetRow,
  opts: { ogKeys?: Set<string> } = {},
): NormalizedAsset {
  const url = row.original_asset_url;
  const alt = (row.alt_text ?? "").trim();
  const render = looksLikeRender(url, alt);
  let classification = mapClassification(row.classification);
  if (render) classification = "RENDER";

  const is_photograph =
    !render && classification !== "LOGO" && classification !== "INSURER_MARK";
  const caption = alt || filenameWords(url).map(titleCaseLabel).join(" ") || null;
  const caption_source: NormalizedAsset["caption_source"] = alt ? "alt" : caption ? "filename" : "none";
  const aspect = row.width && row.height ? row.width / row.height : null;

  return {
    asset_id: row.id,
    source_page_id: row.source_id ?? "",
    source_page_url: row.source_page_url ?? "",
    original_url: url,
    width: row.width,
    height: row.height,
    aspect,
    bytes: null,
    mime: row.mime_type,
    og_declared: opts.ogKeys?.has(assetBaseKey(url)) ?? false,
    page_banner: false,
    caption,
    caption_source,
    classification,
    is_photograph,
    crowding: "unknown", // no vision signal → never fabricated
    technical_quality: null,
    composition_quality: null,
    hero_suitability: null,
    card_suitability: null,
    subject_ref: undefined, // no safe person/facility association at this layer
    approval_state: reconcileApprovalState(row.approval_status, classification),
    evidence: [
      makeEvidence(
        { id: row.source_id ?? "", url: row.source_page_url ?? "", tier: 2 },
        { excerpt: alt || undefined },
      ),
    ],
  };
}
