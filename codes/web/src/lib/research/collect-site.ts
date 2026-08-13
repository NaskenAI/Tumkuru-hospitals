/**
 * Multi-page first-party site collection (Phase B + E persistence).
 *
 * Crawls the hospital's own site (bounded), stores one `sources` row per page
 * with page provenance, extracts first-party image assets from every page, and
 * stores them in `hospital_assets`. Non-attributive imagery (logo, hero,
 * building, gallery) is auto-approved; attributive imagery that could imply a
 * false claim if mismatched (a specific doctor, a specific facility) stays
 * PENDING for human review. No LLM. No third-party domains.
 */

import { createHash } from "node:crypto";

import { extractAssetsFromPage } from "@/lib/assets/extract";
import type { Database } from "@/lib/database/types";
import { crawlFirstPartySite, type CrawlOptions } from "@/lib/research/crawl";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

// Imagery that does not, by itself, assert a checkable fact about a named
// person or a specific capability. Safe to show without per-image human review.
const AUTO_APPROVE = new Set(["LOGO", "HERO", "HOSPITAL_EXTERIOR", "HOSPITAL_INTERIOR", "GALLERY"]);
const MIN_AUTO_APPROVE_QUALITY = 45;

export type CollectSiteSummary = {
  rootUrl: string;
  pagesCrawled: number;
  pagesStored: number;
  pages: {
    url: string;
    pageType: string;
    crawlDepth: number;
    discoveredFrom: string | null;
    httpStatus: number;
    htmlLen: number;
    textLen: number;
  }[];
  skipped: { url: string; reason: string }[];
  assetsFound: number;
  assetsStored: number;
  assetsAutoApproved: number;
  assetsByClassification: Record<string, number>;
};

export async function collectFirstPartySite(
  supabase: ServiceClient,
  leadId: string,
  rootUrl: string,
  options: CrawlOptions = {},
): Promise<CollectSiteSummary> {
  const { pages, skipped } = await crawlFirstPartySite(rootUrl, {
    maxPages: 20,
    maxDepth: 2,
    ...options,
  });

  // Existing sources for this lead — reuse the homepage row rather than
  // duplicating it, and keep source_ids for asset provenance.
  const { data: existing } = await supabase
    .from("sources")
    .select("id,url,page_type")
    .eq("lead_id", leadId);
  const urlToSourceId = new Map<string, string>(
    (existing ?? []).map((s) => [s.url ?? "", s.id]),
  );
  const existingMissingProvenance = new Map<string, string>(
    (existing ?? [])
      .filter((s) => s.url && !s.page_type)
      .map((s) => [s.url as string, s.id]),
  );

  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + 14);

  const newPageRows: Database["public"]["Tables"]["sources"]["Insert"][] = [];
  for (const p of pages) {
    if (urlToSourceId.has(p.url)) continue; // already stored (e.g. homepage)
    newPageRows.push({
      lead_id: leadId,
      url: p.url,
      source_type: "OFFICIAL_WEBSITE",
      retrieved_at: now.toISOString(),
      http_status: p.httpStatus,
      content_hash: createHash("sha256").update(`${p.url}\n${p.rawText}`).digest("hex"),
      raw_text: p.rawText,
      raw_html: p.rawHtml,
      title: p.title,
      page_type: p.pageType,
      discovered_from: p.discoveredFrom,
      crawl_depth: p.crawlDepth,
      raw_text_expires_at: expires.toISOString(),
    });
  }

  if (newPageRows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("sources")
      .insert(newPageRows)
      .select("id,url");
    if (error) throw new Error(`Persisting crawled pages failed: ${error.message}`);
    for (const row of inserted ?? []) {
      urlToSourceId.set(row.url ?? "", row.id);
    }
  }

  // Backfill page provenance on any pre-existing source (e.g. the homepage
  // collected before the crawler existed) so every stored page carries its
  // classification/depth/origin.
  for (const p of pages) {
    const id = existingMissingProvenance.get(p.url);
    if (!id) continue;
    await supabase
      .from("sources")
      .update({ page_type: p.pageType, discovered_from: p.discoveredFrom, crawl_depth: p.crawlDepth })
      .eq("id", id);
  }

  // Extract assets from every crawled page. Dedupe by URL across pages.
  const assetsByClassification: Record<string, number> = {};
  const assetRows: Database["public"]["Tables"]["hospital_assets"]["Insert"][] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    if (!p.rawHtml) continue;
    for (const a of extractAssetsFromPage(p.rawHtml, p.url, p.pageType)) {
      if (seen.has(a.originalAssetUrl)) continue;
      seen.add(a.originalAssetUrl);
      assetsByClassification[a.classification] =
        (assetsByClassification[a.classification] ?? 0) + 1;
      const autoApprove =
        AUTO_APPROVE.has(a.classification) && a.qualityScore >= MIN_AUTO_APPROVE_QUALITY;
      assetRows.push({
        lead_id: leadId,
        source_id: urlToSourceId.get(p.url) ?? null,
        source_page_url: p.url,
        original_asset_url: a.originalAssetUrl,
        alt_text: a.altText,
        width: a.width,
        height: a.height,
        classification: a.classification,
        quality_score: a.qualityScore,
        approval_status: autoApprove ? "APPROVED" : "PENDING",
      });
    }
  }

  let assetsStored = 0;
  if (assetRows.length > 0) {
    const { data, error } = await supabase
      .from("hospital_assets")
      .upsert(assetRows, { onConflict: "lead_id,original_asset_url", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Persisting assets failed: ${error.message}`);
    assetsStored = data?.length ?? 0;
  }

  return {
    rootUrl,
    pagesCrawled: pages.length,
    pagesStored: newPageRows.length,
    pages: pages.map((p) => ({
      url: p.url,
      pageType: p.pageType,
      crawlDepth: p.crawlDepth,
      discoveredFrom: p.discoveredFrom,
      httpStatus: p.httpStatus,
      htmlLen: p.rawHtml?.length ?? 0,
      textLen: p.rawText.length,
    })),
    skipped,
    assetsFound: assetRows.length,
    assetsStored,
    assetsAutoApproved: assetRows.filter((r) => r.approval_status === "APPROVED").length,
    assetsByClassification,
  };
}
