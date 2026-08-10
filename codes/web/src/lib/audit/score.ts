/**
 * Lead scoring — Digital Gap Score and Commercial Fit Score.
 *
 * Both scores are 0–100 and fully deterministic (no LLM involved).
 * Every point is explained in a breakdown object for transparency.
 */

import type { AuditCheckResult } from "@/lib/audit/checks";
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

const auditCheckWeights: Record<string, number> = {
  website_exists: 20,
  https: 5,
  mobile_viewport: 15,
  title_tag: 5,
  meta_description: 5,
  call_cta: 10,
  appointment_cta: 15,
  whatsapp_directions: 5,
  doctors_listed: 5,
  specialties_listed: 5,
  not_outdated: 10,
};

export function computeDigitalGapScore(
  auditChecks: AuditCheckResult[],
): { score: number; breakdown: ScoreBreakdownItem[] } {
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
): { score: number; breakdown: ScoreBreakdownItem[] } {
  const breakdown: ScoreBreakdownItem[] = [];
  let score = 0;

  const verifiedFacts = facts.filter(
    (f) => f.verification_status === "VERIFIED",
  );
  const factTypes = new Set(verifiedFacts.map((f) => f.fact_type));

  // Has hospital name
  const hasName = factTypes.has("HOSPITAL_NAME");
  const namePoints = hasName ? 10 : 0;
  score += namePoints;
  breakdown.push({
    label: "Hospital name verified",
    points: namePoints,
    maxPoints: 10,
    reason: hasName ? "Name is confirmed." : "Name not verified.",
  });

  // Has phone
  const hasPhone = factTypes.has("PHONE");
  const phonePoints = hasPhone ? 10 : 0;
  score += phonePoints;
  breakdown.push({
    label: "Phone verified",
    points: phonePoints,
    maxPoints: 10,
    reason: hasPhone ? "Contact phone available." : "No verified phone.",
  });

  // Has address
  const hasAddress = factTypes.has("ADDRESS");
  const addressPoints = hasAddress ? 10 : 0;
  score += addressPoints;
  breakdown.push({
    label: "Address verified",
    points: addressPoints,
    maxPoints: 10,
    reason: hasAddress ? "Physical address confirmed." : "No verified address.",
  });

  // Has specialties
  const specialtyCount = verifiedFacts.filter(
    (f) => f.fact_type === "SPECIALTY",
  ).length;
  const specialtyPoints = Math.min(20, specialtyCount * 5);
  score += specialtyPoints;
  breakdown.push({
    label: "Specialties",
    points: specialtyPoints,
    maxPoints: 20,
    reason: `${specialtyCount} verified specialties.`,
  });

  // Has doctors
  const doctorCount = verifiedFacts.filter(
    (f) => f.fact_type === "DOCTOR",
  ).length;
  const doctorPoints = Math.min(15, doctorCount * 5);
  score += doctorPoints;
  breakdown.push({
    label: "Doctors listed",
    points: doctorPoints,
    maxPoints: 15,
    reason: `${doctorCount} verified doctors.`,
  });

  // Has services
  const serviceCount = verifiedFacts.filter(
    (f) => f.fact_type === "SERVICE",
  ).length;
  const servicePoints = Math.min(15, serviceCount * 3);
  score += servicePoints;
  breakdown.push({
    label: "Services listed",
    points: servicePoints,
    maxPoints: 15,
    reason: `${serviceCount} verified services.`,
  });

  // Has hours
  const hasHours = factTypes.has("HOURS");
  const hoursPoints = hasHours ? 10 : 0;
  score += hoursPoints;
  breakdown.push({
    label: "Hours verified",
    points: hoursPoints,
    maxPoints: 10,
    reason: hasHours ? "Operating hours available." : "No verified hours.",
  });

  // Total fact count bonus
  const richness = Math.min(10, Math.floor(verifiedFacts.length / 2));
  score += richness;
  breakdown.push({
    label: "Data richness bonus",
    points: richness,
    maxPoints: 10,
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
): number {
  // Weight: 40% gap, 60% fit — we want hospitals that NEED help AND have enough data
  return Math.round(digitalGapScore * 0.4 + commercialFitScore * 0.6);
}

export function computeAllScores(input: {
  auditChecks: AuditCheckResult[];
  facts: FactSummary[];
}): LeadScores {
  const digitalGap = computeDigitalGapScore(input.auditChecks);
  const commercialFit = computeCommercialFitScore(input.facts);
  const priorityScore = computePriorityScore(
    digitalGap.score,
    commercialFit.score,
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
