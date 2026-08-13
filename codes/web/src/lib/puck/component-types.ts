/**
 * Allowlist of Puck component types (plain module — safe to import from server
 * code without pulling the client Puck config/JSX). The Puck config must stay
 * in sync with this list.
 */
export const HOSPITAL_COMPONENT_TYPES = [
  "HospitalNavbar",
  "HospitalHero",
  "EmergencyStrip",
  "QuickActions",
  "SpecialtyGrid",
  "HospitalGallery",
  "DoctorGrid",
  "AboutHospital",
  "StatsSection",
  "AccreditationSection",
  "InsuranceSection",
  "AppointmentCTA",
  "ContactSection",
  "MapOrDirectionsSection",
  "HospitalFooter",
] as const;

export type HospitalComponentType = (typeof HOSPITAL_COMPONENT_TYPES)[number];
