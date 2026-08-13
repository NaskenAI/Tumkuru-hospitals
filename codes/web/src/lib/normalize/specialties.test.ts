import { describe, expect, it } from "vitest";

import { computeProminence, normalizeSpecialtyLabel } from "@/lib/normalize/specialties";

describe("F3 — specialty typo preserved + normalized display", () => {
  it("keeps the source typo but cleans the display label", () => {
    const r = normalizeSpecialtyLabel("JOINT REPLACAMENT");
    expect(r.source_label).toBe("JOINT REPLACAMENT");
    expect(r.display_label).toBe("Joint Replacement");
    expect(r.known).toBe(true);
  });

  it("keeps unknown specialties representable (not dropped)", () => {
    const r = normalizeSpecialtyLabel("FETAL MEDICINE UNIT");
    expect(r.source_label).toBe("FETAL MEDICINE UNIT");
    expect(r.display_label).toBe("Fetal Medicine Unit");
    expect(r.known).toBe(false);
  });
});

describe("specialty prominence", () => {
  it("increases with people, dedicated page and facility", () => {
    const base = computeProminence({ personCount: 1, dedicatedDepartmentPage: false, dedicatedFacility: false, homepageOrMetaMention: false });
    const more = computeProminence({ personCount: 5, dedicatedDepartmentPage: true, dedicatedFacility: true, homepageOrMetaMention: true });
    expect(more).toBeGreaterThan(base);
  });
});
