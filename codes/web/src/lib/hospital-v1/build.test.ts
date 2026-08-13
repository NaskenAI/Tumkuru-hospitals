import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { buildHospitalV1 } from "@/lib/hospital-v1/build";
import { selectFeaturedFacilities, selectHero } from "@/lib/hospital-v1/select";
import {
  buildNormalizedHospitalFromRecords,
  type PersistedSourceRow,
} from "@/lib/normalize/integration";
import type { PersistedAssetRow } from "@/lib/normalize/assets";
import { gangaHtml } from "@/lib/normalize/__fixtures__/ganga";

// ---- helpers ---------------------------------------------------------------
function row(id: string, path: string, type: string, html: string): PersistedSourceRow {
  return { id, url: `https://h${path}`, page_type: type, http_status: 200, raw_html: html, raw_text: cheerio.load(html)("body").text(), content_hash: id };
}
function team(title: string, groups: { name: string; docs: string[] }[]): string {
  const b = groups.map((g) => `<h2>${g.name}</h2><p>${g.docs.join(" ")}</p>`).join("");
  return `<!doctype html><html><head><title>${title}</title></head><body><div class="entry-content"><h1>${title}</h1><h2>DOCTORS</h2>${b}<p>Address: 1 Rd, Tumkur - 572101. Phone: +91 90000 12345.</p></div></body></html>`;
}
function facilitiesHtml(names: string[]): string {
  const b = names.map((n) => `<h3>${n}</h3><figure><img src="/x/${n.replace(/\s+/g, "-")}.jpg"></figure>`).join("");
  return `<!doctype html><html><head><title>F</title></head><body><div class="entry-content">${b}</div></body></html>`;
}
function types(rows: PersistedSourceRow[], assets: PersistedAssetRow[] = []): string[] {
  const { model, eligibility } = buildNormalizedHospitalFromRecords(rows, assets);
  return buildHospitalV1(model, eligibility).content.map((c) => c.type as string);
}

function gangaRows(): PersistedSourceRow[] {
  const meta: [Parameters<typeof gangaHtml>[0], string, string][] = [
    ["home", "/", "HOME"], ["team", "/our-team/", "DOCTORS"], ["departments", "/departments/", "DEPARTMENTS"],
    ["facilities", "/facilities/", "FACILITIES"], ["insurers", "/insurances-available/", "INSURANCE"], ["milestones", "/milestones/", "ABOUT"],
  ];
  return meta.map(([n, p, tp], i) => row(`s${i}`, p, tp, gangaHtml(n)));
}

// ---- determinism -----------------------------------------------------------
describe("buildHospitalV1 is deterministic", () => {
  it("same input → identical Puck JSON", () => {
    const { model, eligibility } = buildNormalizedHospitalFromRecords(gangaRows(), []);
    expect(buildHospitalV1(model, eligibility)).toEqual(buildHospitalV1(model, eligibility));
  });
});

// ---- Ganga composition -----------------------------------------------------
describe("Ganga composition", () => {
  const t = types(gangaRows());
  it("includes the supported sections", () => {
    for (const s of ["HospitalNavbar", "HospitalHero", "QuickPatientActions", "EmergencyBar", "SpecialtiesSection", "FacilitiesSection", "DoctorsByGroup", "AboutHospital", "FounderProfile", "AppointmentCTA", "ContactLocation", "HospitalFooter"]) {
      expect(t).toContain(s);
    }
  });
  it("MUST NOT include accreditation or insurance for Ganga", () => {
    expect(t).not.toContain("AccreditationStrip");
    expect(t).not.toContain("InsurancePanel");
  });
});

// ---- fail-closed (Section 44) ---------------------------------------------
describe("fail-closed composition", () => {
  it("no emergency → no EmergencyBar", () => {
    const t = types([row("a", "/", "HOME", team("Clinic", [{ name: "CARDIOLOGY", docs: ["Dr A One", "Dr B Two"] }, { name: "ENT", docs: ["Dr C Three"] }]))]);
    expect(t).not.toContain("EmergencyBar");
  });

  it("no appointment → no AppointmentCTA", () => {
    const t = types([row("a", "/", "HOME", team("Clinic", [{ name: "CARDIOLOGY", docs: ["Dr A One", "Dr B Two"] }, { name: "ENT", docs: ["Dr C Three"] }]))]);
    expect(t).not.toContain("AppointmentCTA");
  });

  it("APPLIED-only accreditation → no AccreditationStrip", () => {
    const html = `<!doctype html><html><head><title>H Hospital</title></head><body><div class="entry-content"><h1>H Hospital</h1><h2>CARDIOLOGY</h2><p>Dr A One Dr B Two</p><h2>ENT</h2><p>Dr C Three</p><p>The hospital has applied to obtain NABH accreditation.</p></div></body></html>`;
    const { model, eligibility } = buildNormalizedHospitalFromRecords([row("a", "/about/", "ABOUT", html)], []);
    expect(model.accreditations.some((x) => x.status === "APPLIED")).toBe(true);
    expect(eligibility.AccreditationStrip.eligible).toBe(false);
    expect(buildHospitalV1(model, eligibility).content.map((c) => c.type)).not.toContain("AccreditationStrip");
  });

  it("no hero asset → HospitalHero renders in no-image mode", () => {
    const { model, eligibility } = buildNormalizedHospitalFromRecords([row("a", "/", "HOME", team("Clinic", [{ name: "CARDIOLOGY", docs: ["Dr A One"] }, { name: "ENT", docs: ["Dr B Two"] }]))], []);
    const hero = buildHospitalV1(model, eligibility).content.find((c) => c.type === "HospitalHero");
    expect((hero?.props as { variant?: string })?.variant).toBe("no-image");
    expect(selectHero(model)).toBeNull();
  });

  it("3 specialties → renders 3, never fabricates 6", () => {
    const { model, eligibility } = buildNormalizedHospitalFromRecords([row("a", "/", "HOME", team("Clinic", [
      { name: "CARDIOLOGY", docs: ["Dr A One"] }, { name: "NEUROLOGY", docs: ["Dr B Two"] }, { name: "ENT", docs: ["Dr C Three"] },
    ]))], []);
    expect(model.specialties.length).toBe(3);
    const node = buildHospitalV1(model, eligibility).content.find((c) => c.type === "SpecialtiesSection");
    expect((node?.props as { specialtyLabels: string[] }).specialtyLabels.length).toBe(3);
  });

  it("4 eligible facilities → renders 4", () => {
    const rows = [
      row("a", "/", "HOME", team("H Hospital", [{ name: "CARDIOLOGY", docs: ["Dr A One"] }, { name: "ENT", docs: ["Dr B Two"] }])),
      row("f", "/facilities/", "FACILITIES", facilitiesHtml(["ICU", "Operation Theatre", "General Ward", "24x7 Pharmacy"])),
    ];
    const { model, eligibility } = buildNormalizedHospitalFromRecords(rows, []);
    expect(selectFeaturedFacilities(model, 6).length).toBe(4);
    const node = buildHospitalV1(model, eligibility).content.find((c) => c.type === "FacilitiesSection");
    expect((node?.props as { facilityRefs: string[] }).facilityRefs.length).toBe(4);
  });

  it("hero never selects a doctor portrait / REVIEW_REQUIRED asset", () => {
    const assets: PersistedAssetRow[] = [
      { id: "doc", source_id: "a", source_page_url: "https://h/", original_asset_url: "https://h/u/dr-x.jpg", mime_type: "image/jpeg", width: 800, height: 600, alt_text: "Dr X", classification: "DOCTOR", approval_status: "APPROVED" },
    ];
    const { model } = buildNormalizedHospitalFromRecords([row("a", "/", "HOME", team("H Hospital", [{ name: "ENT", docs: ["Dr A One"] }, { name: "CARDIOLOGY", docs: ["Dr B Two"] }]))], assets);
    expect(selectHero(model)).toBeNull(); // the only asset is an attributive portrait
  });

  it("never references positioning claims in the composition", () => {
    const { model, eligibility } = buildNormalizedHospitalFromRecords(gangaRows(), []);
    expect(model.positioningClaims.length).toBeGreaterThan(0); // they exist in the model
    const json = JSON.stringify(buildHospitalV1(model, eligibility));
    expect(json.toLowerCase()).not.toContain("premier");
    expect(json).not.toContain("#1");
  });
});

// ---- synthetic robustness (Section 43) ------------------------------------
describe("synthetic robustness", () => {
  it("rich → most modules present", () => {
    const groups = Array.from({ length: 12 }, (_, i) => ({ name: `S${i} SPECIALTY`, docs: [`Dr S${i} Alpha`, `Dr S${i} Beta`] }));
    const rows = [
      row("h", "/", "HOME", `<!doctype html><html><head><title>Rich Hospital</title></head><body><div class="entry-content"><h1>Rich Hospital</h1><p>We provide 24x7 emergency services. Established in 2005. Address: 5 Ring Rd, Tumkur - 572102. Phone: +91 90000 55555.</p><a href="/book/">Book Appointment</a></div></body></html>`),
      row("t", "/our-team/", "DOCTORS", team("Rich Hospital", groups)),
      row("f", "/facilities/", "FACILITIES", facilitiesHtml(["ICU", "Operation Theatre", "Emergency & Trauma", "Laboratory", "X-Ray", "24x7 Pharmacy"])),
    ];
    const t = types(rows);
    expect(t).toContain("SpecialtiesSection");
    expect(t).toContain("FacilitiesSection");
    expect(t).toContain("DoctorsByGroup");
    expect(t).toContain("EmergencyBar");
    expect(t).toContain("AppointmentCTA");
  });

  it("sparse → valid, restrained, no forced rich sections", () => {
    const t = types([row("h", "/", "HOME", team("Tiny Clinic", [{ name: "GENERAL MEDICINE", docs: ["Dr Anand Rao"] }, { name: "PAEDIATRICS", docs: ["Dr Bina Shah"] }]))]);
    expect(t).toContain("HospitalNavbar");
    expect(t).toContain("ContactLocation");
    expect(t).not.toContain("EmergencyBar");
    expect(t).not.toContain("FacilitiesSection");
    expect(t).not.toContain("AppointmentCTA");
    expect(t).not.toContain("AccreditationStrip");
  });

  it("specialty-heavy → handles concentration without assuming multispecialty breadth", () => {
    const groups = Array.from({ length: 10 }, (_, i) => ({ name: `ORTHO SUB ${i}`, docs: [`Dr O${i} A`, `Dr O${i} B`, `Dr O${i} C`] }));
    const t = types([
      row("h", "/", "HOME", team("Ortho Hospital", groups)),
      row("f", "/facilities/", "FACILITIES", facilitiesHtml(["Operation Theatre", "Physiotherapy", "X-Ray", "General Ward"])),
    ]);
    expect(t).toContain("SpecialtiesSection");
    expect(t).toContain("DoctorsByGroup");
    expect(t).toContain("FacilitiesSection");
  });
});
