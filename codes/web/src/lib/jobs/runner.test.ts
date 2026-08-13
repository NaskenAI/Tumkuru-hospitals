import { describe, expect, it } from "vitest";

import { LLM_JOB_TYPES, checkCostCaps } from "@/lib/jobs/runner";

describe("job cost caps", () => {
  it("enforces caps only for jobs that call the LLM", () => {
    expect(LLM_JOB_TYPES.has("extractFacts")).toBe(true);
    expect(LLM_JOB_TYPES.has("generateContent")).toBe(true);
    expect(LLM_JOB_TYPES.has("translateContent")).toBe(true);
    expect(LLM_JOB_TYPES.has("generateOutreachDraft")).toBe(true);
    // Non-LLM jobs must never be blocked by an LLM budget they don't consume.
    expect(LLM_JOB_TYPES.has("captureScreenshots")).toBe(false);
    expect(LLM_JOB_TYPES.has("auditWebsite")).toBe(false);
    expect(LLM_JOB_TYPES.has("scoreLead")).toBe(false);
    expect(LLM_JOB_TYPES.has("deployPreview")).toBe(false);
  });

  it("default token cap fits a full Gemini-3.x hospital run", () => {
    // Default (no env override) is 50000 — a real run is ~25-35k tokens.
    expect(checkCostCaps({ totalTokens: 35000, totalCostInr: 20 }).withinCaps).toBe(true);
    expect(checkCostCaps({ totalTokens: 60000, totalCostInr: 20 }).withinCaps).toBe(false);
    expect(checkCostCaps({ totalTokens: 100, totalCostInr: 999 }).withinCaps).toBe(false);
  });
});
