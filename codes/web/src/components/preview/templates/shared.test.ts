import { describe, expect, it } from "vitest";

import { directionsLink, whatsappLink } from "@/components/preview/templates/shared";

describe("preview CTA links", () => {
  it("builds a wa.me link and assumes +91 for bare 10-digit numbers", () => {
    expect(whatsappLink("9876543210")).toBe("https://wa.me/919876543210");
  });

  it("keeps an already-prefixed number as-is", () => {
    expect(whatsappLink("+91 98765 43210")).toBe("https://wa.me/919876543210");
  });

  it("returns null for numbers that are too short", () => {
    expect(whatsappLink("12345")).toBeNull();
  });

  it("builds a maps search link from an address", () => {
    expect(directionsLink("B.H. Road, Tumakuru")).toBe(
      "https://www.google.com/maps/search/?api=1&query=B.H.%20Road%2C%20Tumakuru",
    );
  });
});
