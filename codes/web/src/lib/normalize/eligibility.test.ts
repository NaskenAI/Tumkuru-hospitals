import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { computeSectionEligibility } from "@/lib/normalize/eligibility";
import { buildNormalizedHospitalFromRecords, type PersistedSourceRow } from "@/lib/normalize/integration";
import { gangaHtml } from "@/lib/normalize/__fixtures__/ganga";

function gangaRows(): PersistedSourceRow[] {
  const meta = [
    ["home", "/", "HOME"], ["team", "/our-team/", "DOCTORS"],
    ["facilities", "/facilities/", "FACILITIES"], ["insurers", "/insurances-available/", "INSURANCE"],
    ["milestones", "/milestones/", "ABOUT"],
  ] as const;
  return meta.map(([n, p, t], i) => {
    const html = gangaHtml(n);
    return { id: `s${i}`, url: `https://gangahospitaltumkur.com${p}`, page_type: t, http_status: 200, raw_html: html, raw_text: cheerio.load(html)("body").text(), content_hash: `h${n}` };
  });
}

describe("section eligibility uses normalized data only (Ganga)", () => {
  const { model } = buildNormalizedHospitalFromRecords(gangaRows(), []);
  const e = computeSectionEligibility(model);

  it("gates each section on safe normalized data", () => {
    expect(e.EmergencyBar.eligible).toBe(true);
    expect(e.DoctorsByGroup.eligible).toBe(true);
    expect(e.SpecialtiesGrid.eligible).toBe(true);
    expect(e.AppointmentCTA.eligible).toBe(true);
    expect(e.FounderProfile.eligible).toBe(true);
    // safety gates that must be OFF for Ganga:
    expect(e.DoctorPhotoCards.eligible).toBe(false); // no approved portraits
    expect(e.InsurancePanel.eligible).toBe(false); // no human-confirmed insurers
    expect(e.AccreditationStrip.eligible).toBe(false); // APPLIED != HELD
  });

  it("counts only safely-nameable facilities", () => {
    expect(e.FacilitiesGrid.eligible).toBe(true);
    expect(e.FacilitiesGrid.count).toBeGreaterThan(0);
  });
});
