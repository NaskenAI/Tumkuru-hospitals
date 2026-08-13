import { describe, expect, it } from "vitest";

import { parseAccreditations } from "@/lib/normalize/accreditation";
import type { SourcePage } from "@/lib/normalize/model";

const page: SourcePage = { id: "p", url: "https://h.example/about/", tier: 2, html: "" };

describe("accreditation status (APPLIED != HELD)", () => {
  it("does not upgrade an applied-for accreditation to held", () => {
    const text = "The hospital has applied for NABH accreditation.";
    const [a] = parseAccreditations([text], page, text);
    expect(a.body).toBe("NABH");
    expect(a.status).toBe("APPLIED");
  });

  it("recognizes a genuinely held accreditation", () => {
    const text = "This is a NABH accredited hospital.";
    const [a] = parseAccreditations([text], page, text);
    expect(a.status).toBe("HELD");
  });

  it("recognizes ISO certification as held", () => {
    const text = "ISO 9001:2015 certified facility.";
    const [a] = parseAccreditations([text], page, text);
    expect(a.body).toBe("ISO");
    expect(a.status).toBe("HELD");
  });

  it("never treats a doctor's membership as a hospital accreditation", () => {
    const text = "Dr. Vijay is an active member of the Spine Society (accreditation).";
    expect(parseAccreditations([text], page, text)).toHaveLength(0);
  });
});
