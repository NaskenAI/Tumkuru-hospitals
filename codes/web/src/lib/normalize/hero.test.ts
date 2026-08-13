import { describe, expect, it } from "vitest";

import { scoreHeroCandidates, type HeroCandidateInput } from "@/lib/normalize/hero";

describe("F8 — hero scoring", () => {
  it("ranks a declared exterior photo above a crowded interior", () => {
    const candidates: HeroCandidateInput[] = [
      { asset_id: "exterior_og", classification: "EXTERIOR", width: 1024, height: 533, og_declared: true, is_photograph: true, crowding: "low" },
      { asset_id: "waiting_room", classification: "INTERIOR", width: 1024, height: 683, og_declared: false, is_photograph: true, crowding: "high" },
    ];
    const ranked = scoreHeroCandidates(candidates);
    expect(ranked[0].asset_id).toBe("exterior_og");
    expect(ranked[0].total).toBeGreaterThan(ranked[1].total);
    // ranking is inspectable
    expect(ranked[0].components).toHaveProperty("classification");
    expect(ranked[0].reasons.length).toBeGreaterThan(0);
  });

  it("does NOT let og:image win when it is actually a logo (rejection is inspectable)", () => {
    const candidates: HeroCandidateInput[] = [
      { asset_id: "og_logo", classification: "LOGO", width: 400, height: 180, og_declared: true, is_photograph: false, crowding: "low" },
      { asset_id: "real_exterior", classification: "EXTERIOR", width: 1600, height: 900, og_declared: false, is_photograph: true, crowding: "low" },
    ];
    const ranked = scoreHeroCandidates(candidates);
    expect(ranked[0].asset_id).toBe("real_exterior");
    const logo = ranked.find((r) => r.asset_id === "og_logo")!;
    expect(logo.reasons.join(" ")).toMatch(/not a hero image/i);
  });
});
