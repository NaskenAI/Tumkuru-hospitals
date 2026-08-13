import { describe, expect, it } from "vitest";

import { isPositioningText, parsePositioningClaims } from "@/lib/normalize/positioning";
import type { SourcePage } from "@/lib/normalize/model";

const page: SourcePage = { id: "p", url: "https://h.example/", tier: 2, html: "" };

describe("marketing / superlatives are captured separately", () => {
  it("detects positioning language", () => {
    expect(isPositioningText("#1 Best hospital in Tumkur")).toBe(true);
    expect(isPositioningText("Tumkur's finest super-specialty hospital")).toBe(true);
    expect(isPositioningText("Department of General Medicine")).toBe(false);
  });

  it("collects only superlative claims, keeping neutral facts out", () => {
    const candidates = [
      "#1 Best hospital in Tumkur",
      "We provide cardiology and orthopaedic services.",
      "A state-of-the-art facility",
    ];
    const claims = parsePositioningClaims(candidates, page, candidates.join(" "));
    const texts = claims.map((c) => c.text);
    expect(texts).toContain("#1 Best hospital in Tumkur");
    expect(texts).toContain("A state-of-the-art facility");
    expect(texts.some((t) => /cardiology and orthopaedic/i.test(t))).toBe(false);
  });
});
