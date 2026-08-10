import { describe, expect, it } from "vitest";

import { fetchPageText } from "@/lib/research/safe-fetch";
import type { ResolveHostname } from "@/lib/research/safe-url";

const publicResolver: ResolveHostname = async () => [
  { address: "8.8.8.8", family: 4 },
];

describe("fetchPageText", () => {
  it("extracts visible text from HTML without scripts", async () => {
    const result = await fetchPageText("https://example.com", {
      resolveHostname: publicResolver,
      fetchImpl: async () =>
        new Response(
          "<html><head><script>alert('x')</script></head><body><h1>ABC Hospital</h1><p>Phone 9876543210</p></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    });

    expect(result.rawText).toBe("ABC Hospital Phone 9876543210");
  });

  it("blocks redirects to unsafe URLs", async () => {
    await expect(
      fetchPageText("https://example.com", {
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://localhost/private" },
          }),
      }),
    ).rejects.toThrow("Localhost URLs are not allowed.");
  });

  it("enforces the response size cap", async () => {
    await expect(
      fetchPageText("https://example.com", {
        maxBytes: 5,
        resolveHostname: publicResolver,
        fetchImpl: async () =>
          new Response("more than five bytes", {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      }),
    ).rejects.toThrow("Response exceeded maximum size.");
  });
});
