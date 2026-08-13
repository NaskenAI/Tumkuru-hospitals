/**
 * Live normalization integration (Task 1B).
 *
 *   lead → persisted source rows + persisted hospital_assets
 *        → normalization input contract
 *        → src/lib/normalize (the library — NOT duplicated here)
 *        → NormalizedHospital (+ live coverage, hero ranking, section eligibility)
 *
 * This layer only ADAPTS persisted records to the normalization contract and
 * reconciles asset approval. It contains no parsing and nothing hospital-specific.
 */

import * as cheerio from "cheerio";

import {
  isPubliclyEligible,
  normalizeAssetRow,
  type PersistedAssetRow,
} from "@/lib/normalize/assets";
import { computeSectionEligibility, type SectionEligibility } from "@/lib/normalize/eligibility";
import { scoreHeroCandidate, type HeroScore } from "@/lib/normalize/hero";
import type { HospitalStatus, NormalizedAsset, NormalizedHospital, SourcePage } from "@/lib/normalize/model";
import { normalizeHospital } from "@/lib/normalize/normalize";
import { assetBaseKey, collapseWs } from "@/lib/normalize/text";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export type PersistedSourceRow = {
  id: string;
  url: string | null;
  page_type: string | null;
  http_status: number | null;
  raw_html: string | null;
  raw_text: string | null;
  content_hash: string | null;
};

export type HeroRankEntry = {
  rank: number;
  asset: NormalizedAsset;
  score: HeroScore;
  publicEligible: boolean;
};

export type LiveNormalizationResult = {
  model: NormalizedHospital;
  heroRanking: HeroRankEntry[];
  eligibility: SectionEligibility;
  warnings: string[];
};

// Only near-empty utility pages are ignored; a genuinely sparse hospital page
// must still be normalized (Section 17), so this threshold is deliberately low.
const MIN_CONTENT_CHARS = 40;

/** Pure core: given persisted rows, produce the live normalized result. */
export function buildNormalizedHospitalFromRecords(
  sources: PersistedSourceRow[],
  assets: PersistedAssetRow[],
): LiveNormalizationResult {
  const warnings: string[] = [];

  // og:image identity keys (deterministic hero prior) from home-like pages.
  // Keyed by base filename so a full-size og:image matches a resized asset.
  const ogKeys = new Set<string>();
  for (const s of sources) {
    if (!s.raw_html) continue;
    if (!(s.page_type === "HOME" || (s.url ?? "").replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "") === "")) continue;
    const og = cheerio.load(s.raw_html)('meta[property="og:image"]').attr("content");
    if (og) ogKeys.add(assetBaseKey(og));
  }

  // Ignore (NOT fail) rows with no usable HTML/content or duplicate content.
  const supplied: PersistedSourceRow[] = [];
  const ignored: { url: string; reason: string }[] = [];
  const seenHashes = new Set<string>();
  for (const s of sources) {
    const url = s.url ?? "(unknown)";
    if (!s.raw_html || !collapseWs(s.raw_html)) {
      ignored.push({ url, reason: "no HTML content" });
      continue;
    }
    if ((s.raw_text ?? "").trim().length < MIN_CONTENT_CHARS) {
      ignored.push({ url, reason: "no hospital semantic information (too little text)" });
      continue;
    }
    if (s.content_hash && seenHashes.has(s.content_hash)) {
      ignored.push({ url, reason: "duplicate content" });
      continue;
    }
    if (s.content_hash) seenHashes.add(s.content_hash);
    supplied.push(s);
  }

  const pages: SourcePage[] = supplied.map((s) => ({
    id: s.id,
    url: s.url ?? "",
    tier: 2,
    pageType: s.page_type ?? undefined,
    html: s.raw_html ?? "",
  }));

  // Normalize assets (reuses the library; no logic duplicated here) + hero score.
  const normalizedAssets = assets.map((a) => normalizeAssetRow(a, { ogKeys }));
  const scored = normalizedAssets.map((asset) => {
    const score = scoreHeroCandidate({
      asset_id: asset.asset_id,
      classification: asset.classification,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      og_declared: asset.og_declared,
      is_photograph: asset.is_photograph,
      crowding: asset.crowding,
    });
    asset.hero_suitability = score.total;
    return { asset, score, publicEligible: isPubliclyEligible(asset.approval_state) };
  });

  const model = normalizeHospital({
    pages,
    pagesDiscovered: sources.length,
    assets: normalizedAssets,
  });

  // Live coverage semantics (Section 4): supplied vs ignored vs failed.
  const pagesFailed = model.coverage.unparsed.length;
  model.coverage = {
    ...model.coverage,
    pagesDiscovered: sources.length,
    pagesCrawled: sources.length,
    pagesSupplied: supplied.length,
    pagesIgnored: ignored.length,
    ignored,
    pagesFailed,
  };
  // Never COMPLETE if a relevant crawled page failed to parse; ignored pages are
  // intentional and explicit, so they do not block COMPLETE.
  let status: HospitalStatus;
  if (model.coverage.pagesParsed === 0) status = "FAILED";
  else if (
    pagesFailed === 0 &&
    model.hospitalName !== undefined &&
    (model.people.doctors.length > 0 || model.specialties.length > 0) &&
    model.coverage.pagesParsed + ignored.length === sources.length
  ) {
    status = "COMPLETE";
  } else {
    status = "PARTIAL";
  }
  model.status = status;

  if (ignored.length) warnings.push(`${ignored.length} page(s) ignored (no content / duplicate).`);
  if (!ogKeys.size) warnings.push("No og:image declared on any home page.");
  if (!normalizedAssets.length) warnings.push("No persisted assets for this lead.");

  const heroRanking: HeroRankEntry[] = scored
    .slice()
    .sort((a, b) => b.score.total - a.score.total || a.asset.asset_id.localeCompare(b.asset.asset_id))
    .slice(0, 5)
    .map((s, i) => ({ rank: i + 1, asset: s.asset, score: s.score, publicEligible: s.publicEligible }));

  return { model, heroRanking, eligibility: computeSectionEligibility(model), warnings };
}

/** Live entry point: load persisted records for a lead and normalize them. */
export async function buildNormalizedHospitalForLead(
  supabase: ServiceClient,
  leadId: string,
): Promise<LiveNormalizationResult> {
  const { data: sources, error: sErr } = await supabase
    .from("sources")
    .select("id,url,page_type,http_status,raw_html,raw_text,content_hash")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (sErr) throw new Error(`Loading sources failed: ${sErr.message}`);

  const { data: assets, error: aErr } = await supabase
    .from("hospital_assets")
    .select("id,source_id,source_page_url,original_asset_url,mime_type,width,height,alt_text,classification,approval_status")
    .eq("lead_id", leadId);
  if (aErr) throw new Error(`Loading assets failed: ${aErr.message}`);

  return buildNormalizedHospitalFromRecords(
    (sources ?? []) as PersistedSourceRow[],
    (assets ?? []) as PersistedAssetRow[],
  );
}
