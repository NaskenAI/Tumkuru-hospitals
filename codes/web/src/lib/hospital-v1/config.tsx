"use client";

import type { Config } from "@measured/puck";

import * as S from "@/components/hospital-v1/sections";

/**
 * NASKEN_HOSPITAL_V1 Puck registry. Props carry only presentation + normalized
 * entity REFERENCES; all factual content is read from the normalized model in
 * Puck metadata. Composition is produced deterministically by buildHospitalV1.
 */
export type HospitalV1Props = {
  HospitalNavbar: Record<string, never>;
  HospitalHero: { variant: "image" | "no-image"; heroAssetId: string | null };
  QuickPatientActions: Record<string, never>;
  EmergencyBar: Record<string, never>;
  TrustSignals: Record<string, never>;
  SpecialtiesSection: { specialtyLabels: string[] };
  FacilitiesSection: { facilityRefs: string[] };
  DoctorsByGroup: { groupLabels: string[] };
  AboutHospital: { aboutImageAssetId: string | null };
  FounderProfile: Record<string, never>;
  MilestoneTimeline: Record<string, never>;
  AccreditationStrip: Record<string, never>;
  InsurancePanel: Record<string, never>;
  PatientInformation: Record<string, never>;
  AppointmentCTA: Record<string, never>;
  ContactLocation: Record<string, never>;
  HospitalFooter: Record<string, never>;
};

export const hospitalV1Config: Config<HospitalV1Props> = {
  root: {
    render: ({ children }) => (
      <div id="top" className="bg-white text-slate-900 antialiased">
        {children}
      </div>
    ),
  },
  components: {
    HospitalNavbar: { render: ({ puck }) => <S.HospitalNavbar puck={puck} /> },
    HospitalHero: {
      defaultProps: { variant: "no-image", heroAssetId: null },
      render: ({ puck, variant, heroAssetId }) => (
        <S.HospitalHero puck={puck} variant={variant} heroAssetId={heroAssetId} />
      ),
    },
    QuickPatientActions: { render: ({ puck }) => <S.QuickPatientActions puck={puck} /> },
    EmergencyBar: { render: ({ puck }) => <S.EmergencyBar puck={puck} /> },
    TrustSignals: { render: ({ puck }) => <S.TrustSignals puck={puck} /> },
    SpecialtiesSection: {
      defaultProps: { specialtyLabels: [] },
      render: ({ puck, specialtyLabels }) => <S.SpecialtiesSection puck={puck} specialtyLabels={specialtyLabels} />,
    },
    FacilitiesSection: {
      defaultProps: { facilityRefs: [] },
      render: ({ puck, facilityRefs }) => <S.FacilitiesSection puck={puck} facilityRefs={facilityRefs} />,
    },
    DoctorsByGroup: {
      defaultProps: { groupLabels: [] },
      render: ({ puck, groupLabels }) => <S.DoctorsByGroup puck={puck} groupLabels={groupLabels} />,
    },
    AboutHospital: {
      defaultProps: { aboutImageAssetId: null },
      render: ({ puck, aboutImageAssetId }) => <S.AboutHospital puck={puck} aboutImageAssetId={aboutImageAssetId} />,
    },
    FounderProfile: { render: ({ puck }) => <S.FounderProfile puck={puck} /> },
    MilestoneTimeline: { render: ({ puck }) => <S.MilestoneTimeline puck={puck} /> },
    AccreditationStrip: { render: ({ puck }) => <S.AccreditationStrip puck={puck} /> },
    InsurancePanel: { render: ({ puck }) => <S.InsurancePanel puck={puck} /> },
    PatientInformation: { render: ({ puck }) => <S.PatientInformation puck={puck} /> },
    AppointmentCTA: { render: ({ puck }) => <S.AppointmentCTA puck={puck} /> },
    ContactLocation: { render: ({ puck }) => <S.ContactLocation puck={puck} /> },
    HospitalFooter: { render: ({ puck }) => <S.HospitalFooter puck={puck} /> },
  },
};
