import { describe, expect, it } from "vitest";

import {
  computePrecisionRecall,
  factMatches,
  schemaFailureRate,
  unsupportedFactRate,
  valueMatches,
} from "@/eval/metrics";

describe("eval metrics", () => {
  it("matches values by containment, case- and whitespace-insensitively", () => {
    expect(valueMatches("Cardiology", "we offer cardiology")).toBe(true);
    expect(valueMatches("Dr. Rao", "Dr.  Rao")).toBe(true);
    expect(valueMatches("Cardiology", "Orthopedics")).toBe(false);
  });

  it("requires matching fact_type", () => {
    expect(
      factMatches(
        { fact_type: "PHONE", value: "12345" },
        { fact_type: "PHONE", value: "12345" },
      ),
    ).toBe(true);
    expect(
      factMatches(
        { fact_type: "PHONE", value: "12345" },
        { fact_type: "EMAIL", value: "12345" },
      ),
    ).toBe(false);
  });

  it("computes precision and recall", () => {
    const gold = [
      { fact_type: "HOSPITAL_NAME", value: "ABC Hospital" },
      { fact_type: "PHONE", value: "12345" },
    ];
    const stored = [
      { fact_type: "HOSPITAL_NAME", value: "ABC Hospital" }, // TP
      { fact_type: "SERVICE", value: "Made up" }, // FP
    ];
    const pr = computePrecisionRecall(gold, stored);
    expect(pr.truePositives).toBe(1);
    expect(pr.precision).toBeCloseTo(0.5);
    expect(pr.recall).toBeCloseTo(0.5);
  });

  it("computes unsupported-fact rate from a predicate", () => {
    const facts = [
      { source_excerpt: "present" },
      { source_excerpt: "absent" },
    ];
    const rate = unsupportedFactRate(facts, (e) => e === "present");
    expect(rate).toBeCloseTo(0.5);
  });

  it("computes schema-failure rate", () => {
    expect(schemaFailureRate([true, false, false])).toBeCloseTo(2 / 3);
    expect(schemaFailureRate([true, true])).toBe(0);
    expect(schemaFailureRate([])).toBe(0);
  });
});
