import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { classifyFacility, parseFacilities } from "@/lib/normalize/facilities";
import { loadGanga } from "@/lib/normalize/__fixtures__/ganga";
import type { SourcePage } from "@/lib/normalize/model";

describe("F7 — Ganga facilities: caption binding + relevance", () => {
  const { page, pageText } = loadGanga("facilities");
  const facilities = parseFacilities(cheerio.load(page.html), page, pageText);

  it("extracts facilities and binds captions to the preceding heading (not filename)", () => {
    expect(facilities.length).toBeGreaterThan(10);
    const byLabel = (re: RegExp) => facilities.find((f) => re.test(f.source_label));
    // Captions come from headings — never from ganga-hospital-tumkur-best-NN.jpg
    expect(facilities.every((f) => f.caption_source !== "filename")).toBe(true);
    expect(byLabel(/icu|intensive care/i)?.caption_source).toBe("heading");
  });

  it("ranks clinical facilities above back-of-house infrastructure", () => {
    const icu = facilities.find((f) => /icu|intensive/i.test(f.source_label));
    const generator = facilities.find((f) => /generator/i.test(f.source_label));
    const stp = facilities.find((f) => /stp|sewage/i.test(f.source_label));
    expect(icu?.patient_relevance).toBe(3);
    if (generator) expect(generator.patient_relevance).toBe(0);
    if (stp) expect(stp.patient_relevance).toBe(0);
    expect((icu?.patient_relevance ?? 0)).toBeGreaterThan(generator?.patient_relevance ?? 0);
  });
});

describe("caption binding falls through to filename (kept distinguishable)", () => {
  it("marks a filename-only image with caption_source=filename and unverified evidence", () => {
    const html = `<div class="entry-content"><figure><img src="/x/random-1200x800.jpg"></figure></div>`;
    const page: SourcePage = { id: "t", url: "https://h.example/facilities/", tier: 2, html };
    const [f] = parseFacilities(cheerio.load(html), page, "no matching visible text");
    expect(f.caption_source).toBe("filename");
    expect(f.evidence[0].provenanceVerified).toBe(false);
  });
});

describe("classifyFacility dictionary", () => {
  it("maps clinical vs infrastructure generically", () => {
    expect(classifyFacility("Operation Theatre").relevance).toBe(3);
    expect(classifyFacility("X-Ray").relevance).toBe(3);
    expect(classifyFacility("Fire Water Storage").relevance).toBe(0);
    expect(classifyFacility("Private Ward").relevance).toBe(2);
    expect(classifyFacility("Board Room").relevance).toBe(1);
  });
});
