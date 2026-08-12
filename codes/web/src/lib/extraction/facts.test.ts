import { describe, expect, it } from "vitest";

import {
  buildHospitalFactPayloads,
  filterNewFactPayloads,
} from "@/lib/extraction/facts";

describe("buildHospitalFactPayloads", () => {
  it("converts validated extraction output into unverified fact rows", () => {
    const { payloads, rejected } = buildHospitalFactPayloads({
      leadId: "lead-1",
      sourceId: "source-1",
      extraction: {
        facts: [
          {
            fact_type: "HOSPITAL_NAME",
            value: "ABC Hospital",
            source_excerpt: "ABC Hospital, Tumakuru",
          },
          {
            fact_type: "DOCTOR",
            value: { name: "Dr. Rao" },
            source_excerpt: "Dr. Rao",
          },
        ],
      },
    });

    expect(rejected).toHaveLength(0);
    expect(payloads).toEqual([
      expect.objectContaining({
        lead_id: "lead-1",
        source_id: "source-1",
        fact_type: "HOSPITAL_NAME",
        risk_tier: "LOW",
        verification_status: "UNVERIFIED",
      }),
      expect.objectContaining({
        fact_type: "DOCTOR",
        risk_tier: "HIGH",
        verification_status: "UNVERIFIED",
      }),
    ]);
  });

  it("keeps facts whose excerpt is present in the source text", () => {
    const { payloads, rejected } = buildHospitalFactPayloads({
      leadId: "lead-1",
      sourceId: "source-1",
      sourceText:
        "Welcome to ABC Hospital in Tumakuru. Call us on 08162223344.",
      extraction: {
        facts: [
          {
            fact_type: "HOSPITAL_NAME",
            value: "ABC Hospital",
            source_excerpt: "ABC Hospital in Tumakuru",
          },
        ],
      },
    });

    expect(rejected).toHaveLength(0);
    expect(payloads).toHaveLength(1);
  });

  it("rejects facts whose excerpt is fabricated (P0-7)", () => {
    const { payloads, rejected } = buildHospitalFactPayloads({
      leadId: "lead-1",
      sourceId: "source-1",
      sourceText: "Welcome to ABC Hospital in Tumakuru.",
      extraction: {
        facts: [
          {
            fact_type: "HOSPITAL_NAME",
            value: "ABC Hospital",
            source_excerpt: "ABC Hospital in Tumakuru",
          },
          {
            fact_type: "ACCREDITATION",
            value: "NABH accredited",
            source_excerpt: "This hospital is NABH accredited since 2015",
          },
        ],
      },
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].fact_type).toBe("HOSPITAL_NAME");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].fact_type).toBe("ACCREDITATION");
  });

  it("is idempotent: re-extraction drops facts already stored (P0-12)", () => {
    const { payloads } = buildHospitalFactPayloads({
      leadId: "lead-1",
      sourceId: "source-1",
      sourceText: "ABC Hospital in Tumakuru. Call 08162223344.",
      extraction: {
        facts: [
          { fact_type: "HOSPITAL_NAME", value: "ABC Hospital", source_excerpt: "ABC Hospital in Tumakuru" },
          { fact_type: "PHONE", value: "08162223344", source_excerpt: "Call 08162223344" },
        ],
      },
    });

    // First run: nothing exists yet → all new.
    expect(filterNewFactPayloads([], payloads)).toHaveLength(2);

    // Second run: both already stored → nothing new (no duplicates).
    const existing = payloads.map((p) => ({
      fact_type: p.fact_type,
      source_excerpt: p.source_excerpt ?? null,
    }));
    expect(filterNewFactPayloads(existing, payloads)).toHaveLength(0);

    // A genuinely new fact still passes through.
    const withNew = [
      ...payloads,
      {
        lead_id: "lead-1",
        source_id: "source-1",
        fact_type: "ADDRESS",
        value: "MG Road",
        risk_tier: "LOW" as const,
        source_excerpt: "MG Road",
        verification_status: "UNVERIFIED" as const,
      },
    ];
    expect(filterNewFactPayloads(existing, withNew)).toHaveLength(1);
  });

  it("skips verification when no source text is available (manual sources)", () => {
    const { payloads, rejected } = buildHospitalFactPayloads({
      leadId: "lead-1",
      sourceId: "source-1",
      sourceText: null,
      extraction: {
        facts: [
          {
            fact_type: "PHONE",
            value: "08162223344",
            source_excerpt: "manually collected by phone call",
          },
        ],
      },
    });

    expect(rejected).toHaveLength(0);
    expect(payloads).toHaveLength(1);
  });
});
