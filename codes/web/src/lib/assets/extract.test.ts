import { describe, expect, it } from "vitest";

import { extractAssetsFromPage } from "@/lib/assets/extract";

const BASE = "https://h.example/";

describe("first-party asset extraction", () => {
  it("keeps first-party content images and filters junk/external/tiny", () => {
    const html = `
      <img src="https://h.example/wp-content/uploads/2024/ganga-logo.png" alt="Logo" width="200" height="60">
      <img src="https://h.example/wp-content/uploads/2024/hospital-hero-1600x900.jpg" alt="Expert care">
      <img src="https://h.example/wp-content/uploads/2024/building-exterior-1200x800.jpg" alt="Building">
      <img src="https://h.example/wp-content/uploads/2024/services-icon2.png" alt="service icon" width="40" height="40">
      <img src="https://h.example/wp-content/uploads/2024/spacer.gif">
      <img src="data:image/gif;base64,R0lGOD">
      <img src="https://cdn.other-domain.com/promo.jpg" alt="external">
      <img src="https://h.example/wp-content/uploads/2024/decorative.svg">
    `;
    const assets = extractAssetsFromPage(html, BASE, "HOME");
    const urls = assets.map((a) => a.originalAssetUrl.split("/").pop());
    expect(urls.sort()).toEqual([
      "building-exterior-1200x800.jpg",
      "ganga-logo.png",
      "hospital-hero-1600x900.jpg",
    ]);
    // junk/external/data/svg/icon all excluded
    expect(assets.some((a) => /icon|spacer|external|other-domain|\.svg/.test(a.originalAssetUrl))).toBe(false);
  });

  it("classifies by filename + dimensions", () => {
    const assets = extractAssetsFromPage(
      `<img src="https://h.example/x/logo.png" alt="l" width="180" height="60">
       <img src="https://h.example/x/hospital-hero-1600x900.jpg" alt="hero">
       <img src="https://h.example/x/exterior-1200x800.jpg" alt="Front">`,
      BASE,
      "HOME",
    );
    const byUrl = (n: string) => assets.find((a) => a.originalAssetUrl.includes(n));
    expect(byUrl("logo")?.classification).toBe("LOGO");
    expect(byUrl("hero")?.classification).toBe("HERO");
    expect(byUrl("exterior")?.classification).toBe("HOSPITAL_EXTERIOR");
    // Hero (large) outranks logo (small) on quality.
    expect(byUrl("hero")!.qualityScore).toBeGreaterThan(byUrl("logo")!.qualityScore);
  });

  it("uses page context to classify a doctor image", () => {
    const assets = extractAssetsFromPage(
      `<img src="https://h.example/team/dr-vijay-600x600.jpg" alt="Dr. Vijay">`,
      "https://h.example/doctors/",
      "DOCTORS",
    );
    expect(assets[0].classification).toBe("DOCTOR");
  });

  it("does not treat a tiny image as usable", () => {
    const assets = extractAssetsFromPage(
      `<img src="https://h.example/x/thumb-40x40.jpg" width="40" height="40">`,
      BASE,
      "HOME",
    );
    expect(assets).toHaveLength(0);
  });
});
