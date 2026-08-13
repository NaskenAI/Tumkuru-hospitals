import { describe, expect, it } from "vitest";
import type { Data } from "@measured/puck";

import { defaultPuckPage, sanitizePuckData } from "@/lib/puck/default-page";
import type { GeneratedContent } from "@/lib/content/content-schema";

function types(data: Data): string[] {
  return data.content.map((c) => c.type);
}

const rich: GeneratedContent = {
  hospital_name: "Test Hospital",
  tagline: { text: "care", supporting_fact_ids: ["a"] },
  about: [{ text: "about", supporting_fact_ids: ["a"] }],
  specialties: [{ name: "Cardiology", supporting_fact_ids: ["a"] }],
  doctors: [{ name: "Dr. A", supporting_fact_ids: ["a"] }],
  contact: {
    supporting_fact_ids: ["a"],
    phone: "0816-2000000",
    address: "MG Road",
    emergency: "24/7 emergency",
  },
};

const minimal: GeneratedContent = {
  hospital_name: "Tiny Clinic",
  tagline: { text: "care", supporting_fact_ids: ["a"] },
  about: [{ text: "about", supporting_fact_ids: ["a"] }],
  contact: { supporting_fact_ids: ["a"], phone: "0816-2000000" },
};

describe("default Puck page composition", () => {
  it("only includes sections whose approved data exists", () => {
    const t = types(defaultPuckPage(rich));
    expect(t).toContain("SpecialtyGrid");
    expect(t).toContain("DoctorGrid");
    expect(t).toContain("EmergencyStrip");
    expect(t).toContain("MapOrDirectionsSection");
    // no insurance/accreditation/appointment data → those sections absent
    expect(t).not.toContain("InsuranceSection");
    expect(t).not.toContain("AccreditationSection");
    expect(t).not.toContain("AppointmentCTA");
  });

  it("removes sections cleanly when optional data is missing", () => {
    const t = types(defaultPuckPage(minimal));
    expect(t).not.toContain("SpecialtyGrid");
    expect(t).not.toContain("DoctorGrid");
    expect(t).not.toContain("StatsSection");
    expect(t).not.toContain("EmergencyStrip");
    expect(t).not.toContain("MapOrDirectionsSection");
    // base sections still present
    expect(t).toContain("HospitalNavbar");
    expect(t).toContain("HospitalHero");
    expect(t).toContain("ContactSection");
    expect(t).toContain("HospitalFooter");
  });

  it("uses the SAME structural spec for English and Kannada", () => {
    // Same structure, different text (as a real translation would be).
    const en = rich;
    const kn: GeneratedContent = {
      ...rich,
      tagline: { text: "ಆರೈಕೆ", supporting_fact_ids: ["a"] },
      about: [{ text: "ವಿವರ", supporting_fact_ids: ["a"] }],
      specialties: [{ name: "ಹೃದ್ರೋಗ", supporting_fact_ids: ["a"] }],
    };
    expect(types(defaultPuckPage(kn))).toEqual(types(defaultPuckPage(en)));
  });

  it("fails safe: drops unsupported/unknown component types", () => {
    const dirty = {
      root: { props: {} },
      content: [
        { type: "HospitalHero", props: { id: "1" } },
        { type: "EvilArbitraryComponent", props: { id: "2", html: "<script>" } },
        { type: "ContactSection", props: { id: "3" } },
      ],
      zones: {},
    } as unknown as Data;
    const clean = sanitizePuckData(dirty);
    expect(types(clean)).toEqual(["HospitalHero", "ContactSection"]);
  });
});
