/**
 * Bounded same-origin first-party crawler (Phase B).
 *
 * BFS from the hospital's root site, collecting high-value pages first. Safety
 * is delegated to fetchPageText (SSRF/private-IP/size/timeout/redirect limits);
 * this layer additionally enforces: same-origin only (before AND after
 * redirects), HTML only, non-content paths skipped, and a strict page budget.
 * Never follows social/aggregator/third-party domains (they are not same-origin).
 */

import * as cheerio from "cheerio";

import {
  fetchPageText,
  type FetchPageTextOptions,
} from "@/lib/research/safe-fetch";
import {
  classifyPage,
  isSameOrigin,
  normalizedHost,
  shouldSkipUrl,
  type PageType,
} from "@/lib/research/page-classifier";

export type CrawledPage = {
  url: string;
  pageType: PageType;
  title: string | null;
  httpStatus: number;
  rawText: string;
  rawHtml: string | null;
  discoveredFrom: string | null;
  crawlDepth: number;
};

export type SkippedPage = { url: string; reason: string };
export type CrawlResult = { pages: CrawledPage[]; skipped: SkippedPage[] };

export type CrawlOptions = FetchPageTextOptions & {
  maxPages?: number;
  maxDepth?: number;
};

function canonical(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${normalizedHost(url)}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractLinks(
  html: string,
  baseUrl: string,
  rootUrl: string,
): { internal: string[]; notFollowed: SkippedPage[] } {
  const $ = cheerio.load(html);
  const internal = new Set<string>();
  const notFollowed = new Map<string, SkippedPage>();
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(abs)) return;
    if (!isSameOrigin(abs, rootUrl)) {
      notFollowed.set(abs, { url: abs, reason: "external domain (not first-party)" });
    } else if (shouldSkipUrl(abs)) {
      notFollowed.set(abs, { url: abs, reason: "non-content path/extension" });
    } else {
      internal.add(abs);
    }
  });
  return { internal: [...internal], notFollowed: [...notFollowed.values()] };
}

export async function crawlFirstPartySite(
  rootUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? 20;
  const maxDepth = options.maxDepth ?? 2;

  const pages: CrawledPage[] = [];
  const skipped: SkippedPage[] = [];
  const visited = new Set<string>();

  type Frontier = { url: string; depth: number; from: string | null; priority: number };
  const frontier: Frontier[] = [{ url: rootUrl, depth: 0, from: null, priority: 100 }];

  while (frontier.length > 0 && pages.length < maxPages) {
    // Highest priority first (homepage, then doctors/appointment/departments…).
    frontier.sort((a, b) => b.priority - a.priority);
    const next = frontier.shift()!;
    const key = canonical(next.url);
    if (visited.has(key)) continue;
    visited.add(key);

    if (!isSameOrigin(next.url, rootUrl)) {
      skipped.push({ url: next.url, reason: "different origin" });
      continue;
    }
    if (shouldSkipUrl(next.url)) {
      skipped.push({ url: next.url, reason: "non-content path/extension" });
      continue;
    }

    let fetched;
    try {
      fetched = await fetchPageText(next.url, options);
    } catch (e) {
      skipped.push({ url: next.url, reason: e instanceof Error ? e.message : "fetch error" });
      continue;
    }

    if (!fetched.rawHtml) {
      skipped.push({ url: fetched.finalUrl, reason: "not HTML" });
      continue;
    }
    // Redirects must stay first-party.
    if (!isSameOrigin(fetched.finalUrl, rootUrl)) {
      skipped.push({ url: fetched.finalUrl, reason: "redirected off-origin" });
      continue;
    }

    const { type } = classifyPage(fetched.finalUrl, fetched.title);
    pages.push({
      url: fetched.finalUrl,
      pageType: type,
      title: fetched.title,
      httpStatus: fetched.httpStatus,
      rawText: fetched.rawText,
      rawHtml: fetched.rawHtml,
      discoveredFrom: next.from,
      crawlDepth: next.depth,
    });

    const { internal, notFollowed } = extractLinks(fetched.rawHtml, fetched.finalUrl, rootUrl);

    // Record links we deliberately do not follow (external + non-content), once.
    for (const nf of notFollowed) {
      const ck = canonical(nf.url);
      if (visited.has(ck)) continue;
      visited.add(ck);
      skipped.push(nf);
    }

    if (next.depth < maxDepth) {
      for (const link of internal) {
        const ck = canonical(link);
        if (visited.has(ck)) continue;
        if (frontier.some((f) => canonical(f.url) === ck)) continue;
        frontier.push({
          url: link,
          depth: next.depth + 1,
          from: fetched.finalUrl,
          priority: classifyPage(link).priority,
        });
      }
    }
  }

  return { pages, skipped };
}
