import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MODEL,
  MODEL_PRICING,
  estimateCost,
} from "@/lib/ai/pricing";

afterEach(() => {
  delete process.env.USD_TO_INR;
});

describe("LLM pricing", () => {
  it("defaults to gemini-3.6-flash with official paid-tier rates", () => {
    expect(DEFAULT_MODEL).toBe("gemini-3.6-flash");
    const p = MODEL_PRICING["gemini-3.6-flash"];
    expect(p.usdInputPerMillion).toBe(1.5);
    expect(p.usdOutputPerMillion).toBe(7.5);
  });

  it("computes USD cost from token counts", () => {
    // 1M input + 1M output = 1.5 + 7.5 = 9.0 USD
    const c = estimateCost("gemini-3.6-flash", 1_000_000, 1_000_000);
    expect(c.estimatedCostUsd).toBeCloseTo(9.0);
    expect(c.matchedPricing).toBe(true);
    expect(c.pricingVersion).toMatch(/2026-08/);
  });

  it("derives INR from a configurable USD_TO_INR rate", () => {
    process.env.USD_TO_INR = "90";
    const c = estimateCost("gemini-3.6-flash", 1_000_000, 0);
    // 1M input = 1.5 USD * 90 = 135 INR
    expect(c.usdToInr).toBe(90);
    expect(c.estimatedCostInr).toBeCloseTo(135);
  });

  it("flags an unknown model instead of silently using its rates as exact", () => {
    const c = estimateCost("some-other-model", 1_000_000, 0);
    expect(c.matchedPricing).toBe(false);
    expect(c.pricingVersion).toMatch(/NO PRICING/);
  });
});
