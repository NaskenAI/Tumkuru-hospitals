/**
 * The hospital's APPROVED, validated content is threaded to every Puck
 * component through Puck's `metadata` (works in both <Render> and the editor
 * iframe). Puck component PROPS carry only presentation — never facts — so
 * layout editing can never introduce or alter factual copy.
 */

import type { GeneratedContent } from "@/lib/content/content-schema";
import type { HospitalTheme } from "@/lib/puck/theme";

export type HospitalLang = "en" | "kn";

/**
 * Approved, first-party image assets selected for display. URLs point at the
 * same-origin asset proxy (/api/assets/[id]), never at third-party hosts.
 * Attributive imagery (specific doctors/facilities) is excluded here until a
 * human approves it, so a mismatched photo can never imply a false claim.
 */
export type HospitalAssets = {
  logoUrl?: string;
  heroUrl?: string;
  photos: { url: string; alt: string | null }[];
};

export type HospitalMetadata = {
  /** Approved + claim-validated content for the ACTIVE language. */
  content: GeneratedContent;
  lang: HospitalLang;
  slug: string;
  assets: HospitalAssets;
  theme: HospitalTheme;
};

type PuckLike = { metadata?: Record<string, unknown> } | undefined;

/** Read the approved hospital content from Puck metadata. */
export function hospitalFromPuck(puck: PuckLike): HospitalMetadata | null {
  const m = puck?.metadata as Partial<HospitalMetadata> | undefined;
  if (!m || !m.content) return null;
  return {
    content: m.content,
    lang: (m.lang as HospitalLang) ?? "en",
    slug: (m.slug as string) ?? "",
    assets: m.assets ?? { photos: [] },
    theme: (m.theme as HospitalTheme) ?? "MODERN_CLINICAL",
  };
}

export function initials(name: string): string {
  return name
    .replace(/^dr\.?\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
