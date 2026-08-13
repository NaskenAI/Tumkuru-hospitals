/**
 * Network-gated real-source demo (Phase 2, step 12 partial).
 *
 * Runs the REAL safe-fetch -> raw_html -> deterministic website audit path
 * against a permitted public Tumakuru hospital source. Skipped unless DEMO_URL
 * is set, so it never runs in the normal offline suite.
 *
 *   DEMO_URL="https://tumkur.nic.in/en/public-utility/district-hospital-tumakuru/" \
 *     npx vitest run src/lib/research/live-audit.demo.test.ts
 *
 * This exercises steps that need NO LLM and NO database: source fetch, HTTP
 * status, raw_html vs extracted_text separation, and the website audit.
 */

import { describe, expect, it } from "vitest";

import { fetchPageText } from "@/lib/research/safe-fetch";
import { runAllAuditChecks } from "@/lib/audit/checks";

describe("live audit demo", () => {
  it.skipIf(!process.env.DEMO_URL)(
    "fetches a real source and runs the website audit",
    async () => {
      const url = process.env.DEMO_URL as string;
      const fetched = await fetchPageText(url);
      console.log(
        `\n[demo] URL: ${fetched.finalUrl}\n` +
          `[demo] HTTP status: ${fetched.httpStatus}\n` +
          `[demo] title: ${fetched.title}\n` +
          `[demo] raw_html length: ${fetched.rawHtml?.length ?? 0}\n` +
          `[demo] extracted_text length: ${fetched.rawText.length}\n`,
      );

      expect(fetched.httpStatus).toBeGreaterThanOrEqual(200);
      // raw_html and extracted_text are genuinely different representations.
      expect(fetched.rawHtml).not.toBe(fetched.rawText);

      const audit = runAllAuditChecks({
        websiteUrl: fetched.finalUrl,
        httpStatus: fetched.httpStatus,
        rawHtml: fetched.rawHtml,
      });
      console.log(
        "[demo] audit checks:\n" +
          audit.checks
            .map((c) => `  ${c.passed ? "✅" : "❌"} ${c.label}: ${c.detail}`)
            .join("\n"),
      );

      expect(audit.checks.length).toBeGreaterThan(0);
    },
    45_000,
  );
});
