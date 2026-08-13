import { describe, expect, it } from "vitest";

import { availableActions } from "@/lib/puck/actions";
import type { GeneratedContent } from "@/lib/content/content-schema";

function content(contact: Partial<GeneratedContent["contact"]>): GeneratedContent {
  return {
    hospital_name: "Test",
    tagline: { text: "t", supporting_fact_ids: ["a"] },
    about: [{ text: "a", supporting_fact_ids: ["a"] }],
    contact: { supporting_fact_ids: ["a"], ...contact },
  };
}

describe("grounded actions", () => {
  it("does NOT produce a WhatsApp CTA from a phone number", () => {
    const actions = availableActions(content({ phone: "0816-2000000" }));
    expect(actions.some((a) => a.kind === "whatsapp")).toBe(false);
    expect(actions.some((a) => a.kind === "call")).toBe(true);
  });

  it("produces directions only when an address is present", () => {
    expect(availableActions(content({ phone: "1" })).some((a) => a.kind === "directions")).toBe(false);
    expect(
      availableActions(content({ address: "MG Road" })).some((a) => a.kind === "directions"),
    ).toBe(true);
  });

  it("produces WhatsApp only from an independent whatsapp destination", () => {
    const withWa = content({ phone: "0816-2000000" });
    (withWa.contact as { whatsapp?: string }).whatsapp = "https://wa.me/910000000000";
    expect(availableActions(withWa).some((a) => a.kind === "whatsapp")).toBe(true);
  });

  it("produces appointment only from an approved appointment path (not a phone)", () => {
    expect(availableActions(content({ phone: "1" })).some((a) => a.kind === "appointment")).toBe(false);
    const withAppt = content({ phone: "1" });
    (withAppt.contact as { appointment?: string }).appointment = "https://book.example";
    expect(availableActions(withAppt).some((a) => a.kind === "appointment")).toBe(true);
  });
});
