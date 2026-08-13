/**
 * Facility extraction + caption binding + relevance (Sections 12–14, 17).
 *
 * Caption binding order (strongest first): figcaption → nearest preceding
 * heading → alt → title → filename → none. A filename-derived caption is kept
 * distinguishable (caption_source="filename") and never treated as verified
 * facility identity. Category + patient relevance come from a GENERIC keyword
 * dictionary — no hospital-specific rules.
 */

import type { CheerioAPI } from "cheerio";

import { makeEvidence } from "@/lib/normalize/evidence";
import type { CaptionSource, Facility, FacilityCategory, Relevance, SourcePage } from "@/lib/normalize/model";
import { collapseWs, filenameWords, titleCaseLabel } from "@/lib/normalize/text";

type Rule = { re: RegExp; category: FacilityCategory; relevance: Relevance };

// Ordered: higher-signal clinical first, then back-of-house, moderate, admin.
const RULES: Rule[] = [
  { re: /\b(icu|intensive care)\b/i, category: "critical_care", relevance: 3 },
  { re: /\b(operation|operating|theatre|theater|\bot\b|ot complex|minor ot)\b/i, category: "surgical", relevance: 3 },
  { re: /\b(emergency|trauma|casualty)\b/i, category: "critical_care", relevance: 3 },
  { re: /\b(laborator|\blab\b|pathology)\b/i, category: "diagnostic", relevance: 3 },
  { re: /\b(x-?ray|radiolog|imaging|\bmri\b|\bct\b|\bscan\b|ultrasound|sonograph)\b/i, category: "diagnostic", relevance: 3 },
  { re: /\bpharmacy\b/i, category: "patient_services", relevance: 3 },
  { re: /\b(generator|\bstp\b|sewage|ro plant|reverse osmosis|fire (water|safety)|water (storage|tank)|hot water|boiler|\bcssd\b|medical gas|gas (system|manifold)|electrical|utility|staff quarters|laundry|mortuary|plant)\b/i, category: "infrastructure", relevance: 0 },
  { re: /\b(private ward|semi[- ]private|general ward|\bward\b|inpatient|in-patient|\bipd\b)\b/i, category: "inpatient", relevance: 2 },
  { re: /\b(consultation|opd|out[- ]?patient|waiting|lounge|physiotherap|ambulance|parking)\b/i, category: "patient_services", relevance: 2 },
  { re: /\b(reception|insurance|billing|auditorium|board room|conference|administrative|\badmin\b)\b/i, category: "other", relevance: 1 },
];

export function classifyFacility(label: string): { category: FacilityCategory; relevance: Relevance } {
  for (const r of RULES) if (r.re.test(label)) return { category: r.category, relevance: r.relevance };
  return { category: "other", relevance: 1 };
}

function slug(s: string): string {
  return collapseWs(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function imgSrc($: CheerioAPI, img: ReturnType<CheerioAPI>): string {
  return (
    img.attr("src") ||
    img.attr("data-src") ||
    img.attr("data-lazy-src") ||
    ""
  );
}

/** Extract facilities from a facilities page, binding a caption to each image. */
export function parseFacilities($: CheerioAPI, page: SourcePage, pageText: string): Facility[] {
  $("script,style,noscript,nav,header,footer").remove();
  const root = $(".entry-content").length ? $(".entry-content").first() : $("body");
  const facilities: Facility[] = [];
  let lastHeading: string | null = null;
  let idx = 0;

  root.find("h2,h3,h4,h5,h6,figure,img").each((_i, el) => {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const t = collapseWs($(el).text());
      if (t) lastHeading = t;
      return;
    }

    // Resolve to a single <img> (skip imgs already inside a figure).
    let img;
    let figcaption = "";
    if (tag === "figure") {
      img = $(el).find("img").first();
      figcaption = collapseWs($(el).find("figcaption").text());
      if (!img.length) return;
    } else {
      if ($(el).closest("figure").length) return;
      img = $(el);
    }

    const alt = collapseWs(img.attr("alt") ?? "");
    const title = collapseWs(img.attr("title") ?? "");
    const src = imgSrc($, img);

    let caption = "";
    let captionSource: CaptionSource = "none";
    if (figcaption) {
      caption = figcaption;
      captionSource = "figcaption";
    } else if (lastHeading) {
      caption = lastHeading;
      captionSource = "heading";
    } else if (alt) {
      caption = alt;
      captionSource = "alt";
    } else if (title) {
      caption = title;
      captionSource = "title";
    } else if (src) {
      caption = filenameWords(src).join(" ");
      captionSource = "filename";
    }
    if (!caption) return;

    const { category, relevance } = classifyFacility(caption);
    idx += 1;
    facilities.push({
      facility_id: `facility_${String(idx).padStart(3, "0")}_${slug(caption) || "img"}`,
      source_label: caption,
      display_label: titleCaseLabel(caption),
      category,
      patient_relevance: relevance,
      caption,
      caption_source: captionSource,
      assetRef: src || undefined,
      // A filename-derived caption is NOT verifiable in page text (weak).
      evidence: [makeEvidence(page, { excerpt: captionSource === "filename" ? undefined : caption, pageText })],
    });
  });

  return facilities;
}
