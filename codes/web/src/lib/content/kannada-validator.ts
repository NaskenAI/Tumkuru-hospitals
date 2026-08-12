/**
 * Deterministic Kannada validation (P0-5).
 *
 * Translation is an LLM step, so before a bilingual preview can deploy we prove
 * — in TypeScript, not by trusting the model — that the Kannada content:
 *   1. mirrors the English structure (same sections, same array lengths);
 *   2. preserves every supporting_fact_id exactly (so claim grounding carries
 *      over from the already-approved English);
 *   3. preserves proper nouns (hospital name, doctor names) and all
 *      numbers/contact details (phone, email, digit sequences) unchanged.
 *
 * Any drift blocks deployment.
 */

import type { GeneratedContent } from "@/lib/content/content-schema";

export type KannadaValidationIssue = {
  path: string;
  message: string;
};

export type KannadaValidationResult = {
  valid: boolean;
  issues: KannadaValidationIssue[];
};

type FactCarrier = { supporting_fact_ids?: string[] };

function idsEqual(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

function digitRuns(value: string): string[] {
  return value.match(/\d+/g) ?? [];
}

function missingNumbers(enText: string, knText: string): string[] {
  const knRuns = new Set(digitRuns(knText));
  return digitRuns(enText).filter((run) => !knRuns.has(run));
}

function checkFactIds(
  en: FactCarrier,
  kn: FactCarrier,
  path: string,
  verifiedFactIds: Set<string>,
  issues: KannadaValidationIssue[],
): void {
  if (!idsEqual(en.supporting_fact_ids, kn.supporting_fact_ids)) {
    issues.push({
      path,
      message: "supporting_fact_ids were not preserved from English.",
    });
    return;
  }
  const unverified = (kn.supporting_fact_ids ?? []).filter(
    (id) => !verifiedFactIds.has(id),
  );
  if (unverified.length > 0) {
    issues.push({
      path,
      message: `references unverified fact IDs: ${unverified.join(", ")}`,
    });
  }
}

function checkNumbers(
  enText: string,
  knText: string,
  path: string,
  issues: KannadaValidationIssue[],
): void {
  const missing = missingNumbers(enText, knText);
  if (missing.length > 0) {
    issues.push({
      path,
      message: `numbers dropped or altered in translation: ${missing.join(", ")}`,
    });
  }
}

function checkArray<EN extends FactCarrier, KN extends FactCarrier>(
  enArr: EN[] | undefined,
  knArr: KN[] | undefined,
  path: string,
  verifiedFactIds: Set<string>,
  issues: KannadaValidationIssue[],
  perItem?: (en: EN, kn: KN, itemPath: string) => void,
): void {
  const en = enArr ?? [];
  const kn = knArr ?? [];
  if (en.length !== kn.length) {
    issues.push({
      path,
      message: `section length mismatch: English has ${en.length}, Kannada has ${kn.length}.`,
    });
    return;
  }
  en.forEach((enItem, i) => {
    const knItem = kn[i];
    const itemPath = `${path}[${i}]`;
    checkFactIds(enItem, knItem, itemPath, verifiedFactIds, issues);
    perItem?.(enItem, knItem, itemPath);
  });
}

export function validateKannada(
  english: GeneratedContent,
  kannada: GeneratedContent,
  verifiedFactIds: string[],
): KannadaValidationResult {
  const verified = new Set(verifiedFactIds);
  const issues: KannadaValidationIssue[] = [];

  // Hospital name is a proper noun — must be preserved verbatim.
  if (english.hospital_name.trim() !== kannada.hospital_name.trim()) {
    issues.push({
      path: "hospital_name",
      message: `hospital name must be preserved exactly ("${english.hospital_name}" != "${kannada.hospital_name}").`,
    });
  }

  // Tagline
  checkFactIds(english.tagline, kannada.tagline, "tagline", verified, issues);
  checkNumbers(
    english.tagline.text,
    kannada.tagline?.text ?? "",
    "tagline",
    issues,
  );

  // About
  checkArray(
    english.about,
    kannada.about,
    "about",
    verified,
    issues,
    (en, kn, p) => checkNumbers(en.text, kn.text, p, issues),
  );

  // Specialties / services / facilities (name + description carry numbers too)
  const namedSections = ["specialties", "services", "facilities"] as const;
  for (const key of namedSections) {
    checkArray(
      english[key],
      kannada[key],
      key,
      verified,
      issues,
      (en, kn, p) => {
        checkNumbers(
          `${en.name} ${en.description ?? ""}`,
          `${kn.name} ${kn.description ?? ""}`,
          p,
          issues,
        );
      },
    );
  }

  // Doctors — names must be preserved exactly.
  checkArray(
    english.doctors,
    kannada.doctors,
    "doctors",
    verified,
    issues,
    (en, kn, p) => {
      if (en.name.trim() !== kn.name.trim()) {
        issues.push({
          path: `${p}.name`,
          message: `doctor name must be preserved exactly ("${en.name}" != "${kn.name}").`,
        });
      }
      checkNumbers(
        `${en.qualification ?? ""}`,
        `${kn.qualification ?? ""}`,
        p,
        issues,
      );
    },
  );

  // Accreditations / insurance
  checkArray(
    english.accreditations,
    kannada.accreditations,
    "accreditations",
    verified,
    issues,
    (en, kn, p) => checkNumbers(en.text, kn.text, p, issues),
  );
  checkArray(
    english.insurance,
    kannada.insurance,
    "insurance",
    verified,
    issues,
    (en, kn, p) => checkNumbers(en.text, kn.text, p, issues),
  );

  // Contact — phone/email must be identical; all numbers preserved.
  checkFactIds(english.contact, kannada.contact, "contact", verified, issues);
  if ((english.contact.phone ?? "") !== (kannada.contact?.phone ?? "")) {
    issues.push({
      path: "contact.phone",
      message: "phone number must be preserved exactly.",
    });
  }
  if ((english.contact.email ?? "") !== (kannada.contact?.email ?? "")) {
    issues.push({
      path: "contact.email",
      message: "email must be preserved exactly.",
    });
  }
  checkNumbers(
    [
      english.contact.phone,
      english.contact.address,
      english.contact.hours,
      english.contact.emergency,
    ]
      .filter(Boolean)
      .join(" "),
    [
      kannada.contact?.phone,
      kannada.contact?.address,
      kannada.contact?.hours,
      kannada.contact?.emergency,
    ]
      .filter(Boolean)
      .join(" "),
    "contact",
    issues,
  );

  return { valid: issues.length === 0, issues };
}
