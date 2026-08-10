import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { Database } from "@/lib/database/types";
import { jsonValueSchema } from "@/lib/extraction/schema";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const reviewFactRequestSchema = z.object({
  action: z.enum(["SAVE", "VERIFY", "REJECT"]),
  value: jsonValueSchema.optional(),
  sourceExcerpt: z.string().trim().min(1).optional(),
  reviewer: z.string().trim().min(1).default("local-admin"),
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ factId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return jsonError(
      "Supabase is not configured. Fill .env.local and run the migration first.",
      503,
    );
  }

  const { factId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = reviewFactRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid fact review request.",
        issues: parsed.error.issues,
      },
      { status: 422 },
    );
  }

  const updatePayload: Database["public"]["Tables"]["hospital_facts"]["Update"] =
    {};

  if (parsed.data.value !== undefined) {
    updatePayload.value = parsed.data.value;
  }

  if (parsed.data.sourceExcerpt !== undefined) {
    updatePayload.source_excerpt = parsed.data.sourceExcerpt;
  }

  if (parsed.data.action === "VERIFY") {
    updatePayload.verification_status = "VERIFIED";
    updatePayload.verified_by = parsed.data.reviewer;
    updatePayload.verified_at = new Date().toISOString();
  }

  if (parsed.data.action === "REJECT") {
    updatePayload.verification_status = "REJECTED";
    updatePayload.verified_by = parsed.data.reviewer;
    updatePayload.verified_at = new Date().toISOString();
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("hospital_facts")
    .update(updatePayload)
    .eq("id", factId)
    .select(
      "id,fact_type,value,risk_tier,source_excerpt,verification_status,verified_by,verified_at",
    )
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? "Fact not found.", 404);
  }

  return NextResponse.json({ ok: true, fact: data });
}
