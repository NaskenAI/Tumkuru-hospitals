/**
 * Extraction evaluation metrics (P0-6). Pure functions, no I/O.
 *
 * A stored fact is a "true positive" when it matches a gold (manually verified)
 * fact of the same type whose value is contained in (or contains) the stored
 * value after normalization.
 */

export type GoldFact = { fact_type: string; value: string };
export type StoredFact = { fact_type: string; value: string };

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function valueMatches(gold: string, candidate: string): boolean {
  const g = norm(gold);
  const c = norm(candidate);
  if (g.length === 0 || c.length === 0) return false;
  return c.includes(g) || g.includes(c);
}

export function factMatches(gold: GoldFact, candidate: StoredFact): boolean {
  return (
    gold.fact_type === candidate.fact_type &&
    valueMatches(gold.value, candidate.value)
  );
}

export type PrecisionRecall = {
  precision: number;
  recall: number;
  truePositives: number;
  storedCount: number;
  goldCount: number;
  coveredGold: number;
};

export function computePrecisionRecall(
  gold: GoldFact[],
  stored: StoredFact[],
): PrecisionRecall {
  const truePositives = stored.filter((s) =>
    gold.some((g) => factMatches(g, s)),
  ).length;
  const coveredGold = gold.filter((g) =>
    stored.some((s) => factMatches(g, s)),
  ).length;

  return {
    precision: stored.length === 0 ? 1 : truePositives / stored.length,
    recall: gold.length === 0 ? 1 : coveredGold / gold.length,
    truePositives,
    storedCount: stored.length,
    goldCount: gold.length,
    coveredGold,
  };
}

/** Fraction of facts whose excerpt is NOT verifiable in the source text. */
export function unsupportedFactRate(
  facts: Array<{ source_excerpt: string }>,
  isSupported: (excerpt: string) => boolean,
): number {
  if (facts.length === 0) return 0;
  const unsupported = facts.filter((f) => !isSupported(f.source_excerpt)).length;
  return unsupported / facts.length;
}

/** Fraction of extraction outputs that failed schema validation. */
export function schemaFailureRate(parseOk: boolean[]): number {
  if (parseOk.length === 0) return 0;
  return parseOk.filter((ok) => !ok).length / parseOk.length;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
