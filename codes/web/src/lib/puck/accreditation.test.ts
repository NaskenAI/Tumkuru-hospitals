import { describe, expect, it } from "vitest";

import { isHospitalAccreditation } from "@/lib/puck/accreditation";

describe("accreditation taxonomy safety", () => {
  it("rejects a doctor's professional-society membership", () => {
    expect(
      isHospitalAccreditation(
        "Dr. Vijay Tubaki is an active member of the Indian Orthopaedic Association.",
      ),
    ).toBe(false);
    expect(isHospitalAccreditation("Fellow of the Royal College of Surgeons")).toBe(false);
    expect(isHospitalAccreditation("Member of the Karnataka Medical Council")).toBe(false);
  });

  it("accepts a genuine hospital accreditation", () => {
    expect(isHospitalAccreditation("NABH accredited")).toBe(true);
    expect(isHospitalAccreditation("ISO 9001:2015 certified facility")).toBe(true);
  });
});
