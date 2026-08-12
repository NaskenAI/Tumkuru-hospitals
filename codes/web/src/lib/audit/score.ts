/**
 * Lead scoring — Digital Gap Score and Commercial Fit Score.
 *
 * Both scores are 0–100 and fully deterministic (no LLM involved).
 * Every point is explained in a breakdown object for transparency.
 */

import type { AuditCheckResult } from "@/lib/audit/checks";
import {
  loadScoringConfig,
  type ScoringConfig,
} from "@/lib/audit/scoring-config";
import type { Json, RiskTier, VerificationStatus } from "@/lib/database/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreBreakdownItem = {
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
};

export type LeadScores = {
  digitalGapScore: number;
  commercialFitScore: number;
  priorityScore: number;
  breakdown: {
    digitalGap: ScoreBreakdownItem[];
    commercialFit: ScoreBreakdownItem[];
  };
};

// ---------------------------------------------------------------------------
// Digital Gap Score (0–100)
// Higher = bigger gap = more opportunity for Nasken
// ---------------------------------------------------------------------------

export function computeDigitalGapScore(
  auditChecks: AuditCheckResult[],
  config: ScoringConfig = loadScoringConfig(),
): { score: number; breakdown: ScoreBreakdownItem[] } {
  const auditCheckWeights = config.auditWeights;
  const breakdown: ScoreBreakdownItem[] = [];
  let totalGap = 0;

  for (const check of auditChecks) {
    const weight = auditCheckWeights[check.name] ?? 0;
    if (weight === 0) continue;

    // Gap = what they're MISSING (not passed = gap points earned)
    const points = check.passed ? 0 : weight;
    totalGap += points;

    breakdown.push({
      label: check.label,
      points,
      maxPoints: weight,
      reason: check.detail,
    });
  }

  // If no website at all, that's maximum digital gap
  const hasWebsite = auditChecks.some(
    (c) => c.name === "website_exists" && c.passed,
  );
  if (!hasWebsite) {
    return { score: 100, breakdown };
  }

  return { score: Math.min(100, totalGap), breakdown };
}

// ---------------------------------------------------------------------------
// Commercial Fit Score (0–100)
// Higher = better fit for Nasken's preview offering
// ---------------------------------------------------------------------------

type FactSummary = {
  fact_type: string;
  value: Json;
  risk_tier: RiskTier;
  verification_status: VerificationStatus;
};

export function computeCommercialFitScore(
  facts: FactSummary[],
  config: ScoringConfig = loadScoringConfig(),
): { score: number; breakdown: ScoreBreakdownItem[] } {
  const w = config.fit;
  const breakdown: ScoreBreakdownItem[] = [];
  let score = 0;

  const verifiedFacts = facts.filter(
    (f) => f.verification_status === "VERIFIED",
  );
  const factTypes = new Set(verifiedFacts.map((f) => f.fact_type));

  // Has hospital name
  const hasName = factTypes.has("HOSPITAL_NAME");
  const namePoints = hasName ? w.name : 0;
  score += namePoints;
  breakdown.push({
    label: "Hospital name verified",
    points: namePoints,
    maxPoints: w.name,
    reason: hasName ? "Name is confirmed." : "Name not verified.",
  });

  // Has phone
  const hasPhone = factTypes.has("PHONE");
  const phonePoints = hasPhone ? w.phone : 0;
  score += phonePoints;
  breakdown.push({
    label: "Phone verified",
    points: phonePoints,
    maxPoints: w.phone,
    reason: hasPhone ? "Contact phone available." : "No verified phone.",
  });

  // Has address
  const hasAddress = factTypes.has("ADDRESS");
  const addressPoints = hasAddress ? w.address : 0;
  score += addressPoints;
  breakdown.push({
    label: "Address verified",
    points: addressPoints,
    maxPoints: w.address,
    reason: hasAddress ? "Physical address confirmed." : "No verified address.",
  });

  // Has specialties
  const specialtyCount = verifiedFacts.filter(
    (f) => f.fact_type === "SPECIALTY",
  ).length;
  const specialtyPoints = Math.min(w.specialtyMax, specialtyCount * w.specialtyPer);
  score += specialtyPoints;
  breakdown.push({
    label: "Specialties",
    points: specialtyPoints,
    maxPoints: w.specialtyMax,
    reason: `${specialtyCount} verified specialties.`,
  });

  // Has doctors
  const doctorCount = verifiedFacts.filter(
    (f) => f.fact_type === "DOCTOR",
  ).length;
  const doctorPoints = Math.min(w.doctorMax, doctorCount * w.doctorPer);
  score += doctorPoints;
  breakdown.push({
    label: "Doctors listed",
    points: doctorPoints,
    maxPoints: w.doctorMax,
    reason: `${doctorCount} verified doctors.`,
  });

  // Has services
  const serviceCount = verifiedFacts.filter(
    (f) => f.fact_type === "SERVICE",
  ).length;
  const servicePoints = Math.min(w.serviceMax, serviceCount * w.servicePer);
  score += servicePoints;
  breakdown.push({
    label: "Services listed",
    points: servicePoints,
    maxPoints: w.serviceMax,
    reason: `${serviceCount} verified services.`,
  });

  // Has hours
  const hasHours = factTypes.has("HOURS");
  const hoursPoints = hasHours ? w.hours : 0;
  score += hoursPoints;
  breakdown.push({
    label: "Hours verified",
    points: hoursPoints,
    maxPoints: w.hours,
    reason: hasHours ? "Operating hours available." : "No verified hours.",
  });

  // Total fact count bonus
  const richness = Math.min(w.richnessMax, Math.floor(verifiedFacts.length / 2));
  score += richness;
  breakdown.push({
    label: "Data richness bonus",
    points: richness,
    maxPoints: w.richnessMax,
    reason: `${verifiedFacts.length} total verified facts.`,
  });

  return { score: Math.min(100, score), breakdown };
}

// ---------------------------------------------------------------------------
// Combined priority score
// ---------------------------------------------------------------------------

export function computePriorityScore(
  digitalGapScore: number,
  commercialFitScore: number,
  config: ScoringConfig = loadScoringConfig(),
): number {
  // Default weighting: 40% gap, 60% fit — hospitals that NEED help AND have
  // enough data. Both weights are configurable.
  return Math.round(
    digitalGapScore * config.priority.gapWeight +
      commercialFitScore * config.priority.fitWeight,
  );
}

export function computeAllScores(input: {
  auditChecks: AuditCheckResult[];
  facts: FactSummary[];
  config?: ScoringConfig;
}): LeadScores {
  const config = input.config ?? loadScoringConfig();
  const digitalGap = computeDigitalGapScore(input.auditChecks, config);
  const commercialFit = computeCommercialFitScore(input.facts, config);
  const priorityScore = computePriorityScore(
    digitalGap.score,
    commercialFit.score,
    config,
  );

  return {
    digitalGapScore: digitalGap.score,
    commercialFitScore: commercialFit.score,
    priorityScore,
    breakdown: {
      digitalGap: digitalGap.breakdown,
      commercialFit: commercialFit.breakdown,
    },
  };
}
