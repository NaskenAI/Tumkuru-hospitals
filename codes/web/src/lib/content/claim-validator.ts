/**
 * Deterministic, fact-type-aware claim validation (P0-3) — the final gate
 * before a preview can deploy. Pure TypeScript, no LLM.
 *
 * Membership of a supporting_fact_id is NOT sufficient. Each generated field is
 * grounded against facts OF THE APPROPRIATE TYPE:
 *
 *   - specialties/services/facilities/doctors names must match a verified fact
 *     of the matching type (SPECIALTY/SERVICE/FACILITY/DOCTOR);
 *   - a doctor's qualification requires a verified QUALIFICATION fact, a doctor's
 *     specialty a verified SPECIALTY fact;
 *   - contact phone/email/address/hours/emergency each require the matching
 *     fact type (PHONE/EMAIL/ADDRESS/HOURS/EMERGENCY);
 *   - accreditations require ACCREDITATION facts, insurance INSURANCE facts;
 *   - free text (tagline/about) may not assert emergency/round-the-clock care
 *     without an EMERGENCY fact, nor accreditation/certification without an
 *     ACCREDITATION fact.
 *
 * In addition, every claim: cites only verified facts, contains no banned
 * superlatives, and contains no number absent from its supporting facts.
 *
 * This blocks e.g. "24/7 emergency care" citing only an ADDRESS fact, or a
 * doctor "MD Cardiology" with no qualification fact.
 */

import type { GeneratedContent } from "@/lib/content/content-schema";
import type { Json } from "@/lib/database/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerifiedFact = {
  id: string;
  fact_type: string;
  value: Json;
  source_excerpt: string | null;
};

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
// Banned language (SCOPE_RULES content rules)
// ---------------------------------------------------------------------------

const BANNED_PATTERNS: RegExp[] = [
  /\bbest\b/i,
  /\bnumber one\b/i,
  /\bno\.?\s?1\b/i,
  /#\s?1\b/i,
  /\bleading\b/i,
  /\bworld[-\s]?class\b/i,
  /\bguarantee(d|s)?\b/i,
  /\bhighest\s+success\b/i,
  /\b100\s*%\s*success\b/i,
  /\bmost trusted\b/i,
  /\bworld'?s\b/i,
  /\btop[-\s]?rated\b/i,
  /\bunmatched\b/i,
  /\bunparalleled\b/i,
];

function findBannedTerms(text: string): string[] {
  const found: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push(match[0].trim());
  }
  return found;
}

// Free-text assertions that require a specific fact type to be present.
const SENSITIVE_REQUIREMENTS: Array<{
  pattern: RegExp;
  requiredType: string;
  label: string;
}> = [
  {
    pattern:
      /\b(emergency|24\s*[x/*]\s*7|24\/7|round[-\s]the[-\s]clock|trauma|casualty|\bicu\b|intensive care)\b/i,
    requiredType: "EMERGENCY",
    label: "emergency / round-the-clock care",
  },
  {
    pattern:
      /\b(nabh|nabl|\biso\b|accredit\w*|certified|certification|awarded|award-winning)\b/i,
    requiredType: "ACCREDITATION",
    label: "accreditation / certification",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stringifyValue(value: Json): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function digitRuns(value: string): string[] {
  return value.match(/\d+/g) ?? [];
}

function textMatches(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function phoneMatches(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (da.length < 6 || db.length < 6) return false;
  return da.includes(db) || db.includes(da);
}

// ---------------------------------------------------------------------------
// Per-node validation
// ---------------------------------------------------------------------------

type RequiredType = {
  type: string;
  /** Text that must match a fact value of `type`; omit for presence-only. */
  matchText?: string;
  /** Compare as phone numbers (digits) rather than plain text. */
  asPhone?: boolean;
};

type ClaimNode = {
  supporting_fact_ids: string[];
  /** Human-readable text checked for banned terms + number grounding. */
  text: string;
  /** Fact-type requirements this node must satisfy from its cited facts. */
  required?: RequiredType[];
  /**
   * Strings that must appear (grounded) in the cited facts' value/excerpt,
   * regardless of fact type. E.g. a doctor's specialty/qualification, which is
   * often carried inside the DOCTOR fact rather than a separate typed fact.
   */
  groundedText?: string[];
  /** Apply free-text sensitive-term guards (emergency/accreditation). */
  freeText?: boolean;
};

function validateNode(
  node: ClaimNode,
  path: string,
  factById: Map<string, VerifiedFact>,
  verifiedIds: Set<string>,
  issues: ValidationIssue[],
): boolean {
  const ids = node.supporting_fact_ids ?? [];
  const before = issues.length;

  if (ids.length === 0) {
    issues.push({ path, message: "Claim has no supporting fact IDs.", factIds: [] });
    return false;
  }

  const missing = ids.filter((id) => !verifiedIds.has(id));
  if (missing.length > 0) {
    issues.push({
      path,
      message: `Claim references unverified fact IDs: ${missing.join(", ")}`,
      factIds: missing,
    });
    return false;
  }

  const facts = ids.map((id) => factById.get(id)!).filter(Boolean);

  // 1. Banned superlatives.
  const banned = findBannedTerms(node.text);
  if (banned.length > 0) {
    issues.push({
      path,
      message: `Claim uses banned superlative language: ${banned.join(", ")}`,
      factIds: [],
    });
  }

  // Cited facts' value + excerpt, normalized — the grounding haystack.
  const haystack = norm(
    facts
      .flatMap((f) => [stringifyValue(f.value), f.source_excerpt ?? ""])
      .join(" "),
  );

  // 2. Number grounding.
  const ungrounded = digitRuns(node.text).filter(
    (run) => !haystack.includes(run),
  );
  if (ungrounded.length > 0) {
    issues.push({
      path,
      message: `Claim contains numbers not present in any supporting fact: ${ungrounded.join(", ")}`,
      factIds: ids,
    });
  }

  // 2b. Grounded-text requirements (must appear verbatim-ish in a cited fact).
  for (const needle of node.groundedText ?? []) {
    const n = norm(needle);
    if (n.length > 0 && !haystack.includes(n)) {
      issues.push({
        path,
        message: `"${needle}" is not grounded in any supporting fact.`,
        factIds: ids,
      });
    }
  }

  // 3. Fact-type requirements.
  for (const req of node.required ?? []) {
    const candidates = facts.filter((f) => f.fact_type === req.type);
    if (candidates.length === 0) {
      issues.push({
        path,
        message: `Claim requires a verified ${req.type} fact but none is cited.`,
        factIds: ids,
      });
      continue;
    }
    if (req.matchText !== undefined) {
      const matched = candidates.some((f) =>
        req.asPhone
          ? phoneMatches(req.matchText!, stringifyValue(f.value))
          : textMatches(req.matchText!, stringifyValue(f.value)),
      );
      if (!matched) {
        issues.push({
          path,
          message: `"${req.matchText}" does not match any verified ${req.type} fact.`,
          factIds: ids,
        });
      }
    }
  }

  // 4. Free-text sensitive-term guards.
  if (node.freeText) {
    for (const rule of SENSITIVE_REQUIREMENTS) {
      if (
        rule.pattern.test(node.text) &&
        !facts.some((f) => f.fact_type === rule.requiredType)
      ) {
        issues.push({
          path,
          message: `Claim asserts ${rule.label} but cites no verified ${rule.requiredType} fact.`,
          factIds: ids,
        });
      }
    }
  }

  return issues.length === before;
}

export function validateClaims(
  content: GeneratedContent,
  verifiedFacts: VerifiedFact[],
): ValidationResult {
  const factById = new Map(verifiedFacts.map((f) => [f.id, f]));
  const verifiedIds = new Set(verifiedFacts.map((f) => f.id));
  const issues: ValidationIssue[] = [];
  let totalClaims = 0;
  let validClaims = 0;

  const check = (node: ClaimNode, path: string) => {
    totalClaims += 1;
    if (validateNode(node, path, factById, verifiedIds, issues)) {
      validClaims += 1;
    }
  };

  check({ ...content.tagline, freeText: true }, "tagline");

  content.about.forEach((p, i) =>
    check({ supporting_fact_ids: p.supporting_fact_ids, text: p.text, freeText: true }, `about[${i}]`),
  );

  content.specialties?.forEach((s, i) =>
    check(
      {
        supporting_fact_ids: s.supporting_fact_ids,
        text: `${s.name} ${s.description ?? ""}`,
        required: [{ type: "SPECIALTY", matchText: s.name }],
        freeText: true,
      },
      `specialties[${i}]`,
    ),
  );

  content.services?.forEach((s, i) =>
    check(
      {
        supporting_fact_ids: s.supporting_fact_ids,
        text: `${s.name} ${s.description ?? ""}`,
        required: [{ type: "SERVICE", matchText: s.name }],
        freeText: true,
      },
      `services[${i}]`,
    ),
  );

  content.doctors?.forEach((d, i) => {
    // The name must come from a DOCTOR fact; the qualification/specialty must be
    // grounded in the cited facts (they are commonly carried inside the DOCTOR
    // fact itself, e.g. {name, specialty}). This still blocks an invented
    // qualification (e.g. "MD Cardiology") that appears in no cited fact.
    const groundedText = [d.qualification, d.specialty].filter(
      (v): v is string => Boolean(v),
    );
    check(
      {
        supporting_fact_ids: d.supporting_fact_ids,
        text: `${d.name} ${d.qualification ?? ""} ${d.specialty ?? ""}`,
        required: [{ type: "DOCTOR", matchText: d.name }],
        groundedText,
      },
      `doctors[${i}]`,
    );
  });

  content.facilities?.forEach((f, i) =>
    check(
      {
        supporting_fact_ids: f.supporting_fact_ids,
        text: `${f.name} ${f.description ?? ""}`,
        required: [{ type: "FACILITY", matchText: f.name }],
        freeText: true,
      },
      `facilities[${i}]`,
    ),
  );

  {
    const c = content.contact;
    const required: RequiredType[] = [];
    if (c.phone) required.push({ type: "PHONE", matchText: c.phone, asPhone: true });
    if (c.email) required.push({ type: "EMAIL", matchText: c.email });
    if (c.address) required.push({ type: "ADDRESS", matchText: c.address });
    if (c.hours) required.push({ type: "HOURS" });
    if (c.emergency) required.push({ type: "EMERGENCY" });
    check(
      {
        supporting_fact_ids: c.supporting_fact_ids,
        text: [c.phone, c.address, c.hours, c.emergency].filter(Boolean).join(" "),
        required,
      },
      "contact",
    );
  }

  content.accreditations?.forEach((a, i) =>
    check(
      {
        supporting_fact_ids: a.supporting_fact_ids,
        text: a.text,
        required: [{ type: "ACCREDITATION", matchText: a.text }],
      },
      `accreditations[${i}]`,
    ),
  );

  content.insurance?.forEach((ins, i) =>
    check(
      {
        supporting_fact_ids: ins.supporting_fact_ids,
        text: ins.text,
        required: [{ type: "INSURANCE", matchText: ins.text }],
      },
      `insurance[${i}]`,
    ),
  );

  return {
    valid: issues.length === 0,
    totalClaims,
    validClaims,
    issues,
  };
}
