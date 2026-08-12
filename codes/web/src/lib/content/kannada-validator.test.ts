import { describe, expect, it } from "vitest";

import { validateKannada } from "@/lib/content/kannada-validator";
import type { GeneratedContent } from "@/lib/content/content-schema";

const verifiedIds = ["f_name", "f_phone", "f_doc"];

function english(): GeneratedContent {
  return {
    hospital_name: "ABC Hospital",
    tagline: {
      text: "Compassionate care since 1998",
      supporting_fact_ids: ["f_name"],
    },
    about: [
      { text: "Serving Tumakuru for 25 years.", supporting_fact_ids: ["f_name"] },
    ],
    doctors: [{ name: "Dr. Meena Rao", supporting_fact_ids: ["f_doc"] }],
    contact: { phone: "08162223344", supporting_fact_ids: ["f_phone"] },
  };
}

function kannada(): GeneratedContent {
  return {
    hospital_name: "ABC Hospital",
    tagline: {
      text: "1998 ರಿಂದ ಸಹಾನುಭೂತಿಯ ಆರೈಕೆ",
      supporting_fact_ids: ["f_name"],
    },
    about: [
      { text: "25 ವರ್ಷಗಳಿಂದ ತುಮಕೂರಿಗೆ ಸೇವೆ.", supporting_fact_ids: ["f_name"] },
    ],
    doctors: [{ name: "Dr. Meena Rao", supporting_fact_ids: ["f_doc"] }],
    contact: { phone: "08162223344", supporting_fact_ids: ["f_phone"] },
  };
}

describe("validateKannada", () => {
  it("accepts a faithful translation", () => {
    const result = validateKannada(english(), kannada(), verifiedIds);
    expect(result.valid).toBe(true);
  });

  it("rejects an altered hospital name", () => {
    const kn = kannada();
    kn.hospital_name = "XYZ Hospital";
    const result = validateKannada(english(), kn, verifiedIds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "hospital_name")).toBe(true);
  });

  it("rejects a dropped number (e.g. the founding year)", () => {
    const kn = kannada();
    kn.tagline.text = "ಸಹಾನುಭೂತಿಯ ಆರೈಕೆ"; // "1998" removed
    const result = validateKannada(english(), kn, verifiedIds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("1998"))).toBe(true);
  });

  it("rejects altered supporting_fact_ids", () => {
    const kn = kannada();
    kn.about[0].supporting_fact_ids = ["f_phone"];
    const result = validateKannada(english(), kn, verifiedIds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => /supporting_fact_ids/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects a section length mismatch", () => {
    const kn = kannada();
    kn.about.push({ text: "ಹೆಚ್ಚುವರಿ", supporting_fact_ids: ["f_name"] });
    const result = validateKannada(english(), kn, verifiedIds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => /length mismatch/.test(i.message))).toBe(
      true,
    );
  });

  it("rejects an altered doctor name", () => {
    const kn = kannada();
    kn.doctors![0].name = "Dr. Someone Else";
    const result = validateKannada(english(), kn, verifiedIds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === "doctors[0].name")).toBe(true);
  });
});
