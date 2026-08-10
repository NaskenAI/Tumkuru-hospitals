import type { Database, Json } from "@/lib/database/types";
import {
  type ExtractionOutput,
  riskTierForFactType,
} from "@/lib/extraction/schema";

export type HospitalFactInsert =
  Database["public"]["Tables"]["hospital_facts"]["Insert"];

export function buildHospitalFactPayloads(input: {
  leadId: string;
  sourceId: string;
  extraction: ExtractionOutput;
}): HospitalFactInsert[] {
  return input.extraction.facts.map((fact) => ({
    lead_id: input.leadId,
    source_id: input.sourceId,
    fact_type: fact.fact_type,
    value: normalizeFactValue(fact.value),
    risk_tier: riskTierForFactType(fact.fact_type),
    source_excerpt: fact.source_excerpt,
    verification_status: "UNVERIFIED",
  }));
}

function normalizeFactValue(value: ExtractionOutput["facts"][number]["value"]): Json {
  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}
