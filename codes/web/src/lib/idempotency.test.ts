/**
 * Idempotency of P0-sensitive stages (Phase 2, step 17).
 *
 * Route-level idempotency is enforced by DB constraints (unique
 * import_fingerprint, unique generated_content(lead_id,template_key)) and the
 * pure helpers below, which are the parts testable without a database:
 *   - source collection: identical content → identical content_hash (dedupable)
 *   - fact extraction: re-extraction drops already-stored facts
 *   - website audit: deterministic — rerun yields identical checks
 *   - template selection: deterministic
 *   - deploy gate: re-deploy of VALIDATED content is allowed (reuses preview)
 */

import { describe, expect, it } from "vitest";

import { buildSourceSnapshot } from "@/lib/research/source-collection";
import { runAllAuditChecks } from "@/lib/audit/checks";
import { selectTemplate, countFactTypes } from "@/lib/content/template-selector";
import { filterNewFactPayloads } from "@/lib/extraction/facts";
import { evaluateDeployState } from "@/lib/content/content-workflow";

const fetched = {
  finalUrl: "https://abc.example/",
  httpStatus: 200,
  rawText: "ABC Hospital in Tumakuru",
  rawHtml: "<html><title>ABC</title><body>ABC Hospital in Tumakuru</body></html>",
  title: "ABC",
  now: new Date("2026-08-10T00:00:00Z"),
};

const input = {
  leadId: "lead-1",
  url: "https://abc.example",
  sourceType: "OFFICIAL_WEBSITE" as const,
};

describe("stage idempotency", () => {
  it("source collection: identical content yields identical content_hash", () => {
    const a = buildSourceSnapshot(input, fetched);
    const b = buildSourceSnapshot(input, fetched);
    expect(a.content_hash).toBe(b.content_hash);
  });

  it("website audit is deterministic across reruns", () => {
    const html =
      "<html><head><title>ABC</title><meta name='viewport' content='width=device-width'></head><body><a href='tel:+911234567890'>Call</a></body></html>";
    const first = runAllAuditChecks({ websiteUrl: "https://abc.example", httpStatus: 200, rawHtml: html });
    const second = runAllAuditChecks({ websiteUrl: "https://abc.example", httpStatus: 200, rawHtml: html });
    expect(second).toEqual(first);
  });

  it("template selection is deterministic", () => {
    const facts = [
      { fact_type: "SPECIALTY", verification_status: "VERIFIED" },
      { fact_type: "SPECIALTY", verification_status: "VERIFIED" },
      { fact_type: "SPECIALTY", verification_status: "VERIFIED" },
      { fact_type: "DOCTOR", verification_status: "VERIFIED" },
      { fact_type: "DOCTOR", verification_status: "VERIFIED" },
    ];
    const counts = countFactTypes(facts);
    expect(selectTemplate(counts)).toBe(selectTemplate(counts));
    expect(selectTemplate(counts)).toBe("multispecialty");
  });

  it("fact extraction re-run stores nothing new (no duplicates)", () => {
    const payload = [
      {
        lead_id: "lead-1",
        source_id: "src-1",
        fact_type: "PHONE",
        value: "123456",
        risk_tier: "LOW" as const,
        source_excerpt: "Call 123456",
        verification_status: "UNVERIFIED" as const,
      },
    ];
    const existing = payload.map((p) => ({
      fact_type: p.fact_type,
      source_excerpt: p.source_excerpt,
    }));
    expect(filterNewFactPayloads(existing, payload)).toHaveLength(0);
  });

  it("deploy re-run of VALIDATED content is allowed (reuses preview)", () => {
    expect(
      evaluateDeployState({ status: "VALIDATED", hasEnglish: true, hasKannada: true }).ok,
    ).toBe(true);
  });
});
