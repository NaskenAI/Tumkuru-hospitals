/**
 * Milestone extraction (Section 24). Only SUPPORTED dated events become
 * milestones. Copyright/footer year ranges, asset-upload years and bare years
 * with no event never establish history.
 */

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Milestone, SourcePage } from "@/lib/normalize/model";
import { collapseWs } from "@/lib/normalize/text";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// Lines that mention a year but are NOT milestones.
const COPYRIGHT_RE = /(©|\(c\)|copyright|all rights reserved|\brights reserved\b)/i;
const YEAR_RANGE_RE = /\b(19|20)\d{2}\s*[–-]\s*\d{2,4}\b/; // "2017–26", "2017-2026"

// Prefix matches (no trailing \b) so "established", "founded", "launched" hit.
const EVENT_HINT_RE =
  /\b(establish|found|inaugurat|launch|open|commission|start|began|introduc|expand|accredit|milestone|celebrat|first|added|acquired|installed|since)/i;

export function parseMilestones(candidates: string[], page: SourcePage, pageText: string): Milestone[] {
  const out: Milestone[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const text = collapseWs(raw);
    if (!text || text.length > 200) continue;
    if (COPYRIGHT_RE.test(text)) continue; // copyright ≠ history
    if (YEAR_RANGE_RE.test(text) && !EVENT_HINT_RE.test(text)) continue; // footer range

    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[0]);
    // A dated event needs a described event, not just a year.
    if (!EVENT_HINT_RE.test(text)) continue;

    const monthMatch = text.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
    const month = monthMatch ? MONTHS[monthMatch[1]] : undefined;
    const dayMatch = text.match(/\b([0-3]?\d)(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)/i);
    const day = dayMatch ? Number(dayMatch[1]) : undefined;

    const key = `${year}-${month ?? 0}-${text.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: text,
      date: { year, month, day },
      evidence: [makeEvidence(page, { excerpt: text, pageText })],
    });
  }
  return out;
}
