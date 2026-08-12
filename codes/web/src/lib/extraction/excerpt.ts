/**
 * Source-excerpt verification (P0-7).
 *
 * The LLM returns a `source_excerpt` it claims supports each fact. Nothing
 * previously checked that the excerpt actually exists in the fetched source, so
 * a model could fabricate provenance. These helpers prove the excerpt is really
 * present in the source text before the fact is stored.
 *
 * Matching is tolerant of whitespace and case differences (the text extractor
 * collapses whitespace, and casing is not semantically meaningful), and of
 * ellipsis-joined excerpts ("A ... B") where each segment must appear.
 */

// Zero-width space, ZWNJ, ZWJ, and BOM.
const ZERO_WIDTH = /[​‌‍﻿]/g;

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitEllipsisSegments(excerpt: string): string[] {
  return excerpt
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/**
 * True when `excerpt` appears in `sourceText` after normalization. An excerpt
 * built from non-contiguous fragments joined by an ellipsis passes only when
 * every fragment is present.
 */
export function excerptAppearsInSource(
  sourceText: string,
  excerpt: string,
): boolean {
  const normalizedSource = normalizeForMatch(sourceText);
  if (normalizedSource.length === 0) return false;

  const segments = splitEllipsisSegments(excerpt);
  const candidates = segments.length > 0 ? segments : [excerpt];

  return candidates.every((segment) => {
    const normalizedSegment = normalizeForMatch(segment);
    return (
      normalizedSegment.length > 0 &&
      normalizedSource.includes(normalizedSegment)
    );
  });
}
