import { NextResponse, type NextRequest } from "next/server";
import type { Data } from "@measured/puck";

import { sanitizePuckData } from "@/lib/puck/default-page";
import type { Json } from "@/lib/database/types";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * POST /api/previews/[id]/design  { puckData }
 *
 * Persists the LAYOUT (presentation) spec only. It:
 *  - drops any component types not in the allowlist (fail-safe),
 *  - does NOT touch generated_content or its approval state,
 *  - never carries factual copy (components read facts from approved content).
 * Auth enforced by proxy.ts (all /api/*).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError("Supabase is not configured.", 503);
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    puckData?: unknown;
  } | null;

  if (!body?.puckData || typeof body.puckData !== "object") {
    return jsonError("Missing puckData.", 422);
  }

  // Sanitize: only allowlisted component types survive.
  const sanitized = sanitizePuckData(body.puckData as Data);

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("previews")
    .update({ puck_data: sanitized as unknown as Json })
    .eq("id", id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true, componentCount: sanitized.content.length });
}
