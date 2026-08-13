import { describe, expect, it } from "vitest";

import { parseMilestones } from "@/lib/normalize/milestones";
import type { SourcePage } from "@/lib/normalize/model";

const page: SourcePage = { id: "p", url: "https://h.example/milestones/", tier: 2, html: "" };

describe("milestones — supported dated events only", () => {
  it("does not infer history from copyright / footer year ranges / bare years", () => {
    const candidates = [
      "© 2017–26 Ganga Hospital. All rights reserved.",
      "Copyright 2020",
      "2019",
    ];
    expect(parseMilestones(candidates, page, candidates.join(" "))).toHaveLength(0);
  });

  it("captures a supported dated event with precision", () => {
    const text = "The hospital was established in February 2024 by its founder.";
    const [m] = parseMilestones([text], page, text);
    expect(m.date.year).toBe(2024);
    expect(m.date.month).toBe(2);
  });
});
