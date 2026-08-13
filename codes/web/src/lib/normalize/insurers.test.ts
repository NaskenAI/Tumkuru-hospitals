import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { parseInsurers } from "@/lib/normalize/insurers";
import { loadGanga } from "@/lib/normalize/__fixtures__/ganga";

describe("F10 — Ganga insurers: filename-derived names remain unconfirmed", () => {
  const { page, pageText } = loadGanga("insurers");
  const insurers = parseInsurers(cheerio.load(page.html), page, pageText);

  it("extracts insurer logos", () => {
    expect(insurers.length).toBeGreaterThan(3);
  });

  it("never marks an insurer human_confirmed and keeps filename names low-confidence", () => {
    expect(insurers.every((i) => i.human_confirmed === false)).toBe(true);
    const filenameDerived = insurers.filter((i) => i.name_source === "filename");
    expect(filenameDerived.length).toBeGreaterThan(0);
    expect(filenameDerived.every((i) => i.confidence <= 0.3)).toBe(true);
  });
});
