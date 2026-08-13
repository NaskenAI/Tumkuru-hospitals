/**
 * Selects APPROVED first-party imagery for the render (Phase I wiring).
 *
 * Only APPROVED assets are eligible, and only non-attributive classes
 * (logo/hero/building) are used for the logo/hero + a real-photo band. Doctor,
 * facility, department and insurance imagery are deliberately excluded here:
 * they assert something about a named person or specific capability and stay
 * PENDING until a human confirms the match. All URLs go through the same-origin
 * asset proxy.
 */

import type { HospitalAssets } from "@/lib/puck/metadata";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

const PHOTO_CLASSES = new Set(["HERO", "HOSPITAL_EXTERIOR", "HOSPITAL_INTERIOR"]);

export async function approvedAssetsForLead(
  supabase: ServiceClient,
  leadId: string,
): Promise<HospitalAssets> {
  const { data } = await supabase
    .from("hospital_assets")
    .select("id,classification,quality_score,width,height,alt_text")
    .eq("lead_id", leadId)
    .eq("approval_status", "APPROVED")
    .order("quality_score", { ascending: false });

  const assets = data ?? [];
  const proxy = (id: string) => `/api/assets/${id}`;
  const isLandscapePhoto = (a: (typeof assets)[number]) =>
    PHOTO_CLASSES.has(a.classification) &&
    (a.width ?? 0) >= 800 &&
    (a.width ?? 0) >= (a.height ?? 0);

  const logo = assets.find((a) => a.classification === "LOGO" && (a.width ?? 0) >= 200)
    ?? assets.find((a) => a.classification === "LOGO");

  // Hero: best real landscape building/hero photo.
  const hero = assets.filter(isLandscapePhoto)[0];

  // Photo band: other real photos, excluding the hero, deduped, capped.
  const photos = assets
    .filter(isLandscapePhoto)
    .filter((a) => a.id !== hero?.id)
    .slice(0, 6)
    .map((a) => ({ url: proxy(a.id), alt: a.alt_text }));

  return {
    logoUrl: logo ? proxy(logo.id) : undefined,
    heroUrl: hero ? proxy(hero.id) : undefined,
    photos,
  };
}
