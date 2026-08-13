import { describe, expect, it } from "vitest";

import { approvedAssetsForLead } from "@/lib/assets/select";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  classification: string;
  quality_score: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
};

// Minimal supabase stand-in: the query filters approval + orders by quality;
// here we hand it the already-approved, quality-desc rows and verify selection.
function fakeSupabase(rows: Row[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: rows }),
  };
  return { from: () => chain } as unknown as ReturnType<
    typeof createSupabaseServiceClient
  >;
}

const ROWS: Row[] = [
  { id: "hero1", classification: "HERO", quality_score: 88, width: 1024, height: 664, alt_text: "clinic" },
  { id: "ext1", classification: "HOSPITAL_EXTERIOR", quality_score: 88, width: 1024, height: 533, alt_text: "building" },
  { id: "doc1", classification: "DOCTOR", quality_score: 92, width: 600, height: 600, alt_text: "Dr X" },
  { id: "fac1", classification: "FACILITY", quality_score: 90, width: 1024, height: 768, alt_text: "ICU" },
  { id: "logo1", classification: "LOGO", quality_score: 80, width: 1024, height: 456, alt_text: null },
  { id: "gal1", classification: "GALLERY", quality_score: 80, width: 768, height: 768, alt_text: "misc" },
];

describe("approved asset selection", () => {
  it("selects a logo, a real hero photo, and a real photo band", async () => {
    const a = await approvedAssetsForLead(fakeSupabase(ROWS), "lead");
    expect(a.logoUrl).toBe("/api/assets/logo1");
    expect(a.heroUrl).toBe("/api/assets/hero1");
    expect(a.photos.map((p) => p.url)).toEqual(["/api/assets/ext1"]);
  });

  it("NEVER surfaces attributive imagery (doctor/facility) as hero or photos", async () => {
    const a = await approvedAssetsForLead(fakeSupabase(ROWS), "lead");
    const allUrls = [a.logoUrl, a.heroUrl, ...a.photos.map((p) => p.url)];
    expect(allUrls.some((u) => u?.includes("doc1"))).toBe(false);
    expect(allUrls.some((u) => u?.includes("fac1"))).toBe(false);
    // GALLERY (non-landscape-photo class) is also not used in the photo band.
    expect(a.photos.some((p) => p.url.includes("gal1"))).toBe(false);
  });

  it("returns empty when no approved assets exist", async () => {
    const a = await approvedAssetsForLead(fakeSupabase([]), "lead");
    expect(a.logoUrl).toBeUndefined();
    expect(a.heroUrl).toBeUndefined();
    expect(a.photos).toEqual([]);
  });

  it("all URLs go through the same-origin asset proxy", async () => {
    const a = await approvedAssetsForLead(fakeSupabase(ROWS), "lead");
    const allUrls = [a.logoUrl, a.heroUrl, ...a.photos.map((p) => p.url)].filter(
      Boolean,
    ) as string[];
    expect(allUrls.every((u) => u.startsWith("/api/assets/"))).toBe(true);
  });
});
