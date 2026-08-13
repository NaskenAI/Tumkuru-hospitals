import { describe, expect, it } from "vitest";

import {
  parseExtractionOutput,
  riskTierForFactType,
} from "@/lib/extraction/schema";

describe("extraction schema", () => {
  it("accepts sourced facts", () => {
    const parsed = parseExtractionOutput({
      facts: [
        {
          fact_type: "PHONE",
          value: "+919876543210",
          source_excerpt: "Call +91 98765 43210",
        },
      ],
    });

    expect(parsed.facts).toHaveLength(1);
  });

  it("rejects facts without source excerpts", () => {
    expect(() =>
      parseExtractionOutput({
        facts: [
          {
            fact_type: "SPECIALTY",
            value: "Orthopaedics",
            source_excerpt: "",
          },
        ],
      }),
    ).toThrow();
  });

  it("assigns risk tiers by fact type", () => {
    expect(riskTierForFactType("PHONE")).toBe("LOW");
    expect(riskTierForFactType("SERVICE")).toBe("MEDIUM");
    expect(riskTierForFactType("DOCTOR")).toBe("HIGH");
  });

  it("separates a doctor AFFILIATION from a hospital ACCREDITATION", () => {
    // AFFILIATION (doctor society membership) is its own high-risk type.
    expect(riskTierForFactType("AFFILIATION")).toBe("HIGH");
    // A membership can be parsed as AFFILIATION, distinct from ACCREDITATION.
    const parsed = parseExtractionOutput({
      facts: [
        {
          fact_type: "AFFILIATION",
          value: "Member of the Indian Orthopaedic Association",
          source_excerpt: "member of the Indian Orthopaedic Association",
        },
      ],
    });
    expect(parsed.facts[0].fact_type).toBe("AFFILIATION");
  });
});
