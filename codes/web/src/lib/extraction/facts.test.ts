import { describe, expect, it } from "vitest";

import { buildHospitalFactPayloads } from "@/lib/extraction/facts";

describe("buildHospitalFactPayloads", () => {
  it("converts validated extraction output into unverified fact rows", () => {
    const payloads = buildHospitalFactPayloads({
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
});
