import { type NextRequest } from "next/server";

import { fetchSafeImage } from "@/lib/research/safe-fetch";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

// Small bounded in-process cache: first-party images are immutable, so we avoid
// re-fetching the same upstream image on every request (also keeps the public
// preview snappy under a burst of image loads). Not a correctness dependency.
type CacheEntry = { contentType: string; bytes: Uint8Array; expires: number };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 60;

function cacheGet(id: string): CacheEntry | null {
  const hit = CACHE.get(id);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    CACHE.delete(id);
    return null;
  }
  // refresh LRU position
  CACHE.delete(id);
  CACHE.set(id, hit);
  return hit;
}

function cacheSet(id: string, entry: CacheEntry) {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(id, entry);
}

/**
 * GET /api/assets/[id]
 *
 * Same-origin proxy for a first-party hospital image. Public (allowlisted in
 * proxy.ts) because the public preview page renders these, but it only serves
 * assets whose approval_status is APPROVED and re-validates the upstream URL
 * through fetchSafeImage (SSRF/private-IP/size/redirect guards). It is a proxy
 * for our own stored URLs, never an open image fetcher.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return new Response("Not configured", { status: 503 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();

  const { data: asset } = await supabase
    .from("hospital_assets")
    .select("original_asset_url,approval_status")
    .eq("id", id)
    .single();

  // Approval is always checked against the DB (so a later REJECT takes effect
  // immediately); only the fetched bytes are cached.
  if (!asset || asset.approval_status !== "APPROVED") {
    return new Response("Not found", { status: 404 });
  }

  const respond = (contentType: string, bytes: Uint8Array) =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": contentType,
        // First-party images are immutable content; let the browser cache.
        "cache-control": "public, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
        // Defense in depth: neutralize any active content if navigated directly.
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });

  const cached = cacheGet(id);
  if (cached) return respond(cached.contentType, cached.bytes);

  try {
    const image = await fetchSafeImage(asset.original_asset_url);
    cacheSet(id, {
      contentType: image.contentType,
      bytes: image.bytes,
      expires: Date.now() + CACHE_TTL_MS,
    });
    return respond(image.contentType, image.bytes);
  } catch {
    return new Response("Upstream image unavailable", { status: 502 });
  }
}
