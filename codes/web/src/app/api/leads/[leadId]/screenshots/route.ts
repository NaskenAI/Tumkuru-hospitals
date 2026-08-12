import { NextResponse, type NextRequest } from "next/server";

import { capturePreviewScreenshots } from "@/lib/screenshots/capture";
import { createSupabaseScreenshotStore } from "@/lib/screenshots/store";
import { runJobWithTracking } from "@/lib/jobs/runner";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * POST /api/leads/[leadId]/screenshots
 *
 * Captures desktop + mobile screenshots of the deployed preview and stores the
 * URLs on the preview row. Screenshot failure does NOT fail the pipeline: the
 * stage is recorded FAILED (retryable) and the route returns 200 captured:false.
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

  const { data: preview } = await supabase
    .from("previews")
    .select("id,slug,status")
    .eq("lead_id", leadId)
    .neq("status", "REMOVED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!preview) {
    return jsonError("No deployed preview found. Deploy first.", 404);
  }

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/preview/${preview.slug}`;

  try {
    const { result } = await runJobWithTracking({
      leadId,
      jobType: "captureScreenshots",
      execute: async () => {
        const capture = await capturePreviewScreenshots({ url });
        if (!capture.ok) {
          throw new Error(capture.error);
        }

        const store = createSupabaseScreenshotStore();
        const desktopPath = await store.save({
          key: `${preview.slug}/desktop.png`,
          bytes: capture.desktop,
          contentType: "image/png",
        });
        const mobilePath = await store.save({
          key: `${preview.slug}/mobile.png`,
          bytes: capture.mobile,
          contentType: "image/png",
        });

        await supabase
          .from("previews")
          .update({
            desktop_screenshot_path: desktopPath,
            mobile_screenshot_path: mobilePath,
          })
          .eq("id", preview.id);

        return { result: { desktopPath, mobilePath } };
      },
    });

    return NextResponse.json({ ok: true, captured: true, ...result });
  } catch (error) {
    // Recorded as a FAILED job by runJobWithTracking; surface as retryable
    // without failing the overall pipeline.
    return NextResponse.json({
      ok: true,
      captured: false,
      error: error instanceof Error ? error.message : "Screenshot capture failed.",
    });
  }
}
