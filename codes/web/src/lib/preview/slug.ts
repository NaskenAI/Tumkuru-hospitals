/**
 * Unguessable slug generation for preview URLs.
 *
 * Uses nanoid with a URL-safe alphabet. Slugs are 21 characters by default,
 * giving ~126 bits of entropy — effectively unguessable.
 */

import { nanoid } from "nanoid";

const defaultSlugLength = 21;

export function generatePreviewSlug(length: number = defaultSlugLength): string {
  return `preview-${nanoid(length)}`;
}

/**
 * Stale date: 90 days from now.
 */
export function computeStaleAfter(now: Date = new Date()): Date {
  const stale = new Date(now);
  stale.setDate(stale.getDate() + 90);
  return stale;
}
