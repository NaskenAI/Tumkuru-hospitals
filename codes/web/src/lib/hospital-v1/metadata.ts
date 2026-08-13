/**
 * Puck metadata contract for NASKEN_HOSPITAL_V1. Components read the normalized
 * model + eligibility from here — never raw HTML, never re-parsed facts.
 */

import type { SectionEligibility } from "@/lib/normalize/eligibility";
import type { NormalizedHospital } from "@/lib/normalize/model";
import type { Lang } from "@/lib/hospital-v1/strings";

export type HospitalV1Meta = {
  model: NormalizedHospital;
  eligibility: SectionEligibility;
  lang: Lang;
  slug: string;
};

type PuckLike = { metadata?: Record<string, unknown> } | undefined;

export function hospitalMeta(puck: PuckLike): HospitalV1Meta | null {
  const m = puck?.metadata as Partial<HospitalV1Meta> | undefined;
  if (!m || !m.model || !m.eligibility) return null;
  return {
    model: m.model,
    eligibility: m.eligibility,
    lang: (m.lang as Lang) ?? "en",
    slug: (m.slug as string) ?? "",
  };
}

/** Dev-only fail-closed warning when an optional ref cannot be resolved. */
export function warnMissing(ref: string, kind: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[hospital-v1] omitting ${kind} — unresolved/unsafe ref: ${ref}`);
  }
}
