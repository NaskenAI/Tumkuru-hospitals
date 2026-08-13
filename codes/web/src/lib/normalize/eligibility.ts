/**
 * Deterministic section eligibility (Section 16) computed over the normalized
 * model ONLY. Task 2's template must consume these verdicts, not invent sections.
 * Safety rules win over target counts (Sections 17–18): a section is eligible
 * only when the underlying data safely supports it.
 */

import { isPubliclyEligible } from "@/lib/normalize/assets";
import type { NormalizedHospital } from "@/lib/normalize/model";

export type SectionVerdict = {
  eligible: boolean;
  reason: string;
  count?: number;
  extra?: Record<string, number | string>;
};
export type SectionEligibility = Record<string, SectionVerdict>;

/** Facilities safe to name (real caption, patient-relevant). */
function nameableFacilities(m: NormalizedHospital) {
  return m.facilities.filter(
    (f) => f.patient_relevance >= 2 && f.caption_source !== "filename" && f.caption_source !== "none",
  );
}

export function computeSectionEligibility(m: NormalizedHospital): SectionEligibility {
  const doctors = m.people.doctors;
  const publicPortraits = m.assets.filter(
    (a) => a.classification === "PORTRAIT" && isPubliclyEligible(a.approval_state) && a.subject_ref,
  );
  const approvedPhotoPct = doctors.length ? Math.round((publicPortraits.length / doctors.length) * 100) : 0;
  const nameable = nameableFacilities(m);
  const heldAccreditations = m.accreditations.filter((a) => a.status === "HELD");
  const confirmedInsurers = m.insurers.filter((i) => i.human_confirmed);
  const datedMilestones = m.narrative.milestones.filter((x) => x.date.year);

  return {
    EmergencyBar: m.emergency.available === true
      ? { eligible: true, reason: "approved emergency statement present" }
      : { eligible: false, reason: "no explicit emergency evidence" },

    FacilitiesGrid: {
      eligible: nameable.length >= 3,
      count: nameable.length,
      reason:
        nameable.length >= 3
          ? `${nameable.length} patient-relevant facilities with a real (non-filename) caption`
          : `only ${nameable.length} safely-nameable facilities (need >=3)`,
    },

    DoctorsByGroup: {
      eligible: doctors.length > 0,
      count: doctors.length,
      reason: doctors.length > 0 ? "clinicians grouped by specialty" : "no clinicians",
    },

    DoctorPhotoCards: {
      eligible: doctors.length > 0 && approvedPhotoPct >= 60,
      reason:
        `${approvedPhotoPct}% of clinicians have a publicly-approved, associated portrait ` +
        `(need >=60%) — fall back to DoctorsByGroup`,
      extra: { approvedPhotoPercentage: approvedPhotoPct, publicPortraits: publicPortraits.length },
    },

    SpecialtiesGrid: {
      eligible: m.specialties.length >= 3,
      count: m.specialties.length,
      reason: m.specialties.length >= 3 ? `${m.specialties.length} specialties` : "too few specialties",
    },

    InsurancePanel: {
      eligible: confirmedInsurers.length >= 1,
      count: confirmedInsurers.length,
      reason:
        confirmedInsurers.length >= 1
          ? `${confirmedInsurers.length} human-confirmed insurers`
          : "no human-confirmed insurers (filename-derived logos are not proof of a tie-up)",
    },

    AppointmentCTA: m.appointment.channel !== "none"
      ? { eligible: true, reason: `explicit appointment channel: ${m.appointment.channel}` }
      : { eligible: false, reason: "no explicit appointment channel (phone is not an appointment path)" },

    MilestoneTimeline: {
      eligible: datedMilestones.length >= 2,
      count: datedMilestones.length,
      reason: datedMilestones.length >= 2 ? `${datedMilestones.length} dated events` : "too few dated events",
    },

    FounderProfile: m.narrative.founder
      ? { eligible: true, reason: `founder: ${m.narrative.founder.name}` }
      : { eligible: false, reason: "no founder evidence" },

    AccreditationStrip: {
      eligible: heldAccreditations.length >= 1,
      count: heldAccreditations.length,
      reason:
        heldAccreditations.length >= 1
          ? `${heldAccreditations.length} HELD accreditation(s)`
          : "no HELD accreditation (APPLIED does not enable a badge)",
    },
  };
}
