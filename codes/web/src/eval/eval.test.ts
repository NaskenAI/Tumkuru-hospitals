/**
 * Offline evaluation (P0-6) — `npm run eval`.
 *
 * Runs every fixture through the REAL guardrail pipeline (excerpt verification
 * -> fact storage -> claim grounding / banned-language) and reports:
 *   - extraction precision & recall vs gold facts (after excerpt filtering)
 *   - unsupported-fact rate before vs after excerpt verification
 *   - prompt-injection resistance
 *
 * This runs without an API key. It evaluates the deterministic guardrails on a
 * fixed candidate extraction. To additionally measure the live LLM extractor,
 * set LLM_API_KEY and see the (skipped) live test at the bottom.
 */

import { describe, expect, it } from "vitest";

import { buildHospitalFactPayloads } from "@/lib/extraction/facts";
import { excerptAppearsInSource } from "@/lib/extraction/excerpt";
import { extractionOutputSchema } from "@/lib/extraction/schema";
import { validateClaims } from "@/lib/content/claim-validator";
import {
  computePrecisionRecall,
  pct,
  schemaFailureRate,
  unsupportedFactRate,
  type StoredFact,
} from "@/eval/metrics";
import {
  adversarialFixtures,
  fixtures,
  goldenFixtures,
} from "@/eval/fixtures";
import type { Json } from "@/lib/database/types";

function storedFrom(payloads: { fact_type: string; value: Json }[]): StoredFact[] {
  return payloads.map((p) => ({
    fact_type: p.fact_type,
    value: typeof p.value === "string" ? p.value : JSON.stringify(p.value),
  }));
}

describe("extraction eval — golden fixtures", () => {
  let microTP = 0;
  let microStored = 0;
  let microGold = 0;
  let microCovered = 0;

  for (const fixture of goldenFixtures) {
    it(`${fixture.id}: excerpt filtering + precision/recall`, () => {
      const { payloads, rejected } = buildHospitalFactPayloads({
        leadId: "eval",
        sourceId: "eval",
        extraction: fixture.candidateExtraction,
        sourceText: fixture.sourceText,
      });

      // Every stored fact must be unverified (never auto-usable).
      expect(payloads.every((p) => p.verification_status === "UNVERIFIED")).toBe(
        true,
      );

      // Post-filter unsupported-fact rate must be zero.
      const postRate = unsupportedFactRate(
        payloads.map((p) => ({ source_excerpt: p.source_excerpt ?? "" })),
        (excerpt) => excerptAppearsInSource(fixture.sourceText, excerpt),
      );
      expect(postRate).toBe(0);

      // Any planted hallucination should have been rejected.
      const rawRate = unsupportedFactRate(
        fixture.candidateExtraction.facts,
        (excerpt) => excerptAppearsInSource(fixture.sourceText, excerpt),
      );

      const pr = computePrecisionRecall(fixture.goldFacts, storedFrom(payloads));
      microTP += pr.truePositives;
      microStored += pr.storedCount;
      microGold += pr.goldCount;
      microCovered += pr.coveredGold;

      // Per-fixture sanity: filtering removed hallucinations, so precision is high.
      expect(pr.precision).toBeGreaterThanOrEqual(0.9);
      expect(pr.recall).toBeGreaterThanOrEqual(0.8);
      console.log(
        `[golden] ${fixture.id}: precision=${pct(pr.precision)} recall=${pct(pr.recall)} ` +
          `stored=${pr.storedCount} rejected=${rejected.length} ` +
          `unsupported(before=${pct(rawRate)}, after=${pct(postRate)})`,
      );
    });
  }

  it("aggregate precision/recall meets thresholds", () => {
    const precision = microStored === 0 ? 1 : microTP / microStored;
    const recall = microGold === 0 ? 1 : microCovered / microGold;
    console.log(
      `[golden] AGGREGATE precision=${pct(precision)} recall=${pct(recall)} ` +
        `(gold=${microGold}, stored=${microStored})`,
    );
    expect(precision).toBeGreaterThanOrEqual(0.9);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });
});

describe("extraction eval — adversarial prompt injection", () => {
  let injectedFactsAccepted = 0;
  let injectionCasesBlocked = 0;
  let injectionCasesTotal = 0;

  for (const fixture of adversarialFixtures) {
    it(`${fixture.id}: extractor output is stored UNVERIFIED (first defense)`, () => {
      const { payloads } = buildHospitalFactPayloads({
        leadId: "eval",
        sourceId: "eval",
        extraction: fixture.candidateExtraction,
        sourceText: fixture.sourceText,
      });
      // No injected fact is ever auto-accepted; all require human verification.
      expect(payloads.every((p) => p.verification_status === "UNVERIFIED")).toBe(
        true,
      );
    });

    for (const injectionCase of fixture.injectionCases ?? []) {
      it(`${fixture.id}: blocks injected claim — ${injectionCase.label}`, () => {
        injectionCasesTotal += 1;
        const result = validateClaims(injectionCase.content, injectionCase.facts);
        // If the injected claim were NOT blocked, count it as accepted.
        if (result.valid) {
          injectedFactsAccepted += 1;
        } else {
          injectionCasesBlocked += 1;
        }
        expect(result.valid).toBe(false);
        console.log(
          `[adversarial] ${fixture.id} / ${injectionCase.label}: BLOCKED ` +
            `(${result.issues.length} issue(s), e.g. "${result.issues[0]?.message}")`,
        );
      });
    }
  }

  it("0 injected unsupported facts accepted", () => {
    console.log(
      `[adversarial] injected accepted=${injectedFactsAccepted}, ` +
        `blocked=${injectionCasesBlocked}/${injectionCasesTotal}`,
    );
    expect(injectedFactsAccepted).toBe(0);
    expect(injectionCasesBlocked).toBe(injectionCasesTotal);
  });
});

describe("extraction eval — schema failure rate", () => {
  it("computes schema-failure-rate over raw extractor outputs", () => {
    const rawOutputs = [
      // Valid
      JSON.stringify({ facts: [{ fact_type: "PHONE", value: "123456", source_excerpt: "x" }] }),
      // Missing required source_excerpt
      JSON.stringify({ facts: [{ fact_type: "PHONE", value: "123456" }] }),
      // Not the expected shape
      JSON.stringify({ hello: "world" }),
    ];
    const parseOk = rawOutputs.map((raw) => {
      try {
        return extractionOutputSchema.safeParse(JSON.parse(raw)).success;
      } catch {
        return false;
      }
    });
    const rate = schemaFailureRate(parseOk);
    console.log(`[schema] failure rate=${pct(rate)} (${parseOk.filter((x) => !x).length}/${parseOk.length})`);
    expect(rate).toBeCloseTo(2 / 3);
  });
});

// Live extractor evaluation — only runs when an LLM key is configured. Without
// a key it is skipped (not failed), so `npm run eval` stays green offline while
// still measuring the real model when credentials are present.
describe("extraction eval — live LLM (opt-in)", () => {
  it.skipIf(!process.env.LLM_API_KEY)(
    "extracts a golden fixture end-to-end and grounds every excerpt",
    async () => {
      const { extractHospitalFacts } = await import("@/lib/ai/extract");
      const fixture = goldenFixtures[0];
      const result = await extractHospitalFacts({
        sourceText: fixture.sourceText,
        leadId: "eval",
        sourceId: "eval",
      });

      // Everything stored must be excerpt-verified and unverified.
      expect(
        result.factPayloads.every((p) =>
          excerptAppearsInSource(fixture.sourceText, p.source_excerpt ?? ""),
        ),
      ).toBe(true);

      const pr = computePrecisionRecall(
        fixture.goldFacts,
        storedFrom(result.factPayloads),
      );
      console.log(
        `[live] ${fixture.id}: precision=${pct(pr.precision)} recall=${pct(pr.recall)} ` +
          `rejected=${result.rejectedFacts.length}`,
      );
      expect(pr.recall).toBeGreaterThanOrEqual(0.6);
    },
    60_000,
  );
});

describe("eval corpus", () => {
  it("reports fixture counts", () => {
    console.log(
      `[corpus] ${fixtures.length} fixtures: ${goldenFixtures.length} golden, ` +
        `${adversarialFixtures.length} adversarial injection`,
    );
    expect(goldenFixtures.length).toBeGreaterThanOrEqual(10);
    expect(adversarialFixtures.length).toBeGreaterThanOrEqual(2);
  });
});
