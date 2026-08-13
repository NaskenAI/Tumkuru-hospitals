/**
 * Allowlist of NASKEN_HOSPITAL_V1 component types (plain module, server-safe).
 * The Puck config must stay in sync with this list; the builder emits only these.
 */
export const HOSPITAL_V1_COMPONENT_TYPES = [
  "HospitalNavbar",
  "HospitalHero",
  "QuickPatientActions",
  "EmergencyBar",
  "TrustSignals",
  "SpecialtiesSection",
  "FacilitiesSection",
  "DoctorsByGroup",
  "AboutHospital",
  "FounderProfile",
  "MilestoneTimeline",
  "AccreditationStrip",
  "InsurancePanel",
  "PatientInformation",
  "AppointmentCTA",
  "ContactLocation",
  "HospitalFooter",
] as const;

export type HospitalV1ComponentType = (typeof HOSPITAL_V1_COMPONENT_TYPES)[number];
