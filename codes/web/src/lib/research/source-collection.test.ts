import { describe, expect, it } from "vitest";

import {
  buildSourceSnapshot,
  collectSourceSnapshot,
} from "@/lib/research/source-collection";
import type { ResolveHostname } from "@/lib/research/safe-url";

const publicResolver: ResolveHostname = async () => [
  { address: "8.8.8.8", family: 4 },
];

describe("source collection", () => {
  it("builds a source snapshot with hash and retention window", () => {
    const snapshot = buildSourceSnapshot(
      {
        leadId: "lead-1",
        url: "https://example.com",
        sourceType: "OFFICIAL_WEBSITE",
        now: new Date("2026-08-10T00:00:00.000Z"),
      },
      {
        finalUrl: "https://example.com",
        httpStatus: 200,
        rawText: "ABC Hospital",
        rawHtml: "<html><body><h1>ABC Hospital</h1></body></html>",
      },
    );

    expect(snapshot.lead_id).toBe("lead-1");
    expect(snapshot.content_hash).toHaveLength(64);
    expect(snapshot.raw_text_expires_at).toBe("2026-08-24T00:00:00.000Z");
    expect(snapshot.raw_html).toContain("<h1>ABC Hospital</h1>");
  });

  it("collects visible source text through the safe fetcher", async () => {
    const snapshot = await collectSourceSnapshot(
      {
        leadId: "lead-1",
        url: "https://example.com",
        sourceType: "OFFICIAL_WEBSITE",
        now: new Date("2026-08-10T00:00:00.000Z"),
      },
      {
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(
            "<html><head><title>ABC Hospital</title></head><body><main>ABC Hospital</main></body></html>",
            {
              status: 200,
              headers: { "content-type": "text/html" },
            },
          ),
      },
    );

    expect(snapshot.url).toBe("https://example.com/");
    expect(snapshot.raw_text).toBe("ABC Hospital");
    expect(snapshot.raw_html).toContain("<main>ABC Hospital</main>");
    expect(snapshot.title).toBe("ABC Hospital");
  });
});
