import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import {
  isDoctorListPage,
  parseDoctorListPage,
  resolvePeople,
  splitDoctorNames,
  type DoctorSlot,
} from "@/lib/normalize/doctors";
import type { SourcePage } from "@/lib/normalize/model";

function ganga(name: string) {
  const url = fileURLToPath(new URL(`./__fixtures__/ganga/${name}.html`, import.meta.url));
  const html = readFileSync(url, "utf8");
  const $ = cheerio.load(html);
  const page: SourcePage = { id: name, url: `https://gangahospitaltumkur.com/${name}/`, tier: 2, html };
  const pageText = $("body").text();
  return { $, page, pageText };
}

describe("splitDoctorNames", () => {
  it("splits a flattened multi-name block", () => {
    expect(splitDoctorNames("Dr Kiran Dr Sriram")).toEqual(["Dr Kiran", "Dr Sriram"]);
    expect(splitDoctorNames("Dr Vijay R Tubaki")).toEqual(["Dr Vijay R Tubaki"]);
    expect(splitDoctorNames("Dr Rajesh Dr Rekha N.")).toEqual(["Dr Rajesh", "Dr Rekha N."]);
  });
  it("ignores prose beginning with Dr", () => {
    expect(splitDoctorNames("Dr visits are available on weekdays, please call.")).toEqual([]);
  });
});

describe("F1 — Ganga /our-team/ full coverage", () => {
  const { $, page, pageText } = ganga("team");
  const slots = parseDoctorListPage($, page, pageText);
  const resolved = resolvePeople(slots);

  it("detects a doctor list page by structure, not URL", () => {
    expect(isDoctorListPage(cheerio.load(page.html))).toBe(true);
  });

  it("captures many specialty groups and every clinician name-slot", () => {
    const groups = new Set(slots.filter((s) => s.role === "clinician").map((s) => s.group));
    // report observed counts (not a fabricated target)
    console.log(
      `F1 observed: nameSlots=${resolved.observedNameSlots} distinctPeople=${resolved.doctors.length + resolved.administrators.length} clinicalGroups=${groups.size} admins=${resolved.administrators.length}`,
    );
    expect(groups.size).toBeGreaterThanOrEqual(30);
    // representative clinicians across different groups are present
    const names = resolved.doctors.map((d) => d.displayName);
    for (const n of ["Dr. Vijay R. Tubaki", "Dr. Navaneeth S. Kamath", "Dr. Darshan Jain", "Dr. Praveen N."]) {
      expect(names).toContain(n);
    }
    // every slot carries verified provenance
    expect(slots.every((s: DoctorSlot) => s.evidence.provenanceVerified)).toBe(true);
  });
});

describe("F2 — CRITICAL CARE spans multiple blocks", () => {
  it("captures all six names across the three sibling blocks", () => {
    const { $, page, pageText } = ganga("team");
    const slots = parseDoctorListPage($, page, pageText);
    const cc = slots.filter((s) => /CRITICAL CARE/i.test(s.group)).map((s) => s.rawName);
    for (const n of ["Dr Kiran", "Dr Sriram", "Dr Rajesh", "Dr Rekha N.", "Dr Santosh", "Dr Aparna"]) {
      expect(cc).toContain(n);
    }
    expect(cc.length).toBe(6);
  });
});

describe("F4 — Dr Srikanth ambiguity", () => {
  it("marks the single-token name ambiguous, never merged silently", () => {
    const { $, page, pageText } = ganga("team");
    const resolved = resolvePeople(parseDoctorListPage($, page, pageText));
    const srikanth = resolved.doctors.find((d) => d.displayName === "Dr. Srikanth");
    expect(srikanth).toBeDefined();
    expect(srikanth!.resolution.state).toBe("ambiguous");
    // it appeared under multiple specialty groups
    expect(srikanth!.sourceGroups.length).toBeGreaterThan(1);
  });
});

describe("F5 — similar names are not merged", () => {
  it("keeps Dr Kiran and Dr Kiran S as distinct people", () => {
    const { $, page, pageText } = ganga("team");
    const resolved = resolvePeople(parseDoctorListPage($, page, pageText));
    const names = resolved.doctors.map((d) => d.displayName);
    expect(names).toContain("Dr. Kiran");
    expect(names).toContain("Dr. Kiran S.");
    // the shorter name is flagged as colliding with the fuller one
    const kiran = resolved.doctors.find((d) => d.displayName === "Dr. Kiran")!;
    expect(kiran.resolution.state).toBe("ambiguous");
    expect(kiran.resolution.collidesWith.length).toBeGreaterThan(0);
  });
});

describe("F6 — administrators are separated from clinicians", () => {
  it("classifies Colonel Prem Kishore as administrator, not doctor", () => {
    const { $, page, pageText } = ganga("team");
    const resolved = resolvePeople(parseDoctorListPage($, page, pageText));
    const admin = resolved.administrators.find((a) => /Prem Kishore/i.test(a.displayName));
    expect(admin).toBeDefined();
    expect(admin!.role).toBe("administrator");
    expect(resolved.doctors.some((d) => /Prem Kishore/i.test(d.displayName))).toBe(false);
  });
});
