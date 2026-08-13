"use client";

import type { Config } from "@measured/puck";

import * as S from "@/components/puck/sections";
import { themeVars, type HospitalTheme } from "@/lib/puck/theme";

/**
 * Puck component registry. Every field here is PRESENTATION ONLY (variant).
 * There are deliberately NO factual text fields — factual copy is read from the
 * approved content via Puck metadata, so layout editing can never introduce or
 * alter facts. Components self-hide when their supporting data is absent.
 */
export type HospitalComponentProps = {
  HospitalNavbar: Record<string, never>;
  HospitalHero: { variant: "split" | "image-overlay" | "minimal" };
  EmergencyStrip: Record<string, never>;
  QuickActions: Record<string, never>;
  SpecialtyGrid: { variant: "cards" | "compact" | "icon-grid" };
  HospitalGallery: Record<string, never>;
  DoctorGrid: { variant: "cards" | "compact-list" | "featured-first" };
  AboutHospital: { variant: "editorial" | "image-split" | "centered" };
  StatsSection: Record<string, never>;
  AccreditationSection: Record<string, never>;
  InsuranceSection: Record<string, never>;
  AppointmentCTA: Record<string, never>;
  ContactSection: { variant: "cards" | "split" };
  MapOrDirectionsSection: Record<string, never>;
  HospitalFooter: Record<string, never>;
};

const variantField = (
  options: Array<{ label: string; value: string }>,
) =>
  ({
    variant: { type: "select" as const, label: "Variant", options },
  });

export const hospitalPuckConfig: Config<HospitalComponentProps> = {
  root: {
    // The active theme is applied here as CSS variables; every brand-colored
    // surface below reads them. Theme changes palette only — never structure
    // or facts.
    render: ({ children, puck }) => {
      const theme =
        ((puck?.metadata as { theme?: HospitalTheme } | undefined)?.theme) ??
        "MODERN_CLINICAL";
      return (
        <div className="bg-white" style={themeVars(theme)}>
          {children}
        </div>
      );
    },
  },
  components: {
    HospitalNavbar: { render: ({ puck }) => <S.HospitalNavbar puck={puck} /> },

    HospitalHero: {
      fields: variantField([
        { label: "Split", value: "split" },
        { label: "Image overlay", value: "image-overlay" },
        { label: "Minimal", value: "minimal" },
      ]),
      defaultProps: { variant: "split" },
      render: ({ variant, puck }) => <S.HospitalHero variant={variant} puck={puck} />,
    },

    EmergencyStrip: { render: ({ puck }) => <S.EmergencyStrip puck={puck} /> },
    QuickActions: { render: ({ puck }) => <S.QuickActions puck={puck} /> },

    SpecialtyGrid: {
      fields: variantField([
        { label: "Cards", value: "cards" },
        { label: "Compact", value: "compact" },
        { label: "Icon grid", value: "icon-grid" },
      ]),
      defaultProps: { variant: "cards" },
      render: ({ variant, puck }) => <S.SpecialtyGrid variant={variant} puck={puck} />,
    },

    HospitalGallery: { render: ({ puck }) => <S.HospitalGallery puck={puck} /> },

    DoctorGrid: {
      fields: variantField([
        { label: "Cards", value: "cards" },
        { label: "Compact list", value: "compact-list" },
        { label: "Featured first", value: "featured-first" },
      ]),
      defaultProps: { variant: "cards" },
      render: ({ variant, puck }) => <S.DoctorGrid variant={variant} puck={puck} />,
    },

    AboutHospital: {
      fields: variantField([
        { label: "Editorial", value: "editorial" },
        { label: "Image split", value: "image-split" },
        { label: "Centered", value: "centered" },
      ]),
      defaultProps: { variant: "editorial" },
      render: ({ variant, puck }) => <S.AboutHospital variant={variant} puck={puck} />,
    },

    StatsSection: { render: ({ puck }) => <S.StatsSection puck={puck} /> },
    AccreditationSection: {
      render: ({ puck }) => <S.AccreditationSection puck={puck} />,
    },
    InsuranceSection: { render: ({ puck }) => <S.InsuranceSection puck={puck} /> },
    AppointmentCTA: { render: ({ puck }) => <S.AppointmentCTA puck={puck} /> },

    ContactSection: {
      fields: variantField([
        { label: "Cards", value: "cards" },
        { label: "Split", value: "split" },
      ]),
      defaultProps: { variant: "cards" },
      render: ({ variant, puck }) => <S.ContactSection variant={variant} puck={puck} />,
    },

    MapOrDirectionsSection: {
      render: ({ puck }) => <S.MapOrDirectionsSection puck={puck} />,
    },
    HospitalFooter: { render: ({ puck }) => <S.HospitalFooter puck={puck} /> },
  },
};
