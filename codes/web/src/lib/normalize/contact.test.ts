import { describe, expect, it } from "vitest";

import { parseContact, type ContactPageInput } from "@/lib/normalize/contact";
import type { SourcePage } from "@/lib/normalize/model";

function input(id: string, path: string, html: string, pageType?: string): ContactPageInput {
  const page: SourcePage = { id, url: `https://h.example${path}`, tier: 2, pageType, html };
  return { page, pageText: html.replace(/<[^>]+>/g, " "), html };
}

describe("contact — conflicts preserved, channels separate", () => {
  it("surfaces disagreeing phone numbers as a conflict (never silently picks one)", () => {
    const { contact } = parseContact([
      input("home", "/", "<p>Call us: +91 90000 00001</p>"),
      input("contact", "/contact/", "<p>Phone: +91 90000 00002</p>"),
    ]);
    expect(contact.phones.length).toBe(2);
    expect(contact.conflicts.some((c) => c.field === "phone")).toBe(true);
  });

  it("never infers WhatsApp or appointment from a bare phone number", () => {
    const { appointment } = parseContact([
      input("home", "/", "<p>Phone: +91 90000 00001</p>"),
    ]);
    expect(appointment.channel).toBe("none");
  });

  it("uses an explicit WhatsApp link only when present", () => {
    const { appointment } = parseContact([
      input("home", "/", '<a href="https://wa.me/919000000001">Chat</a>'),
    ]);
    expect(appointment.channel).toBe("whatsapp");
  });

  it("detects an explicit 24/7 emergency statement, else unknown", () => {
    const withEmerg = parseContact([input("home", "/", "<p>We offer 24x7 emergency services.</p>")]);
    expect(withEmerg.emergency.available).toBe(true);
    const without = parseContact([input("home", "/", "<p>Open Mon-Sat.</p>")]);
    expect(without.emergency.available).toBe("unknown");
  });
});
