import { describe, expect, it } from "vitest";

import { engagementLabel, summarizeEvents } from "@/lib/analytics/summary";

describe("analytics summary", () => {
  it("labels NOT VIEWED with no events", () => {
    const s = summarizeEvents([]);
    expect(s.opens).toBe(0);
    expect(s.label).toBe("NOT VIEWED");
    expect(s.lastOpened).toBeNull();
  });

  it("labels VIEWED when opened but no CTA clicked", () => {
    const s = summarizeEvents([
      { event: "preview_opened", created_at: "2026-08-10T10:00:00Z" },
      { event: "page_viewed", created_at: "2026-08-10T10:00:01Z" },
    ]);
    expect(s.opens).toBe(2);
    expect(s.label).toBe("VIEWED");
    expect(s.lastOpened).toBe("2026-08-10T10:00:01Z");
  });

  it("labels ENGAGED when a CTA is clicked and counts each CTA", () => {
    const s = summarizeEvents([
      { event: "preview_opened", created_at: "2026-08-10T10:00:00Z" },
      { event: "call_clicked", created_at: "2026-08-10T10:01:00Z" },
      { event: "whatsapp_clicked", created_at: "2026-08-10T10:02:00Z" },
      { event: "directions_clicked", created_at: "2026-08-10T10:03:00Z" },
      { event: "contact_clicked", created_at: "2026-08-10T10:04:00Z" },
    ]);
    expect(s.label).toBe("ENGAGED");
    expect(s.callClicks).toBe(1);
    expect(s.whatsappClicks).toBe(1);
    expect(s.directionsClicks).toBe(1);
    expect(s.contactClicks).toBe(1);
    expect(s.totalCtaClicks).toBe(4);
  });

  it("engagementLabel rule is deterministic", () => {
    expect(engagementLabel(0, 0)).toBe("NOT VIEWED");
    expect(engagementLabel(3, 0)).toBe("VIEWED");
    expect(engagementLabel(0, 1)).toBe("ENGAGED");
    expect(engagementLabel(5, 2)).toBe("ENGAGED");
  });
});
