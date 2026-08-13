"use client";

import "@measured/puck/puck.css";

import { Puck, type Data } from "@measured/puck";
import { useState } from "react";

import { hospitalPuckConfig } from "@/lib/puck/config";
import type { GeneratedContent } from "@/lib/content/content-schema";

/**
 * Internal Nasken layout editor. Edits PRESENTATION ONLY (component order +
 * variants). It cannot alter factual copy (facts come from metadata, read-only)
 * and does not touch the content approval state — it only persists puck_data.
 */
export function PuckEditor({
  previewId,
  initialData,
  content,
  slug,
}: {
  previewId: string;
  initialData: Data;
  content: GeneratedContent;
  slug: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function save(data: Data) {
    setStatus("Saving…");
    try {
      const res = await fetch(`/api/previews/${previewId}/design`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puckData: data }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      setStatus(json.ok ? "Saved ✓ (layout only — content unchanged)" : json.message ?? "Save failed");
    } catch {
      setStatus("Network error");
    }
  }

  return (
    <div className="h-screen">
      {status && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {status}
        </div>
      )}
      <Puck
        config={hospitalPuckConfig}
        data={initialData}
        metadata={{ content, lang: "en", slug }}
        onPublish={save}
        headerTitle="Layout designer (presentation only)"
      />
    </div>
  );
}
