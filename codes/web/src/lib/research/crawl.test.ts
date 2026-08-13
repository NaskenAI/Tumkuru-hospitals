import { describe, expect, it } from "vitest";

import { crawlFirstPartySite } from "@/lib/research/crawl";
import type { ResolveHostname } from "@/lib/research/safe-url";

const publicResolver: ResolveHostname = async () => [
  { address: "8.8.8.8", family: 4 },
];

const HTML: Record<string, string> = {
  "/": `<html><head><title>Home</title></head><body>
    <a href="/about-us/">About</a>
    <a href="/doctors/">Our Doctors</a>
    <a href="https://facebook.com/ganga">Facebook</a>
    <a href="https://www.justdial.com/x">Justdial</a>
    <a href="/feed/">RSS</a>
    <a href="/brochure.pdf">Brochure</a>
  </body></html>`,
  "/about-us/": `<html><head><title>About Us</title></head><body>About</body></html>`,
  "/doctors/": `<html><head><title>Doctors</title></head><body>Dr X</body></html>`,
};

const fetchImpl = ((input: string | URL) => {
  const path = new URL(input.toString()).pathname;
  const body = HTML[path];
  if (body === undefined) {
    return Promise.resolve(new Response("not found", { status: 404 }));
  }
  return Promise.resolve(
    new Response(body, { status: 200, headers: { "content-type": "text/html" } }),
  );
}) as unknown as typeof fetch;

describe("bounded first-party crawler", () => {
  it("collects same-origin content pages and skips external + non-content", async () => {
    const { pages, skipped } = await crawlFirstPartySite("https://hosp.example/", {
      resolveHostname: publicResolver,
      fetchImpl,
    });
    const urls = pages.map((p) => new URL(p.url).pathname).sort();
    expect(urls).toEqual(["/", "/about-us/", "/doctors/"]);

    const skippedReasons = skipped.map((s) => `${new URL(s.url).host}:${s.reason}`);
    expect(skippedReasons.some((r) => r.startsWith("facebook.com"))).toBe(true);
    expect(skippedReasons.some((r) => r.startsWith("www.justdial.com"))).toBe(true);
    expect(skipped.some((s) => /feed/.test(s.url))).toBe(true);
    expect(skipped.some((s) => /brochure\.pdf/.test(s.url))).toBe(true);

    // page types classified
    expect(pages.find((p) => p.url.endsWith("/"))?.pageType).toBe("HOME");
    expect(pages.find((p) => /about/.test(p.url))?.pageType).toBe("ABOUT");
    expect(pages.find((p) => /doctors/.test(p.url))?.pageType).toBe("DOCTORS");
  });

  it("respects the page budget", async () => {
    const { pages } = await crawlFirstPartySite("https://hosp.example/", {
      resolveHostname: publicResolver,
      fetchImpl,
      maxPages: 2,
    });
    expect(pages).toHaveLength(2);
    // homepage always first, then highest-priority (doctors > about)
    expect(pages[0].pageType).toBe("HOME");
    expect(pages[1].pageType).toBe("DOCTORS");
  });
});
