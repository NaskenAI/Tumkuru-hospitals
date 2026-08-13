import { describe, expect, it } from "vitest";

import { detectConflicts } from "@/lib/facts/conflicts";

describe("detectConflicts", () => {
  it("flags disagreeing phone numbers from two sources", () => {
    const conflicts = detectConflicts([
      { id: "a", fact_type: "PHONE", value: "0816-2345678", source_id: "site" },
      { id: "b", fact_type: "PHONE", value: "0816 999 0000", source_id: "directory" },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].fact_type).toBe("PHONE");
    expect(conflicts[0].variants).toHaveLength(2);
  });

  it("does NOT flag the same phone in different formats from two sources", () => {
    const conflicts = detectConflicts([
      { id: "a", fact_type: "PHONE", value: "0816-2345678", source_id: "site" },
      { id: "b", fact_type: "PHONE", value: "08162345678", source_id: "directory" },
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("does NOT flag two different values from the SAME source", () => {
    // Two phones from one source is not a cross-source conflict.
    const conflicts = detectConflicts([
      { id: "a", fact_type: "PHONE", value: "111111", source_id: "site" },
      { id: "b", fact_type: "PHONE", value: "222222", source_id: "site" },
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("flags disagreeing addresses and preserves per-variant sources", () => {
    const conflicts = detectConflicts([
      { id: "a", fact_type: "ADDRESS", value: "B.H. Road, Tumakuru", source_id: "site" },
      { id: "b", fact_type: "ADDRESS", value: "MG Road, Tumakuru", source_id: "gov" },
    ]);
    expect(conflicts).toHaveLength(1);
    const [c] = conflicts;
    expect(c.variants.map((v) => v.sourceIds[0]).sort()).toEqual(["gov", "site"]);
  });

  it("ignores non-important fact types", () => {
    const conflicts = detectConflicts([
      { id: "a", fact_type: "SPECIALTY", value: "Cardiology", source_id: "site" },
      { id: "b", fact_type: "SPECIALTY", value: "Orthopedics", source_id: "gov" },
    ]);
    expect(conflicts).toHaveLength(0);
  });
});
