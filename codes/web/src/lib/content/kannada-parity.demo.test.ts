/**
 * Gated helper to run the REAL validateKannada parity check on live content
 * dumped from the database, so the reviewer can see the deterministic parity
 * report before approving. Not part of the offline suite.
 *
 *   RUN_KN_PARITY=1 npx vitest run src/lib/content/kannada-parity.demo.test.ts
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateKannada } from "@/lib/content/kannada-validator";
import type { GeneratedContent } from "@/lib/content/content-schema";

describe("kannada parity (live)", () => {
  it.skipIf(!process.env.RUN_KN_PARITY)("reports parity issues", () => {
    const en = JSON.parse(
      readFileSync("/tmp/content_en.json", "utf-8"),
    ) as GeneratedContent;
    const kn = JSON.parse(
      readFileSync("/tmp/content_kn.json", "utf-8"),
    ) as GeneratedContent;
    const ids = JSON.parse(
      readFileSync("/tmp/verified_ids.json", "utf-8"),
    ) as string[];

    const result = validateKannada(en, kn, ids);
    console.log(
      `[parity] valid=${result.valid} issues=${result.issues.length}`,
    );
    for (const issue of result.issues) {
      console.log(`[parity]   ✗ ${issue.path}: ${issue.message}`);
    }
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
