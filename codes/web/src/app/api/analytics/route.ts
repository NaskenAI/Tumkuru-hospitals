import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

// Public endpoint (exempted in proxy.ts): preview pages are shown to hospital
// owners who are not signed in. Only coarse, non-PII preview events are
// accepted, keyed by the unguessable preview slug. `preview_opened` is recorded
// server-side on render and is not accepted here.
const analyticsRequestSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  event: z.enum([
    "page_viewed",
    "call_clicked",
    "whatsapp_clicked",
    "directions_clicked",
    "contact_clicked",
  ]),
  deviceCategory: z.enum(["mobile", "desktop", "unknown"]).default("unknown"),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Analytics is best-effort; never surface config errors to public pages.
    return NextResponse.json({ ok: true, recorded: false });
  }

  const body = await request.json().catch(() => null);
  const parsed = analyticsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid event." }, { status: 422 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: preview } = await supabase
    .from("previews")
    .select("id,lead_id,status")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (!preview || preview.status === "REMOVED") {
    return NextResponse.json({ ok: true, recorded: false });
  }

  await supabase.from("analytics_events").insert({
    lead_id: preview.lead_id,
    preview_id: preview.id,
    event: parsed.data.event,
    device_category: parsed.data.deviceCategory,
  });

  return NextResponse.json({ ok: true, recorded: true });
}
