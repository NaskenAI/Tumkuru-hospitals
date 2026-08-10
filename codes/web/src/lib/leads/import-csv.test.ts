import { describe, expect, it } from "vitest";

import { parseLeadCsv } from "@/lib/leads/import-csv";

describe("parseLeadCsv", () => {
  it("parses valid rows and flags duplicates in one file", () => {
    const csv = [
      "hospital_name,district,city,known_phone,known_email,known_website,source_type,source_url,notes",
      "ABC Hospital,Tumakuru,Tumakuru,9876543210,,https://abc.example,MANUAL,,",
      "ABC Clinic,Tumakuru,Tumakuru,9876543210,,https://abc.example,MANUAL,,",
    ].join("\n");

    const result = parseLeadCsv(csv);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(1);
    expect(result.records[1].duplicateInFile).toBe(true);
  });

  it("reports a missing hospital name", () => {
    const csv = [
      "hospital_name,district,city,known_phone,known_email,known_website,source_type,source_url,notes",
      ",Tumakuru,Tumakuru,,,,MANUAL,,",
    ].join("\n");

    const result = parseLeadCsv(csv);

    expect(result.validRows).toBe(0);
    expect(result.issues[0].field).toBe("hospital_name");
  });
});
