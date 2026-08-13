/**
 * Marketing / superlative handling (Section 21). Superlative and positioning
 * language is captured SEPARATELY as positioning_claims and never allowed into
 * neutral factual fields.
 */

import { makeEvidence } from "@/lib/normalize/evidence";
import type { PositioningClaim, SourcePage } from "@/lib/normalize/model";
import { collapseWs, containsSuperlative } from "@/lib/normalize/text";

/** True if a candidate factual string carries marketing language (reject it). */
export function isPositioningText(text: string): boolean {
  return containsSuperlative(text);
}

/** Collect positioning claims from candidate lines (title, headings, blocks). */
export function parsePositioningClaims(
  candidates: string[],
  page: SourcePage,
  pageText: string,
): PositioningClaim[] {
  const out: PositioningClaim[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const text = collapseWs(raw);
    if (!text || text.length > 200) continue;
    if (!containsSuperlative(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, evidence: [makeEvidence(page, { excerpt: text, pageText })] });
  }
  return out;
}
