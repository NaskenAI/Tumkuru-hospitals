/**
 * Deterministic first-party page classification for the bounded crawler.
 * Pure — URL/title based, no LLM.
 */

export type PageType =
  | "HOME"
  | "ABOUT"
  | "DOCTORS"
  | "DEPARTMENTS"
  | "SERVICES"
  | "FACILITIES"
  | "EMERGENCY"
  | "APPOINTMENT"
  | "CONTACT"
  | "GALLERY"
  | "INSURANCE"
  | "OTHER";

// Higher priority = crawled sooner within the page budget.
const RULES: Array<{ type: PageType; re: RegExp; priority: number }> = [
  { type: "DOCTORS", re: /doctor|our-team|\bteam\b|specialist|consultant|founder/i, priority: 9 },
  { type: "APPOINTMENT", re: /appoint|book-now|booking/i, priority: 9 },
  { type: "DEPARTMENTS", re: /department|special(i|t)|centre-of|center-of/i, priority: 8 },
  { type: "FACILITIES", re: /facilit|infrastructure|laborator|diagnostic|equipment|imaging/i, priority: 8 },
  { type: "ABOUT", re: /about|milestone|who-we-are|our-story|excellence|vision|mission/i, priority: 7 },
  { type: "SERVICES", re: /service|treatment|procedure/i, priority: 7 },
  { type: "EMERGENCY", re: /emergenc|casualty|trauma|24x7|24-7/i, priority: 7 },
  { type: "INSURANCE", re: /insuranc|cashless|\btpa\b|empanel/i, priority: 6 },
  { type: "CONTACT", re: /contact|reach-us|get-in-touch|location|directions/i, priority: 6 },
  { type: "GALLERY", re: /galler|photos?\b|media/i, priority: 5 },
];

// Paths that are never useful first-party content pages.
const SKIP_PATH = /\/(feed|wp-json|wp-admin|wp-login|cart|checkout|my-account|tag|category|author|3d-flip-book|jobs?|careers?|privacy|terms|sitemap)\b/i;
const SKIP_EXT = /\.(pdf|jpe?g|png|webp|avif|svg|gif|zip|docx?|xlsx?|mp4|mp3|css|js|xml|json|ico)(\?|#|$)/i;

export function shouldSkipUrl(url: string): boolean {
  return SKIP_PATH.test(url) || SKIP_EXT.test(url);
}

export function classifyPage(url: string, title?: string | null): {
  type: PageType;
  priority: number;
} {
  const hay = `${url} ${title ?? ""}`;
  try {
    const u = new URL(url);
    if (u.pathname === "/" || u.pathname === "") return { type: "HOME", priority: 10 };
  } catch {
    /* ignore */
  }
  for (const rule of RULES) {
    if (rule.re.test(hay)) return { type: rule.type, priority: rule.priority };
  }
  return { type: "OTHER", priority: 1 };
}

/** Normalized host (lowercased, leading www. stripped) for same-origin checks. */
export function normalizedHost(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isSameOrigin(url: string, rootUrl: string): boolean {
  const a = normalizedHost(url);
  const b = normalizedHost(rootUrl);
  return a !== null && a === b;
}
