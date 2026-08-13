/**
 * Specialty normalization (Sections 10–11). Preserves the source label verbatim,
 * derives a clean display label via a GENERIC medical dictionary + common
 * spelling fixes (no hospital-specific table), and computes a prominence score.
 * Unknown specialties remain representable (known=false), never dropped.
 */

import { collapseWs, titleCaseLabel } from "@/lib/normalize/text";

// Generic medical-term spelling corrections (common misspellings, not
// hospital-specific). Applied word-wise, case-insensitively.
const SPELLING_FIXES: Record<string, string> = {
  replacament: "replacement",
  replacment: "replacement",
  anhesia: "anaesthesia",
  anesthesia: "anaesthesia",
  gynacology: "gynaecology",
  gynecology: "gynaecology",
  opthalmology: "ophthalmology",
  ophthalmologist: "ophthalmology",
  orthopaedics: "orthopaedic",
  paediatric: "paediatric",
  pediatric: "paediatric",
  neonatalogy: "neonatology",
};

// Canonical specialties for the `known` flag (lowercased, spelling-fixed forms).
const KNOWN_SPECIALTIES = new Set([
  "cardiology",
  "neurology",
  "neurosurgery",
  "orthopaedic",
  "orthopaedics",
  "joint replacement",
  "arthroscopy",
  "spine",
  "trauma",
  "general surgery",
  "general medicine",
  "urology",
  "nephrology",
  "gastroenterology",
  "surgical gastroenterology",
  "medical gastroenterology",
  "oncology",
  "orthopaedic oncology",
  "haematology",
  "dermatology",
  "psychiatry",
  "psychiatrist",
  "pulmonology",
  "physiotherapy",
  "physicians",
  "obstetrics & gynaecology",
  "gynaecology",
  "ophthalmology",
  "ear nose throat",
  "ent",
  "plastic surgery",
  "vascular surgery",
  "rhinoplasty",
  "rheumatology",
  "rheumatologist",
  "endocrinology",
  "paediatric surgery",
  "paediatric ortho",
  "hand & microvascular",
  "pain & palliative",
  "critical care",
  "anaesthesia",
  "radiology",
]);

function applySpellingFixes(label: string): string {
  return collapseWs(label)
    .split(/\s+/)
    .map((w) => {
      const key = w.toLowerCase().replace(/[^a-z&]/g, "");
      return SPELLING_FIXES[key] ? w.replace(new RegExp(key, "i"), SPELLING_FIXES[key]) : w;
    })
    .join(" ");
}

export type NormalizedSpecialtyLabel = {
  source_label: string;
  display_label: string;
  known: boolean;
};

export function normalizeSpecialtyLabel(sourceLabel: string): NormalizedSpecialtyLabel {
  const source = collapseWs(sourceLabel);
  const fixed = applySpellingFixes(source);
  const display = titleCaseLabel(fixed);
  const known = KNOWN_SPECIALTIES.has(fixed.toLowerCase());
  return { source_label: source, display_label: display, known };
}

export type ProminenceInputs = {
  personCount: number;
  dedicatedDepartmentPage: boolean;
  dedicatedFacility: boolean;
  homepageOrMetaMention: boolean;
};

/** Prominence signal (higher = more prominent). Value only — no ordering here. */
export function computeProminence(i: ProminenceInputs): number {
  return (
    i.personCount * 2 +
    (i.dedicatedDepartmentPage ? 3 : 0) +
    (i.dedicatedFacility ? 2 : 0) +
    (i.homepageOrMetaMention ? 1 : 0)
  );
}
