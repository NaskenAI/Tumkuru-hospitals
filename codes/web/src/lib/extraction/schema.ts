import { z } from "zod";

import type { Json, RiskTier } from "@/lib/database/types";

export const extractedFactTypes = [
  "HOSPITAL_NAME",
  "ADDRESS",
  "PHONE",
  "EMAIL",
  "WEBSITE",
  "HOURS",
  "SPECIALTY",
  "SERVICE",
  "FACILITY",
  "DOCTOR",
  "QUALIFICATION",
  "ACCREDITATION",
  "AFFILIATION",
  "EMERGENCY",
  "INSURANCE",
  "PROCEDURE",
  "OTHER",
] as const;

export type ExtractedFactType = (typeof extractedFactTypes)[number];

export const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const extractedFactSchema = z.object({
  fact_type: z.enum(extractedFactTypes),
  value: jsonValueSchema.refine(
    (value) => typeof value !== "string" || value.trim().length > 0,
    "value cannot be empty",
  ),
  source_excerpt: z.string().trim().min(1),
});

export const extractionOutputSchema = z.object({
  facts: z.array(extractedFactSchema),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

const highRiskFactTypes = new Set<ExtractedFactType>([
  "DOCTOR",
  "QUALIFICATION",
  "ACCREDITATION",
  // A doctor's professional-society membership — a credential claim, and NOT a
  // hospital accreditation. Kept separate so it can never render as an
  // accreditation badge.
  "AFFILIATION",
  "EMERGENCY",
  "INSURANCE",
  "PROCEDURE",
]);

const mediumRiskFactTypes = new Set<ExtractedFactType>([
  "SPECIALTY",
  "SERVICE",
  "FACILITY",
]);

export function riskTierForFactType(factType: ExtractedFactType): RiskTier {
  if (highRiskFactTypes.has(factType)) return "HIGH";
  if (mediumRiskFactTypes.has(factType)) return "MEDIUM";
  return "LOW";
}

export function parseExtractionOutput(value: unknown) {
  return extractionOutputSchema.parse(value);
}
