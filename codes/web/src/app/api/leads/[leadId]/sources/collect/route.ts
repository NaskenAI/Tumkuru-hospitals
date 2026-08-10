import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { SourceType } from "@/lib/database/types";
import { collectSourceSnapshot } from "@/lib/research/source-collection";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const collectSourceRequestSchema = z.object({
  url: z.string().url().optional(),
  sourceType: z
    .enum(["OFFICIAL_WEBSITE", "GOVERNMENT_DIRECTORY", "MANUAL", "OTHER"])
    .optional(),
  notes: z.string().trim().optional(),
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(
      "Supabase is not configured. Fill .env.local and run the migration first.",
      503,
    );
  }

  const { leadId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = collectSourceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid source collection request.",
        issues: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,known_website,seed_source_url,source_type")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return jsonError(leadError?.message ?? "Lead not found.", 404);
  }

  const sourceUrl =
    parsed.data.url ?? lead.known_website ?? lead.seed_source_url ?? null;

  if (!sourceUrl) {
    return jsonError("This lead does not have a source URL to fetch.");
  }

  const sourceType: SourceType =
    parsed.data.sourceType ??
    (sourceUrl === lead.known_website ? "OFFICIAL_WEBSITE" : lead.source_type);

  try {
    const snapshot = await collectSourceSnapshot({
      leadId,
      url: sourceUrl,
      sourceType,
      notes: parsed.data.notes ?? null,
    });

    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .insert(snapshot)
      .select(
        "id,url,source_type,retrieved_at,http_status,content_hash,raw_text_expires_at",
      )
      .single();

    if (sourceError || !source) {
      return jsonError(sourceError?.message ?? "Source insert failed.", 500);
    }

    await supabase.from("leads").update({ status: "RESEARCHED" }).eq("id", leadId);

    return NextResponse.json({
      ok: true,
      source,
      textLength: snapshot.raw_text?.length ?? 0,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Source collection failed.",
      400,
    );
  }
}
