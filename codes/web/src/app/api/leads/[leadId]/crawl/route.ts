import { NextResponse, type NextRequest } from "next/server";

import { collectFirstPartySite } from "@/lib/research/collect-site";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * POST /api/leads/[leadId]/crawl
 *
 * Bounded multi-page crawl of the lead's first-party site (≤20 pages, depth ≤2).
 * Persists one `sources` row per page and inventories first-party image assets.
 * No LLM, no third-party domains. Protected by the admin session (proxy.ts).
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError("Supabase is not configured.", 503);
  }

  const { leadId } = await context.params;
  const supabase = createSupabaseServiceClient();

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,known_website,seed_source_url")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return jsonError(leadError?.message ?? "Lead not found.", 404);
  }

  const rootUrl = lead.known_website ?? lead.seed_source_url ?? null;
  if (!rootUrl) {
    return jsonError("This lead has no first-party website to crawl.");
  }

  try {
    const summary = await collectFirstPartySite(supabase, leadId, rootUrl);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Crawl failed.",
      400,
    );
  }
}
