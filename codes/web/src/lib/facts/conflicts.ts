/**
 * Cross-source conflict detection (Phase 2, step 8).
 *
 * When a lead has more than one permitted source, important facts may disagree
 * (e.g. website phone vs directory phone). We never silently pick one — we
 * surface the conflict so a human reviewer decides. Pure, deterministic.
 */

import type { Json } from "@/lib/database/types";

export type FactForConflict = {
  id: string;
  fact_type: string;
  value: Json;
  source_id: string | null;
};

// Facts where a disagreement matters enough to force human review.
export const CONFLICT_FACT_TYPES = new Set<string>([
  "PHONE",
  "ADDRESS",
  "HOURS",
  "EMAIL",
  "QUALIFICATION",
  "EMERGENCY",
]);

export type ConflictVariant = {
  value: string;
  factIds: string[];
  sourceIds: string[];
};

export type Conflict = {
  fact_type: string;
  variants: ConflictVariant[];
};

function stringify(value: Json): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalizeValue(factType: string, value: Json): string {
  const raw = stringify(value);
  if (factType === "PHONE") {
    return raw.replace(/\D/g, "");
  }
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Detect conflicting values for important fact types. A conflict is reported
 * when a fact type has ≥2 distinct normalized values across the lead's facts
 * that originate from ≥2 distinct sources.
 */
export function detectConflicts(facts: FactForConflict[]): Conflict[] {
  const byType = new Map<string, FactForConflict[]>();
  for (const fact of facts) {
    if (!CONFLICT_FACT_TYPES.has(fact.fact_type)) continue;
    const list = byType.get(fact.fact_type) ?? [];
    list.push(fact);
    byType.set(fact.fact_type, list);
  }

  const conflicts: Conflict[] = [];

  for (const [factType, typeFacts] of byType) {
    const byValue = new Map<string, ConflictVariant>();
    for (const fact of typeFacts) {
      const key = normalizeValue(factType, fact.value);
      if (key.length === 0) continue;
      const variant = byValue.get(key) ?? {
        value: stringify(fact.value),
        factIds: [],
        sourceIds: [],
      };
      variant.factIds.push(fact.id);
      if (fact.source_id && !variant.sourceIds.includes(fact.source_id)) {
        variant.sourceIds.push(fact.source_id);
      }
      byValue.set(key, variant);
    }

    const variants = [...byValue.values()];
    const distinctSources = new Set(
      typeFacts.map((f) => f.source_id).filter(Boolean),
    );

    // Conflict only when values genuinely disagree AND ≥2 sources are involved.
    if (variants.length >= 2 && distinctSources.size >= 2) {
      conflicts.push({ fact_type: factType, variants });
    }
  }

  return conflicts;
}
