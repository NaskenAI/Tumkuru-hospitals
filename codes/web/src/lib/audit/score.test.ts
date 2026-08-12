import { describe, expect, it } from "vitest";

import { computeDigitalGapScore, computeCommercialFitScore } from "@/lib/audit/score";
import { mergeScoringConfig, DEFAULT_SCORING_CONFIG } from "@/lib/audit/scoring-config";
import type { AuditCheckResult } from "@/lib/audit/checks";

const failing = (name: string): AuditCheckResult => ({
  name,
  label: name,
  passed: false,
  detail: "",
});

describe("configurable scoring", () => {
  it("uses default weights when no override is given", () => {
    // A site that exists but fails mobile_viewport = 15 gap points by default.
    const checks: AuditCheckResult[] = [
      { name: "website_exists", label: "", passed: true, detail: "" },
      failing("mobile_viewport"),
    ];
    const { score } = computeDigitalGapScore(checks, DEFAULT_SCORING_CONFIG);
    expect(score).toBe(15);
  });

  it("respects overridden audit weights", () => {
    const config = mergeScoringConfig({ auditWeights: { mobile_viewport: 40 } });
    const checks: AuditCheckResult[] = [
      { name: "website_exists", label: "", passed: true, detail: "" },
      failing("mobile_viewport"),
    ];
    const { score } = computeDigitalGapScore(checks, config);
    expect(score).toBe(40);
  });

  it("respects overridden fit weights", () => {
    const config = mergeScoringConfig({ fit: { phone: 25 } });
    const { score } = computeCommercialFitScore(
      [
        {
          fact_type: "PHONE",
          value: "123",
          risk_tier: "LOW",
          verification_status: "VERIFIED",
        },
      ],
      config,
    );
    // name(0) + phone(25) + richness(floor(1/2)=0) = 25
    expect(score).toBe(25);
  });

  it("ignores malformed override and keeps defaults", () => {
    const config = mergeScoringConfig("not an object");
    expect(config).toEqual(DEFAULT_SCORING_CONFIG);
  });
});
