import { describe, expect, it } from "vitest";

import { NASKEN_SCREENSHOT_UA, isAutomatedUserAgent } from "@/lib/analytics/automation";

describe("analytics automation exclusion", () => {
  it("excludes the internal screenshot job", () => {
    expect(isAutomatedUserAgent(NASKEN_SCREENSHOT_UA)).toBe(true);
  });

  it("excludes headless browsers, bots and scripts", () => {
    for (const ua of [
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "node-fetch",
      "Chrome-Lighthouse",
    ]) {
      expect(isAutomatedUserAgent(ua)).toBe(true);
    }
  });

  it("treats a missing user agent as non-human", () => {
    expect(isAutomatedUserAgent(null)).toBe(true);
    expect(isAutomatedUserAgent("")).toBe(true);
  });

  it("counts a real mobile/desktop browser as engagement", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]) {
      expect(isAutomatedUserAgent(ua)).toBe(false);
    }
  });
});
