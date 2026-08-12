import { describe, expect, it } from "vitest";

import {
  domainOf,
  findPossibleDuplicates,
  type ExistingLead,
} from "@/lib/leads/duplicate-detection";

const existing: ExistingLead[] = [
  {
    id: "lead-1",
    normalizedName: "abc hospital",
    normalizedCity: "tumakuru",
    knownPhone: "+91 816 234 5678",
    domain: "abchospital.example",
  },
];

describe("domainOf", () => {
  it("normalizes a website URL to a bare domain", () => {
    expect(domainOf("https://www.ABCHospital.example/about")).toBe("abchospital.example");
    expect(domainOf("abchospital.example")).toBe("abchospital.example");
    expect(domainOf(null)).toBeNull();
  });
});

describe("findPossibleDuplicates", () => {
  it("flags a STRONG match on same name + city", () => {
    const matches = findPossibleDuplicates(
      { normalizedName: "abc hospital", normalizedCity: "tumakuru", knownPhone: null, domain: null },
      existing,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("strong");
    expect(matches[0].reasons).toContain("same name + city");
  });

  it("flags a STRONG match on same phone (different formatting)", () => {
    const matches = findPossibleDuplicates(
      { normalizedName: "different name", normalizedCity: "other", knownPhone: "0816-2345678", domain: null },
      existing,
    );
    expect(matches[0]?.confidence).toBe("strong");
    expect(matches[0]?.reasons).toContain("same phone");
  });

  it("flags a STRONG match on same website domain", () => {
    const matches = findPossibleDuplicates(
      { normalizedName: "x", normalizedCity: null, knownPhone: null, domain: "abchospital.example" },
      existing,
    );
    expect(matches[0]?.confidence).toBe("strong");
  });

  it("flags only a POSSIBLE match on same name, different city", () => {
    const matches = findPossibleDuplicates(
      { normalizedName: "abc hospital", normalizedCity: "bengaluru", knownPhone: null, domain: null },
      existing,
    );
    expect(matches[0]?.confidence).toBe("possible");
    expect(matches[0]?.reasons).toEqual(["same name"]);
  });

  it("returns nothing for an unrelated hospital (no auto-merge)", () => {
    const matches = findPossibleDuplicates(
      { normalizedName: "xyz clinic", normalizedCity: "mysuru", knownPhone: "9999999999", domain: "xyz.example" },
      existing,
    );
    expect(matches).toHaveLength(0);
  });
});
