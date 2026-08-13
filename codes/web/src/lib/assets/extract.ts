/**
 * First-party image asset extraction + deterministic classification (Phase E/F).
 *
 * Pulls <img> (incl. lazy data-src / srcset) from a first-party page's HTML,
 * keeps only same-host images, filters junk (icons/trackers/tiny/svg), and
 * classifies by filename/alt/page-type/dimensions. Classification is a hint for
 * layout — never treated as factual evidence. No LLM.
 */

import * as cheerio from "cheerio";

import { normalizedHost } from "@/lib/research/page-classifier";

export type AssetClassification =
  | "LOGO"
  | "HOSPITAL_EXTERIOR"
  | "HOSPITAL_INTERIOR"
  | "HERO"
  | "DOCTOR"
  | "FACILITY"
  | "DEPARTMENT"
  | "INSURANCE_LOGO"
  | "GALLERY"
  | "ICON"
  | "OTHER";

export type ExtractedAsset = {
  originalAssetUrl: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  classification: AssetClassification;
  qualityScore: number;
};

const JUNK = /(spacer|blank|placeholder|pixel|tracking|1x1|loading|sprite|favicon|whatsapp-icon|facebook|twitter|instagram|youtube|linkedin|social)/i;

/** WordPress resized files embed dimensions: name-800x600.jpg */
function dimsFromUrl(url: string): { w: number; h: number } | null {
  const m = url.match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|avif)/i);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]) };
}

function classify(
  url: string,
  alt: string | null,
  pageType: string,
  w: number | null,
  h: number | null,
): AssetClassification {
  const hay = `${url} ${alt ?? ""}`.toLowerCase();
  if (/logo/.test(hay)) return "LOGO";
  if (/icon|badge|arrow|bullet/.test(hay)) return "ICON";
  if (pageType === "INSURANCE" || /insur|cashless|\btpa\b/.test(hay)) return "INSURANCE_LOGO";
  if (pageType === "DOCTORS" || /\bdr[-_. ]|doctor|founder|surgeon|physician|consultant/.test(hay)) return "DOCTOR";
  if (pageType === "FACILITIES" || /facilit|laborator|\bicu\b|operation|theatre|\bot\b|ward|equipment|diagnostic|\bscan\b|x-?ray|\bmri\b|\bct\b|pharmacy|ambulance/.test(hay)) return "FACILITY";
  if (pageType === "DEPARTMENTS" || /department|cardiolog|orthop|neurolog|oncolog/.test(hay)) return "DEPARTMENT";
  if (/exterior|building|outside|front-?view|campus|premises/.test(hay)) return "HOSPITAL_EXTERIOR";
  if (/interior|inside|lobby|reception|waiting/.test(hay)) return "HOSPITAL_INTERIOR";
  if (/hero|banner|slider|slide|carousel|cover|hospital-with|finest|super-specialty|expert-care/.test(hay)) return "HERO";
  // Large landscape image → likely hero/exterior.
  if (w && h && w >= 1000 && w >= h) return "HERO";
  return "GALLERY";
}

function quality(
  url: string,
  w: number | null,
  h: number | null,
  cls: AssetClassification,
): number {
  let score = 40;
  if (/wp-content\/uploads/i.test(url)) score += 20; // real content, not theme chrome
  if (w && h) {
    const area = w * h;
    if (area >= 1_000_000) score += 30;
    else if (area >= 300_000) score += 20;
    else if (area >= 60_000) score += 8;
    else score -= 25; // small
  }
  if (cls === "ICON" || cls === "OTHER") score -= 20;
  if (cls === "HERO" || cls === "HOSPITAL_EXTERIOR") score += 8;
  return Math.max(0, Math.min(100, score));
}

function pickFromSrcset(srcset: string): string | null {
  // "a.jpg 400w, b.jpg 800w" → largest
  const parts = srcset
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: Number((w ?? "").replace(/\D/g, "")) || 0 }))
    .filter((p) => p.u);
  if (parts.length === 0) return null;
  parts.sort((a, b) => b.w - a.w);
  return parts[0].u;
}

export function extractAssetsFromPage(
  html: string,
  pageUrl: string,
  pageType: string,
): ExtractedAsset[] {
  const $ = cheerio.load(html);
  const host = normalizedHost(pageUrl);
  const byUrl = new Map<string, ExtractedAsset>();

  $("img").each((_i, el) => {
    const $el = $(el);
    const raw =
      $el.attr("src") ||
      $el.attr("data-src") ||
      $el.attr("data-lazy-src") ||
      $el.attr("data-original") ||
      (($el.attr("srcset") || $el.attr("data-srcset")) &&
        pickFromSrcset($el.attr("srcset") || $el.attr("data-srcset") || "")) ||
      "";
    if (!raw || raw.startsWith("data:")) return;

    let abs: string;
    try {
      abs = new URL(raw, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(abs)) return;
    if (/\.svg(\?|#|$)/i.test(abs)) return; // vector icons
    if (normalizedHost(abs) !== host) return; // first-party only
    if (JUNK.test(abs)) return;

    const alt = $el.attr("alt")?.trim() || null;
    const attrW = Number($el.attr("width")) || null;
    const attrH = Number($el.attr("height")) || null;
    const urlDims = dimsFromUrl(abs);
    const w = attrW || urlDims?.w || null;
    const h = attrH || urlDims?.h || null;

    // Drop tiny images.
    if (w && h && w < 80 && h < 80) return;

    const classification = classify(abs, alt, pageType, w, h);
    if (classification === "ICON") return; // never a usable content image

    const qualityScore = quality(abs, w, h, classification);
    const existing = byUrl.get(abs);
    if (!existing || qualityScore > existing.qualityScore) {
      byUrl.set(abs, { originalAssetUrl: abs, altText: alt, width: w, height: h, classification, qualityScore });
    }
  });

  return [...byUrl.values()];
}
