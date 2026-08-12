/**
 * Cross-import fuzzy duplicate detection (Phase 2, step 7).
 *
 * Exact re-imports are already blocked by the unique import_fingerprint. This
 * catches the same hospital re-imported with slightly different data using
 * fuzzy signals (normalized name, phone, website domain, city). Ambiguous
 * matches are FLAGGED for human review — never auto-merged.
 */

export type DupCandidate = {
  normalizedName: string;
  normalizedCity: string | null;
  knownPhone: string | null;
  domain: string | null;
};

export type ExistingLead = DupCandidate & { id: string };

export type DupConfidence = "strong" | "possible";

export type DupMatch = {
  leadId: string;
  confidence: DupConfidence;
  reasons: string[];
};

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const host = new URL(withProto).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function phonesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (da.length < 10 || db.length < 10) return false;
  // Compare the last 10 digits (ignore country/STD prefixes).
  return da.slice(-10) === db.slice(-10);
}

export function findPossibleDuplicates(
  candidate: DupCandidate,
  existing: ExistingLead[],
): DupMatch[] {
  const matches: DupMatch[] = [];

  for (const lead of existing) {
    const reasons: string[] = [];
    let strong = false;

    if (phonesMatch(candidate.knownPhone, lead.knownPhone)) {
      reasons.push("same phone");
      strong = true;
    }
    if (candidate.domain && lead.domain && candidate.domain === lead.domain) {
      reasons.push("same website domain");
      strong = true;
    }

    const nameMatch =
      candidate.normalizedName.length > 0 &&
      candidate.normalizedName === lead.normalizedName;
    const cityMatch =
      Boolean(candidate.normalizedCity) &&
      candidate.normalizedCity === lead.normalizedCity;

    if (nameMatch && cityMatch) {
      reasons.push("same name + city");
      strong = true;
    } else if (nameMatch) {
      reasons.push("same name");
    }

    if (reasons.length > 0) {
      matches.push({
        leadId: lead.id,
        confidence: strong ? "strong" : "possible",
        reasons,
      });
    }
  }

  // Strong matches first.
  return matches.sort((a, b) =>
    a.confidence === b.confidence ? 0 : a.confidence === "strong" ? -1 : 1,
  );
}
