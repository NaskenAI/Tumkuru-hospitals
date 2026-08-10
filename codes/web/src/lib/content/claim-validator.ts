/**
 * Deterministic claim validation.
 *
 * Checks that every factual claim in generated content is backed by a
 * verified fact. This is the final gate before a preview can be deployed.
 *
 * Uses pure TypeScript — no LLM involved.
 */

import type { GeneratedContent, Claim } from "@/lib/content/content-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationIssue = {
  path: string;
  message: string;
  factIds: string[];
};

export type ValidationResult = {
  valid: boolean;
  totalClaims: number;
  validClaims: number;
  issues: ValidationIssue[];
};

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

function validateClaimIds(
  claim: { supporting_fact_ids: string[] },
  path: string,
  verifiedFactIds: Set<string>,
  issues: ValidationIssue[],
): boolean {
  if (!claim.supporting_fact_ids || claim.supporting_fact_ids.length === 0) {
    issues.push({
      path,
      message: "Claim has no supporting fact IDs.",
      factIds: [],
    });
    return false;
  }

  const missingIds = claim.supporting_fact_ids.filter(
    (id) => !verifiedFactIds.has(id),
  );

  if (missingIds.length > 0) {
    issues.push({
      path,
      message: `Claim references unverified fact IDs: ${missingIds.join(", ")}`,
      factIds: missingIds,
    });
    return false;
  }

  return true;
}

/**
 * Validate all claims in generated content against verified facts.
 *
 * Every claim must reference at least one verified fact ID.
 * If any claim fails, the entire content is marked invalid and
 * the preview must not be deployed.
 */
export function validateClaims(
  content: GeneratedContent,
  verifiedFactIds: string[],
): ValidationResult {
  const verifiedSet = new Set(verifiedFactIds);
  const issues: ValidationIssue[] = [];
  let totalClaims = 0;
  let validClaims = 0;

  function check(claim: { supporting_fact_ids: string[] }, path: string) {
    totalClaims++;
    if (validateClaimIds(claim, path, verifiedSet, issues)) {
      validClaims++;
    }
  }

  // Tagline
  check(content.tagline, "tagline");

  // About paragraphs
  content.about.forEach((p, i) => check(p, `about[${i}]`));

  // Specialties
  content.specialties?.forEach((s, i) =>
    check(s, `specialties[${i}]`),
  );

  // Services
  content.services?.forEach((s, i) => check(s, `services[${i}]`));

  // Doctors
  content.doctors?.forEach((d, i) => check(d, `doctors[${i}]`));

  // Facilities
  content.facilities?.forEach((f, i) =>
    check(f, `facilities[${i}]`),
  );

  // Contact
  check(content.contact, "contact");

  // Accreditations
  content.accreditations?.forEach((a, i) =>
    check(a, `accreditations[${i}]`),
  );

  // Insurance
  content.insurance?.forEach((ins, i) =>
    check(ins, `insurance[${i}]`),
  );

  return {
    valid: issues.length === 0,
    totalClaims,
    validClaims,
    issues,
  };
}
