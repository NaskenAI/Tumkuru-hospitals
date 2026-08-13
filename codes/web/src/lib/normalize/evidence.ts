/**
 * Evidence construction + provenance verification. An excerpt is only marked
 * provenanceVerified when it actually occurs in the page's visible text, so a
 * downstream consumer can trust `provenanceVerified === true`.
 */

import { collapseWs } from "@/lib/normalize/text";
import type { Evidence, SourcePage } from "@/lib/normalize/model";

/** Whitespace-insensitive containment check of an excerpt within page text. */
export function excerptOccursIn(pageText: string, excerpt: string): boolean {
  const hay = collapseWs(pageText).toLowerCase();
  const needle = collapseWs(excerpt).toLowerCase();
  if (!needle) return false;
  return hay.includes(needle);
}

export function makeEvidence(
  page: Pick<SourcePage, "id" | "url" | "tier">,
  opts: { excerpt?: string; pageText?: string } = {},
): Evidence {
  const excerpt = opts.excerpt ? collapseWs(opts.excerpt).slice(0, 300) : undefined;
  const provenanceVerified =
    excerpt !== undefined && opts.pageText !== undefined
      ? excerptOccursIn(opts.pageText, excerpt)
      : false;
  return {
    sourcePageId: page.id,
    sourceUrl: page.url,
    sourceTier: page.tier,
    excerpt,
    provenanceVerified,
  };
}
