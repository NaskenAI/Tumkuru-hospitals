import { describe, expect, it } from "vitest";

import { availableActions, primaryActions } from "@/lib/puck/actions";
import type { GeneratedContent } from "@/lib/content/content-schema";

function content(contact: Partial<GeneratedContent["contact"]>): GeneratedContent {
  return {
    hospital_name: "Test",
    tagline: { text: "t", supporting_fact_ids: ["a"] },
    about: [{ text: "a", supporting_fact_ids: ["a"] }],
    contact: { supporting_fact_ids: ["a"], ...contact },
  };
}

describe("CTA hierarchy (reduce duplication, keep grounding)", () => {
  it("hero shows at most the top two actions, appointment first", () => {
    const actions = availableActions(
      content({
        phone: "0816-2000000",
        address: "MG Road",
        appointment: "https://example.com/book",
      } as Partial<GeneratedContent["contact"]>),
    );
    const primary = primaryActions(actions);
    expect(primary).toHaveLength(2);
    expect(primary[0].kind).toBe("appointment");
    expect(primary[1].kind).toBe("call");
    // directions is grounded and still available in the full set, just not hero-primary.
    expect(actions.some((a) => a.kind === "directions")).toBe(true);
    expect(primary.some((a) => a.kind === "directions")).toBe(false);
  });

  it("never elevates a WhatsApp CTA inferred from a phone number", () => {
    const primary = primaryActions(availableActions(content({ phone: "0816-2000000" })));
    expect(primary.some((a) => a.kind === "whatsapp")).toBe(false);
    expect(primary[0].kind).toBe("call");
  });

  it("caps to the requested maximum", () => {
    const actions = availableActions(
      content({
        phone: "1",
        address: "A",
        appointment: "https://x/b",
      } as Partial<GeneratedContent["contact"]>),
    );
    expect(primaryActions(actions, 1)).toHaveLength(1);
    expect(primaryActions(actions, 1)[0].kind).toBe("appointment");
  });
});
