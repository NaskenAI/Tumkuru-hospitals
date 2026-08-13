/**
 * Accreditation extraction with explicit status (Section 22).
 * "Applied for NABH" must NEVER normalize to "NABH accredited". A doctor's
 * professional-society membership is not a hospital accreditation and is
 * excluded here.
 */

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Accreditation, AccreditationStatus, SourcePage } from "@/lib/normalize/model";
import { collapseWs } from "@/lib/normalize/text";

const BODIES = ["NABH", "NABL", "JCI", "ISO", "NABL", "NQAS", "AHPI"];
const MEMBERSHIP_RE = /\b(member|membership|fellow|fellowship|affiliat)|\bdr\.?\s/i;

function statusFor(text: string): AccreditationStatus {
  const t = text.toLowerCase();
  if (/\b(applied|applying|in process|in the process|pursuing|process of|under process|working towards)\b/.test(t)) {
    return "APPLIED";
  }
  if (/\b(expired|lapsed|no longer)\b/.test(t)) return "EXPIRED";
  if (/\b(accredit|certified|certification)/.test(t)) return "HELD";
  return "UNKNOWN";
}

/**
 * Scan a page's candidate lines (sentences or short labels) for accreditation
 * statements. Each candidate carries its own text so status is per-statement.
 */
export function parseAccreditations(
  candidates: string[],
  page: SourcePage,
  pageText: string,
): Accreditation[] {
  const out: Accreditation[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const text = collapseWs(raw);
    if (!text || text.length > 200) continue;
    // Require an accreditation/certification word or a named body — a bare
    // "Recognitions" heading is NOT an accreditation claim.
    if (!/\b(accredit|certif|\bnabh\b|\bnabl\b|\bjci\b|\biso\b|\bnqas\b|\bahpi\b)/i.test(text)) continue;
    // Never treat a person's membership/affiliation as a hospital accreditation.
    if (MEMBERSHIP_RE.test(text)) continue;

    const body =
      BODIES.find((b) => new RegExp(`\\b${b}\\b`, "i").test(text)) ??
      (/\biso\b/i.test(text) ? "ISO" : "Accreditation");
    const status = statusFor(text);
    const key = `${body}:${status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      body,
      status,
      rawText: text,
      evidence: [makeEvidence(page, { excerpt: text, pageText })],
    });
  }
  return out;
}
