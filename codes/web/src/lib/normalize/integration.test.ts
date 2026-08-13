import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import {
  buildNormalizedHospitalFromRecords,
  type PersistedSourceRow,
} from "@/lib/normalize/integration";
import { parseNormalizedHospital } from "@/lib/normalize/model";
import type { PersistedAssetRow } from "@/lib/normalize/assets";
import { gangaHtml } from "@/lib/normalize/__fixtures__/ganga";

const GANGA: { name: Parameters<typeof gangaHtml>[0]; path: string; type: string }[] = [
  { name: "home", path: "/", type: "HOME" },
  { name: "team", path: "/our-team/", type: "DOCTORS" },
  { name: "departments", path: "/departments/", type: "DEPARTMENTS" },
  { name: "facilities", path: "/facilities/", type: "FACILITIES" },
  { name: "insurers", path: "/insurances-available/", type: "INSURANCE" },
  { name: "milestones", path: "/milestones/", type: "ABOUT" },
];

function gangaSourceRows(): PersistedSourceRow[] {
  return GANGA.map((p, i) => {
    const html = gangaHtml(p.name);
    const text = cheerio.load(html)("body").text();
    return {
      id: `src_${i}`,
      url: `https://gangahospitaltumkur.com${p.path}`,
      page_type: p.type,
      http_status: 200,
      raw_html: html,
      raw_text: text,
      content_hash: `hash_${p.name}`,
    };
  });
}

describe("live integration — persisted source rows → NormalizedHospital", () => {
  const { model } = buildNormalizedHospitalFromRecords(gangaSourceRows(), []);

  it("produces a schema-valid COMPLETE model from real persisted HTML", () => {
    expect(() => parseNormalizedHospital(model)).not.toThrow();
    expect(model.status).toBe("COMPLETE");
    expect(model.people.doctors.length).toBeGreaterThan(20);
    expect(model.specialties.length).toBeGreaterThan(10);
    expect(model.coverage.pagesSupplied).toBe(6);
    expect(model.coverage.pagesIgnored).toBe(0);
  });

  it("establishes the HOSPITAL (2024), not the predecessor clinic (2017)", () => {
    expect(model.established.entity).toBe("hospital");
    expect(model.established.value).toBe(2024);
    // 2017 survives only as predecessor-clinic milestone history
    expect(model.narrative.milestones.some((m) => m.date.year === 2017)).toBe(true);
  });

  it("normalizes the applied-for accreditation as APPLIED (never HELD)", () => {
    const applied = model.accreditations.filter((a) => a.status === "APPLIED");
    expect(applied.length).toBeGreaterThanOrEqual(1);
    expect(model.accreditations.some((a) => a.status === "HELD")).toBe(false);
  });

  it("normalized facts retain source provenance (tier <= 2, real URLs)", () => {
    const d = model.people.doctors[0];
    expect(d.evidence[0].sourceUrl).toContain("gangahospitaltumkur.com");
    expect(d.evidence[0].sourceTier).toBeLessThanOrEqual(2);
  });
});

describe("coverage — ignored vs failed distinction", () => {
  it("records low-content / blank / duplicate pages as ignored (not failed)", () => {
    const rows = gangaSourceRows();
    rows.push({ id: "blank", url: "https://h/x/", page_type: "OTHER", http_status: 200, raw_html: "   ", raw_text: "", content_hash: "blank" });
    rows.push({ id: "thin", url: "https://h/thin/", page_type: "OTHER", http_status: 200, raw_html: "<html><body><p>hi</p></body></html>", raw_text: "hi", content_hash: "thin" });
    rows.push({ id: "dup", url: "https://h/dup/", page_type: "OTHER", http_status: 200, raw_html: gangaHtml("home"), raw_text: "x".repeat(300), content_hash: "hash_home" });
    const { model } = buildNormalizedHospitalFromRecords(rows, []);
    expect(model.coverage.pagesIgnored).toBe(3);
    expect(model.coverage.ignored?.map((i) => i.reason).sort()).toEqual([
      "duplicate content",
      "no HTML content",
      "no hospital semantic information (too little text)",
    ]);
    expect(model.coverage.unparsed).toHaveLength(0); // ignored != failed
    expect(model.status).toBe("COMPLETE"); // ignored pages are intentional
  });
});

describe("coverage — PARTIAL when core hospital data is missing", () => {
  it("does not report COMPLETE for a content page with no hospital signal", () => {
    const rows: PersistedSourceRow[] = [
      { id: "blog", url: "https://h/blog/", page_type: "OTHER", http_status: 200,
        raw_html: `<html><head><title>Blog</title></head><body><p>${"General wellness tips. ".repeat(30)}</p></body></html>`,
        raw_text: "General wellness tips. ".repeat(30), content_hash: "blog" },
    ];
    const { model } = buildNormalizedHospitalFromRecords(rows, []);
    expect(model.status).toBe("PARTIAL");
  });
});

describe("live hero ranking — declared exterior wins, portrait not public", () => {
  it("ranks an og-declared exterior first; a doctor portrait is never public", () => {
    const home = `<html><head><title>Test Hospital</title>
      <meta property="og:image" content="https://h/u/building.jpg"></head>
      <body><div class="entry-content"><h2>DOCTORS</h2><h2>CARDIOLOGY</h2><p>Dr A One Dr B Two</p><h2>NEUROLOGY</h2><p>Dr C Three</p></div></body></html>`;
    const sources: PersistedSourceRow[] = [
      { id: "home", url: "https://h/", page_type: "HOME", http_status: 200, raw_html: home, raw_text: "x".repeat(400), content_hash: "h" },
    ];
    const assets: PersistedAssetRow[] = [
      { id: "ext", source_id: "home", source_page_url: "https://h/", original_asset_url: "https://h/u/building-1024x600.jpg", mime_type: "image/jpeg", width: 1024, height: 600, alt_text: "", classification: "HOSPITAL_EXTERIOR", approval_status: "APPROVED" },
      { id: "doc", source_id: "home", source_page_url: "https://h/", original_asset_url: "https://h/u/dr-x.jpg", mime_type: "image/jpeg", width: 600, height: 600, alt_text: "Dr X", classification: "DOCTOR", approval_status: "APPROVED" },
      { id: "logo", source_id: "home", source_page_url: "https://h/", original_asset_url: "https://h/u/logo.png", mime_type: "image/png", width: 300, height: 120, alt_text: "logo", classification: "LOGO", approval_status: "APPROVED" },
    ];
    const { model, heroRanking } = buildNormalizedHospitalFromRecords(sources, assets);
    expect(heroRanking[0].asset.asset_id).toBe("ext");
    expect(heroRanking[0].asset.og_declared).toBe(true); // matched via base filename
    expect(heroRanking[0].publicEligible).toBe(true);
    // the doctor portrait is attributive → REVIEW_REQUIRED → never public
    const doc = model.assets.find((a) => a.asset_id === "doc")!;
    expect(doc.approval_state).toBe("REVIEW_REQUIRED");
    expect(heroRanking.find((h) => h.asset.asset_id === "doc")?.publicEligible ?? false).toBe(false);
  });
});

describe("sparse data remains valid (no rich-section assumptions)", () => {
  it("normalizes a minimal single page without requiring rich sections", () => {
    const html = `<html><head><title>Tiny Clinic</title></head><body><div class="entry-content">
      <h1>Tiny Clinic</h1><h2>GENERAL MEDICINE</h2><p>Dr Anand Rao</p><h2>PAEDIATRICS</h2><p>Dr Bina Shah</p>
      <p>Address: 1 Main Road, Tumkur - 572101. Phone: +91 90000 12345.</p></div></body></html>`;
    const rows: PersistedSourceRow[] = [
      { id: "home", url: "https://tiny/", page_type: "HOME", http_status: 200, raw_html: html, raw_text: cheerio.load(html)("body").text(), content_hash: "t" },
    ];
    const { model, eligibility } = buildNormalizedHospitalFromRecords(rows, []);
    expect(() => parseNormalizedHospital(model)).not.toThrow();
    expect(model.status).not.toBe("FAILED");
    expect(model.emergency.available).toBe("unknown");
    expect(eligibility.InsurancePanel.eligible).toBe(false);
    expect(eligibility.AccreditationStrip.eligible).toBe(false);
    expect(eligibility.EmergencyBar.eligible).toBe(false);
  });
});
