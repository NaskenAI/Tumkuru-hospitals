import { describe, expect, it } from "vitest";

import { chooseTheme, themeVars, type HospitalTheme } from "@/lib/puck/theme";
import type { GeneratedContent } from "@/lib/content/content-schema";

function content(over: Partial<GeneratedContent>): GeneratedContent {
  return {
    hospital_name: "Test",
    tagline: { text: "t", supporting_fact_ids: ["a"] },
    about: [{ text: "a", supporting_fact_ids: ["a"] }],
    contact: { supporting_fact_ids: ["a"] },
    ...over,
  };
}

describe("theme system", () => {
  it("picks PREMIUM_SPECIALTY for a broad specialty roster", () => {
    const c = content({
      specialties: Array.from({ length: 6 }, (_, i) => ({
        name: `S${i}`,
        supporting_fact_ids: ["a"],
      })),
    });
    expect(chooseTheme(c)).toBe("PREMIUM_SPECIALTY");
  });

  it("picks MODERN_CLINICAL for a focused clinic with emergency", () => {
    const c = content({ contact: { supporting_fact_ids: ["a"], emergency: "24/7" } });
    expect(chooseTheme(c)).toBe("MODERN_CLINICAL");
  });

  it("falls back to COMMUNITY otherwise", () => {
    expect(chooseTheme(content({}))).toBe("COMMUNITY");
  });

  it("themeVars exposes brand custom properties for every theme", () => {
    const themes: HospitalTheme[] = [
      "MODERN_CLINICAL",
      "COMMUNITY",
      "PREMIUM_SPECIALTY",
    ];
    for (const t of themes) {
      const vars = themeVars(t) as Record<string, string>;
      expect(vars["--brand"]).toMatch(/^#/);
      expect(vars["--brand-strong"]).toMatch(/^#/);
      expect(vars["--on-brand"]).toMatch(/^#/);
    }
  });
});
