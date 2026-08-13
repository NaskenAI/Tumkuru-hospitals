/**
 * NASKEN_HOSPITAL_V1_DEFAULT — the deterministic composition (Section 37).
 *
 *   buildHospitalV1(model, eligibility) → validated Puck Data
 *
 * Same input → same output. Sections are included only when the normalized
 * model + eligibility support them; selections (hero, specialties, facilities,
 * doctor groups) are references resolved fail-closed at render time.
 */

import type { Data } from "@measured/puck";

import type { SectionEligibility } from "@/lib/normalize/eligibility";
import type { NormalizedHospital } from "@/lib/normalize/model";
import { HOSPITAL_V1_COMPONENT_TYPES } from "@/lib/hospital-v1/component-types";
import {
  dedupeMilestonesForDisplay,
  selectAboutImage,
  selectDoctorGroups,
  selectFeaturedFacilities,
  selectFeaturedSpecialties,
  selectHero,
  selectTrustSignals,
} from "@/lib/hospital-v1/select";

type Node = { type: string; props: Record<string, unknown> };

export function buildHospitalV1(
  model: NormalizedHospital,
  eligibility: SectionEligibility,
): Data {
  const items: Node[] = [];
  const add = (type: string, props: Record<string, unknown> = {}) => items.push({ type, props });
  const on = (key: string) => Boolean(eligibility[key]?.eligible);

  add("HospitalNavbar");

  const hero = selectHero(model);
  add("HospitalHero", { variant: hero ? "image" : "no-image", heroAssetId: hero?.asset_id ?? null });

  add("QuickPatientActions");

  if (on("EmergencyBar")) add("EmergencyBar");
  if (selectTrustSignals(model).length >= 2) add("TrustSignals");

  if (on("SpecialtiesGrid")) {
    add("SpecialtiesSection", { specialtyLabels: selectFeaturedSpecialties(model, 6).map((s) => s.source_label) });
  }
  if (on("FacilitiesGrid")) {
    add("FacilitiesSection", { facilityRefs: selectFeaturedFacilities(model, 6).map((f) => f.facility_id) });
  }
  if (on("DoctorsByGroup")) {
    add("DoctorsByGroup", { groupLabels: selectDoctorGroups(model, 6, 6).map((g) => g.sourceLabel) });
  }

  if (model.narrative.about.length > 0) {
    add("AboutHospital", { aboutImageAssetId: selectAboutImage(model, hero?.asset_id)?.asset_id ?? null });
  }
  if (on("FounderProfile")) add("FounderProfile");
  if (on("MilestoneTimeline") && dedupeMilestonesForDisplay(model.narrative.milestones).kept.length >= 2) {
    add("MilestoneTimeline");
  }

  // These render ONLY when genuinely supported (HELD / human-confirmed).
  if (on("AccreditationStrip")) add("AccreditationStrip");
  if (on("InsurancePanel")) add("InsurancePanel");

  add("PatientInformation");
  if (on("AppointmentCTA")) add("AppointmentCTA");
  add("ContactLocation");
  add("HospitalFooter");

  const allowed = new Set<string>(HOSPITAL_V1_COMPONENT_TYPES as readonly string[]);
  const content = items
    .filter((it) => allowed.has(it.type))
    .map((it, i) => ({ type: it.type, props: { id: `${it.type}-${i}`, ...it.props } }));

  return { root: { props: {} }, content, zones: {} } as Data;
}
