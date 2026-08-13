import { describe, expect, it } from "vitest";

import { validateClaims, type VerifiedFact } from "@/lib/content/claim-validator";
import type { GeneratedContent } from "@/lib/content/content-schema";

const facts: VerifiedFact[] = [
  { id: "f_name", fact_type: "HOSPITAL_NAME", value: "ABC Hospital", source_excerpt: "ABC Hospital, Tumakuru" },
  { id: "f_phone", fact_type: "PHONE", value: "08162223344", source_excerpt: "Call 08162223344" },
  { id: "f_addr", fact_type: "ADDRESS", value: "MG Road, Tumakuru", source_excerpt: "MG Road, Tumakuru" },
  { id: "f_doc", fact_type: "DOCTOR", value: "Dr. Meena Rao", source_excerpt: "Dr. Meena Rao" },
  { id: "f_qual", fact_type: "QUALIFICATION", value: "MBBS, MS", source_excerpt: "Dr. Meena Rao, MBBS, MS" },
  { id: "f_spec", fact_type: "SPECIALTY", value: "Orthopedics", source_excerpt: "Department of Orthopedics" },
  { id: "f_emerg", fact_type: "EMERGENCY", value: "24 hour emergency", source_excerpt: "24 hour emergency ward" },
];

function baseContent(): GeneratedContent {
  return {
    hospital_name: "ABC Hospital",
    tagline: { text: "Compassionate care in Tumakuru", supporting_fact_ids: ["f_name"] },
    about: [{ text: "ABC Hospital serves Tumakuru.", supporting_fact_ids: ["f_name"] }],
    doctors: [{ name: "Dr. Meena Rao", supporting_fact_ids: ["f_doc"] }],
    contact: { phone: "08162223344", supporting_fact_ids: ["f_phone"] },
  };
}

describe("validateClaims — grounding basics", () => {
  it("accepts fully grounded content", () => {
    expect(validateClaims(baseContent(), facts).valid).toBe(true);
  });

  it("rejects banned superlatives even with a valid fact ID", () => {
    const c = baseContent();
    c.tagline.text = "The best hospital in Karnataka";
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /banned/.test(i.message))).toBe(true);
  });

  it("rejects an invented statistic citing an unrelated fact", () => {
    const c = baseContent();
    c.about = [{ text: "We achieve a 98 percent success rate.", supporting_fact_ids: ["f_phone"] }];
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.includes("98"))).toBe(true);
  });

  it("rejects references to unverified fact IDs and empty IDs", () => {
    const c1 = baseContent();
    c1.tagline.supporting_fact_ids = ["nope"];
    expect(validateClaims(c1, facts).valid).toBe(false);

    const c2 = baseContent();
    c2.about[0].supporting_fact_ids = [];
    expect(validateClaims(c2, facts).valid).toBe(false);
  });
});

describe("validateClaims — fact-type semantic grounding (P0-3)", () => {
  it("FAILS '24/7 emergency care' citing only an ADDRESS fact", () => {
    const c = baseContent();
    c.about = [{ text: "We provide 24/7 emergency care.", supporting_fact_ids: ["f_addr"] }];
    expect(validateClaims(c, facts).valid).toBe(false);
  });

  it("FAILS 'round-the-clock emergency care' (no digits) citing only ADDRESS", () => {
    // Isolates the semantic guard from number-grounding.
    const c = baseContent();
    c.about = [{ text: "Round-the-clock emergency care available.", supporting_fact_ids: ["f_addr"] }];
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /EMERGENCY/.test(i.message))).toBe(true);
  });

  it("PASSES emergency care when an EMERGENCY fact is cited", () => {
    const c = baseContent();
    c.about = [{ text: "Round-the-clock emergency care available.", supporting_fact_ids: ["f_emerg"] }];
    expect(validateClaims(c, facts).valid).toBe(true);
  });

  it("FAILS an invented doctor qualification grounded in no cited fact", () => {
    const c = baseContent();
    c.doctors = [{ name: "Dr. Meena Rao", qualification: "MD Cardiology", supporting_fact_ids: ["f_doc"] }];
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.includes("MD Cardiology"))).toBe(true);
  });

  it("PASSES a doctor qualification grounded in a cited QUALIFICATION fact", () => {
    const c = baseContent();
    c.doctors = [
      { name: "Dr. Meena Rao", qualification: "MBBS, MS", supporting_fact_ids: ["f_doc", "f_qual"] },
    ];
    expect(validateClaims(c, facts).valid).toBe(true);
  });

  it("PASSES a doctor whose specialty is embedded in the DOCTOR fact value", () => {
    const embedded = {
      id: "f_doc2",
      fact_type: "DOCTOR",
      value: { name: "Dr. Rao", specialty: "Psychiatrist" },
      source_excerpt: "Dr. Rao Psychiatrist",
    };
    const c = baseContent();
    c.doctors = [
      { name: "Dr. Rao", specialty: "Psychiatrist", supporting_fact_ids: ["f_doc2"] },
    ];
    expect(validateClaims(c, [...facts, embedded]).valid).toBe(true);
  });

  it("PASSES a specialty matching a SPECIALTY fact", () => {
    const c = baseContent();
    c.specialties = [{ name: "Orthopedics", supporting_fact_ids: ["f_spec"] }];
    expect(validateClaims(c, facts).valid).toBe(true);
  });

  it("FAILS a specialty that cites a non-SPECIALTY fact", () => {
    const c = baseContent();
    c.specialties = [{ name: "Cardiology", supporting_fact_ids: ["f_name"] }];
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /SPECIALTY/.test(i.message))).toBe(true);
  });

  it("PASSES a phone number backed by a PHONE fact", () => {
    const c = baseContent();
    c.contact = { phone: "0816-222-3344", supporting_fact_ids: ["f_phone"] };
    expect(validateClaims(c, facts).valid).toBe(true);
  });

  it("FAILS a contact phone citing a non-PHONE fact", () => {
    const c = baseContent();
    c.contact = { phone: "08162223344", supporting_fact_ids: ["f_name"] };
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /PHONE/.test(i.message))).toBe(true);
  });

  it("FAILS an accreditation without an ACCREDITATION fact", () => {
    const c = baseContent();
    c.accreditations = [{ text: "NABH accredited", supporting_fact_ids: ["f_name"] }];
    const r = validateClaims(c, facts);
    expect(r.valid).toBe(false);
  });
});
