/**
 * Nasken design-system themes (Phase I). Each theme is a set of CSS custom
 * properties applied on the page root; brand-colored surfaces read them via
 * `var(--brand…)`. Layout/structure is identical across themes — only the
 * palette changes — so a theme choice can never alter facts or structure.
 */

import type { CSSProperties } from "react";

import type { GeneratedContent } from "@/lib/content/content-schema";

export type HospitalTheme =
  | "MODERN_CLINICAL"
  | "COMMUNITY"
  | "PREMIUM_SPECIALTY";

export const HOSPITAL_THEMES: readonly HospitalTheme[] = [
  "MODERN_CLINICAL",
  "COMMUNITY",
  "PREMIUM_SPECIALTY",
] as const;

type ThemeTokens = {
  brand: string;
  brandStrong: string;
  brand050: string;
  brand100: string;
  onBrand: string;
  accent: string;
  heroFrom: string;
  heroTo: string;
};

const TOKENS: Record<HospitalTheme, ThemeTokens> = {
  // Teal — clean, clinical, trustworthy.
  MODERN_CLINICAL: {
    brand: "#0f766e",
    brandStrong: "#115e59",
    brand050: "#f0fdfa",
    brand100: "#ccfbf1",
    onBrand: "#ffffff",
    accent: "#0891b2",
    heroFrom: "#0f766e",
    heroTo: "#134e4a",
  },
  // Emerald + warmth — approachable, community-focused.
  COMMUNITY: {
    brand: "#047857",
    brandStrong: "#065f46",
    brand050: "#ecfdf5",
    brand100: "#d1fae5",
    onBrand: "#ffffff",
    accent: "#d97706",
    heroFrom: "#047857",
    heroTo: "#064e3b",
  },
  // Deep navy + gold — premium super-specialty.
  PREMIUM_SPECIALTY: {
    brand: "#1e3a5f",
    brandStrong: "#152c49",
    brand050: "#f1f5f9",
    brand100: "#dbe4ee",
    onBrand: "#ffffff",
    accent: "#c59d5f",
    heroFrom: "#1e3a5f",
    heroTo: "#0f1f33",
  },
};

/** CSS custom properties for a theme, to spread onto the root element style. */
export function themeVars(theme: HospitalTheme): CSSProperties {
  const t = TOKENS[theme] ?? TOKENS.MODERN_CLINICAL;
  return {
    "--brand": t.brand,
    "--brand-strong": t.brandStrong,
    "--brand-050": t.brand050,
    "--brand-100": t.brand100,
    "--on-brand": t.onBrand,
    "--accent": t.accent,
    "--hero-from": t.heroFrom,
    "--hero-to": t.heroTo,
  } as CSSProperties;
}

/**
 * Deterministic theme pick from approved content (no LLM). A broad
 * super-specialty roster reads as PREMIUM; a focused clinic with an emergency
 * line reads as CLINICAL; everything else as COMMUNITY. Structure is unchanged
 * either way, so this only affects palette.
 */
export function chooseTheme(content: GeneratedContent): HospitalTheme {
  const specialties = content.specialties?.length ?? 0;
  const doctors = content.doctors?.length ?? 0;
  if (specialties >= 5 || doctors >= 4) return "PREMIUM_SPECIALTY";
  if (content.contact.emergency) return "MODERN_CLINICAL";
  return "COMMUNITY";
}
