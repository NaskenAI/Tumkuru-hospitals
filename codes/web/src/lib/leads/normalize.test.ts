import { describe, expect, it } from "vitest";

import {
  buildImportFingerprint,
  normalizeName,
  normalizePhone,
  normalizeUrl,
} from "@/lib/leads/normalize";

describe("lead normalization", () => {
  it("normalizes hospital names for duplicate detection", () => {
    expect(normalizeName("ABC Hospital & Clinic")).toBe("abc and");
  });

  it("normalizes Indian phone numbers", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });

  it("normalizes websites with scheme and trailing slash cleanup", () => {
    expect(normalizeUrl("www.example.com/")).toBe("https://example.com");
  });

  it("builds a stable import fingerprint", () => {
    expect(
      buildImportFingerprint({
        hospital_name: "ABC Hospital",
        city: "Tumakuru",
        known_phone: "9876543210",
        known_website: "",
      }),
    ).toBe("abc|tumakuru|+919876543210");
  });
});
