/**
 * Insurer / tie-up extraction (Section 23). A logo is NOT proof of a current
 * commercial tie-up. Names inferred from a filename slug stay low-confidence and
 * human_confirmed=false, and are distinguishable from alt/heading-sourced names.
 */

import type { CheerioAPI } from "cheerio";

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Insurer, SourcePage } from "@/lib/normalize/model";
import { collapseWs, filenameWords, titleCaseLabel } from "@/lib/normalize/text";

const JUNK = /(logo|sprite|icon|placeholder|spacer|banner|header|footer|favicon)/i;

export function parseInsurers($: CheerioAPI, page: SourcePage, pageText: string): Insurer[] {
  $("script,style,noscript,nav,header,footer").remove();
  const root = $(".entry-content").length ? $(".entry-content").first() : $("body");
  const out: Insurer[] = [];
  const seen = new Set<string>();

  root.find("img").each((_i, el) => {
    const img = $(el);
    const src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || "";
    if (!src) return;
    const alt = collapseWs(img.attr("alt") ?? "");

    let name = "";
    let name_source: Insurer["name_source"] = "filename";
    let confidence = 0.2;
    if (alt && !JUNK.test(alt)) {
      name = alt;
      name_source = "alt";
      confidence = 0.55;
    } else {
      const words = filenameWords(src).filter((w) => !JUNK.test(w) && !/^\d+$/.test(w));
      if (words.length === 0) return;
      name = titleCaseLabel(words.join(" "));
      name_source = "filename";
      confidence = 0.2;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      name,
      name_source,
      confidence,
      // No automated step ever confirms an insurer tie-up.
      human_confirmed: false,
      logo_asset: src,
      evidence: [makeEvidence(page, { excerpt: name_source === "alt" ? name : undefined, pageText })],
    });
  });

  return out;
}
