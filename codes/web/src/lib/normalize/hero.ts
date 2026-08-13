/**
 * Deterministic hero scoring (Section 18). og:image is a strong PRIOR, not an
 * unconditional winner: a declared image that is actually a logo, too small, a
 * render, or crowded can still lose. Every candidate's component scores and
 * rejection reasons are returned so the ranking is inspectable.
 */

import type { NormalizedAssetClassification } from "@/lib/normalize/model";

export type HeroCandidateInput = {
  asset_id: string;
  classification: NormalizedAssetClassification;
  width?: number;
  height?: number;
  og_declared: boolean;
  is_photograph: boolean;
  crowding: "low" | "medium" | "high" | "unknown";
};

export type HeroScore = {
  asset_id: string;
  total: number;
  components: Record<string, number>;
  reasons: string[];
};

const CLASS_SCORE: Record<NormalizedAssetClassification, number> = {
  EXTERIOR: 25,
  INTERIOR: 15,
  FACILITY: 8,
  OTHER: 0,
  RENDER: -10,
  EQUIPMENT: -10,
  LOGO: -100,
  PORTRAIT: -100,
  INSURER_MARK: -100,
};

export function scoreHeroCandidate(c: HeroCandidateInput): HeroScore {
  const components: Record<string, number> = {};
  const reasons: string[] = [];

  components.og = c.og_declared ? 30 : 0;
  if (c.og_declared) reasons.push("declared as og:image (+30 prior)");

  components.classification = CLASS_SCORE[c.classification];
  if (components.classification <= -100) reasons.push(`${c.classification} is not a hero image`);

  const aspect = c.width && c.height ? c.width / c.height : undefined;
  if (aspect === undefined) components.aspect = 0;
  else if (aspect >= 1.3 && aspect <= 2.4) {
    components.aspect = 15;
    reasons.push("landscape aspect");
  } else if (aspect >= 1.0) components.aspect = 5;
  else {
    components.aspect = -10;
    reasons.push("portrait aspect (poor hero)");
  }

  const w = c.width ?? 0;
  if (w >= 1600) components.dimension = 15;
  else if (w >= 1200) components.dimension = 10;
  else if (w >= 1000) components.dimension = 6;
  else if (w >= 800) components.dimension = 0;
  else {
    components.dimension = -30;
    reasons.push("below minimum hero width");
  }

  components.photograph = c.is_photograph ? 10 : -15;
  if (!c.is_photograph) reasons.push("not a photograph (render/graphic)");

  components.crowding =
    c.crowding === "high" ? -20 : c.crowding === "medium" ? -8 : 0;
  if (c.crowding === "high") reasons.push("crowded composition");

  const total = Object.values(components).reduce((a, b) => a + b, 0);
  return { asset_id: c.asset_id, total, components, reasons };
}

/** Rank candidates best-first; ties broken by asset_id for determinism. */
export function scoreHeroCandidates(inputs: HeroCandidateInput[]): HeroScore[] {
  return inputs
    .map(scoreHeroCandidate)
    .sort((a, b) => b.total - a.total || a.asset_id.localeCompare(b.asset_id));
}
