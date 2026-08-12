import type { Database, Json } from "@/lib/database/types";
import { excerptAppearsInSource } from "@/lib/extraction/excerpt";
import {
  type ExtractionOutput,
  riskTierForFactType,
} from "@/lib/extraction/schema";

export type HospitalFactInsert =
  Database["public"]["Tables"]["hospital_facts"]["Insert"];

export type RejectedFact = {
  fact_type: string;
  source_excerpt: string;
  reason: string;
};

export type BuildFactsResult = {
  payloads: HospitalFactInsert[];
  rejected: RejectedFact[];
};

/**
 * Convert validated extraction output into unverified fact rows.
 *
 * When `sourceText` is provided, each fact's `source_excerpt` is checked
 * against the real source text (P0-7); facts whose excerpt cannot be found are
 * rejected rather than stored, so fabricated provenance never enters the DB.
 * When `sourceText` is omitted/empty (e.g. a manual source with no fetched
 * text) excerpt verification is skipped.
 */
export function buildHospitalFactPayloads(input: {
  leadId: string;
  sourceId: string;
  extraction: ExtractionOutput;
  sourceText?: string | null;
}): BuildFactsResult {
  const sourceText = input.sourceText ?? "";
  const verifyExcerpts = sourceText.trim().length > 0;

  const payloads: HospitalFactInsert[] = [];
  const rejected: RejectedFact[] = [];

  for (const fact of input.extraction.facts) {
    if (
      verifyExcerpts &&
      !excerptAppearsInSource(sourceText, fact.source_excerpt)
    ) {
      rejected.push({
        fact_type: fact.fact_type,
        source_excerpt: fact.source_excerpt,
        reason: "source_excerpt not found in source text",
      });
      continue;
    }

    payloads.push({
      lead_id: input.leadId,
      source_id: input.sourceId,
      fact_type: fact.fact_type,
      value: normalizeFactValue(fact.value),
      risk_tier: riskTierForFactType(fact.fact_type),
      source_excerpt: fact.source_excerpt,
      verification_status: "UNVERIFIED",
    });
  }

  return { payloads, rejected };
}

function normalizeFactValue(value: ExtractionOutput["facts"][number]["value"]): Json {
  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

/**
 * Stable identity for a fact within a source, used to make re-extraction
 * idempotent (P0-12): the same (fact_type, excerpt) is never stored twice.
 */
export function factDedupeKey(fact: {
  fact_type: string;
  source_excerpt?: string | null;
}): string {
  return `${fact.fact_type}::${(fact.source_excerpt ?? "").trim()}`;
}

/** Drop candidate facts already present (by dedupe key) among existing facts. */
export function filterNewFactPayloads(
  existing: Array<{ fact_type: string; source_excerpt?: string | null }>,
  candidates: HospitalFactInsert[],
): HospitalFactInsert[] {
  const seen = new Set(existing.map(factDedupeKey));
  return candidates.filter((c) => !seen.has(factDedupeKey(c)));
}
