/**
 * Deterministic template selector.
 *
 * Picks one of three templates based on verified fact counts.
 * No LLM involved — pure business logic.
 */

import type { TemplateKey } from "@/lib/content/content-schema";

type FactTypeCount = {
  specialtyCount: number;
  doctorCount: number;
  serviceCount: number;
  departmentCount: number;
};

/**
 * Select the best template key based on what verified facts are available.
 *
 * Rules:
 * - multispecialty: ≥ 3 specialties AND ≥ 2 doctors
 * - specialty: ≥ 1 specialty OR ≥ 1 doctor with a specialty
 * - clinic: everything else (default fallback)
 */
export function selectTemplate(counts: FactTypeCount): TemplateKey {
  if (counts.specialtyCount >= 3 && counts.doctorCount >= 2) {
    return "multispecialty";
  }

  if (counts.specialtyCount >= 1 || counts.doctorCount >= 1) {
    return "specialty";
  }

  return "clinic";
}

/**
 * Count fact types from verified facts to feed into selectTemplate.
 */
export function countFactTypes(
  facts: Array<{ fact_type: string; verification_status: string }>,
): FactTypeCount {
  const verified = facts.filter(
    (f) => f.verification_status === "VERIFIED",
  );

  return {
    specialtyCount: verified.filter((f) => f.fact_type === "SPECIALTY").length,
    doctorCount: verified.filter((f) => f.fact_type === "DOCTOR").length,
    serviceCount: verified.filter((f) => f.fact_type === "SERVICE").length,
    departmentCount: verified.filter((f) => f.fact_type === "FACILITY").length,
  };
}
