"use client";

import { Render, type Data } from "@measured/puck";

import type { SectionEligibility } from "@/lib/normalize/eligibility";
import type { NormalizedHospital } from "@/lib/normalize/model";
import { hospitalV1Config } from "@/lib/hospital-v1/config";
import type { Lang } from "@/lib/hospital-v1/strings";

/**
 * Public, read-only render of NASKEN_HOSPITAL_V1. The normalized model +
 * eligibility are passed as metadata; components read facts from there.
 */
export function HospitalV1Render({
  data,
  model,
  eligibility,
  lang,
  slug,
}: {
  data: Data;
  model: NormalizedHospital;
  eligibility: SectionEligibility;
  lang: Lang;
  slug: string;
}) {
  return <Render config={hospitalV1Config} data={data} metadata={{ model, eligibility, lang, slug }} />;
}
