/**
 * Accreditation extraction with explicit status (Section 22 / Task-1B §12).
 *
 * Hard rules:
 *  - "applied to obtain accreditation" → APPLIED, never HELD.
 *  - HELD requires a possession signal ("accredited"/"certified"/"...by/from"),
 *    NOT the bare noun "accreditation"/"recognition" (a heading/topic word).
 *  - A doctor's professional-society membership is not a hospital accreditation.
 *  - The accrediting body is never invented — unstated ⇒ "Accreditation".
 */

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Accreditation, AccreditationStatus, SourcePage } from "@/lib/normalize/model";
import { collapseWs } from "@/lib/normalize/text";

const BODIES = ["NABH", "NABL", "JCI", "ISO", "NQAS", "AHPI"];
const MEMBERSHIP_RE = /\b(member|membership|fellow|fellowship|affiliat)|\bdr\.?\s/i;
const TRIGGER = /\b(accredit|certif|nabh|nabl|jci|iso|nqas|ahpi)/i;

function statusFor(text: string): AccreditationStatus {
  const t = text.toLowerCase();
  if (/\b(applied|applying|in (the )?process|process of|pursuing|working towards|under process|plans to obtain|to obtain)\b/.test(t)) {
    return "APPLIED";
  }
  if (/\b(expired|lapsed|no longer (accredit|certif))\b/.test(t)) return "EXPIRED";
  // Possession — an adjective/participle or "accredited by/from", not the noun.
  if (/\b(accredited|certified)\b/.test(t) || /(accredit\w*|certif\w*)\s+(by|from)\b/.test(t)) {
    return "HELD";
  }
  return "UNKNOWN";
}

export function parseAccreditations(
  candidates: string[],
  page: SourcePage,
  pageText: string,
): Accreditation[] {
  const out: Accreditation[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const full = collapseWs(raw);
    const km = TRIGGER.exec(full);
    if (!km) continue;
    // Window around the keyword so long flattened blocks still yield a statement.
    const text = full.length <= 200 ? full : collapseWs(full.slice(Math.max(0, km.index - 90), km.index + 120));
    if (MEMBERSHIP_RE.test(text)) continue;

    const body =
      BODIES.find((b) => new RegExp(`\\b${b}\\b`, "i").test(text)) ?? "Accreditation";
    const hasBody = body !== "Accreditation";
    const status = statusFor(text);
    // A bare "accreditation"/"recognition" topic word with no status and no
    // named body is not an accreditation claim — drop it.
    if (status === "UNKNOWN" && !hasBody) continue;

    const key = `${body}:${status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      body,
      status,
      rawText: text.slice(0, 200),
      evidence: [makeEvidence(page, { excerpt: text.slice(0, 200), pageText })],
    });
  }
  return out;
}
