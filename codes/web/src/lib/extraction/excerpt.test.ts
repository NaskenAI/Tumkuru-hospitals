import { describe, expect, it } from "vitest";

import { excerptAppearsInSource } from "@/lib/extraction/excerpt";

const source =
  "Welcome to ABC Hospital, Tumakuru.\nWe offer Cardiology and Orthopedics.\nCall 0816-222-3344.";

describe("excerptAppearsInSource", () => {
  it("matches an exact excerpt", () => {
    expect(excerptAppearsInSource(source, "ABC Hospital, Tumakuru")).toBe(true);
  });

  it("is tolerant of whitespace and case differences", () => {
    expect(
      excerptAppearsInSource(source, "we   offer CARDIOLOGY and orthopedics"),
    ).toBe(true);
  });

  it("matches ellipsis-joined fragments when both are present", () => {
    expect(
      excerptAppearsInSource(source, "ABC Hospital ... Orthopedics"),
    ).toBe(true);
  });

  it("rejects a fabricated excerpt", () => {
    expect(
      excerptAppearsInSource(source, "NABH accredited multispecialty since 2015"),
    ).toBe(false);
  });

  it("rejects when only one ellipsis fragment is present", () => {
    expect(
      excerptAppearsInSource(source, "ABC Hospital ... Neurosurgery unit"),
    ).toBe(false);
  });

  it("rejects everything against empty source text", () => {
    expect(excerptAppearsInSource("", "anything")).toBe(false);
  });
});
