/**
 * Analytics integrity (Step 17): keep automated / internal traffic out of
 * prospect-engagement metrics. Admin and the editor already live on separate
 * (gated) routes and never hit the public preview, so they are excluded
 * structurally. This guard additionally excludes headless/bot traffic — most
 * importantly Nasken's own screenshot job, which loads the public preview.
 */

/** User agent set by the internal screenshot capturer so it is never counted. */
export const NASKEN_SCREENSHOT_UA =
  "Mozilla/5.0 (compatible; NaskenBot/1.0; +internal-screenshot-automation)";

const AUTOMATION_RE =
  /naskenbot|headless|playwright|puppeteer|lighthouse|phantomjs|\bbot\b|crawler|spider|slurp|bingpreview|curl|wget|python-requests|go-http|axios|node-fetch|okhttp/i;

/**
 * True when a request should NOT count as real prospect engagement. A missing
 * user agent (server-to-server, health checks, naive scrapers) is treated as
 * automated — real browsers always send one, and the client `page_viewed`
 * event still captures genuine human opens.
 */
export function isAutomatedUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim() === "") return true;
  return AUTOMATION_RE.test(ua);
}
