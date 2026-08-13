import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Data } from "@measured/puck";

import { PuckPreview } from "@/components/puck/puck-preview";
import { PreviewAnalytics } from "@/components/preview/preview-analytics";
import { defaultPuckPage, sanitizePuckData } from "@/lib/puck/default-page";
import type { GeneratedContent } from "@/lib/content/content-schema";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
    title: "Hospital Preview (Puck) — Nasken AI",
  };
}

async function getData(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServiceClient();

  const { data: preview } = await supabase
    .from("previews")
    .select(
      "id,lead_id,generated_content_id,slug,disclaimer_en,disclaimer_kn,status,stale_after,puck_data",
    )
    .eq("slug", slug)
    .single();

  if (!preview || preview.status === "REMOVED") return null;
  if (preview.stale_after && new Date(preview.stale_after) < new Date()) return null;

  const { data: contentRow } = await supabase
    .from("generated_content")
    .select("content_en,content_kn")
    .eq("id", preview.generated_content_id!)
    .single();
  if (!contentRow) return null;

  // Public view of the preview — record the open (device set by client event).
  await supabase.from("analytics_events").insert({
    lead_id: preview.lead_id,
    preview_id: preview.id,
    event: "preview_opened",
    device_category: null,
  });

  return {
    preview,
    contentEn: contentRow.content_en as unknown as GeneratedContent,
    contentKn: contentRow.content_kn as unknown as GeneratedContent | null,
  };
}

export default async function PuckPreviewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const data = await getData(slug);
  if (!data) notFound();

  const isKannada = lang === "kn" && data.contentKn !== null;
  const content = isKannada ? data.contentKn! : data.contentEn;
  const disclaimer = isKannada
    ? data.preview.disclaimer_kn ?? data.preview.disclaimer_en
    : data.preview.disclaimer_en;

  // Same structural page spec for both languages (presentation only). Only the
  // approved localized content changes.
  const puckData: Data = data.preview.puck_data
    ? sanitizePuckData(data.preview.puck_data as unknown as Data)
    : defaultPuckPage(content);

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <PreviewAnalytics slug={slug} />
      <div className="min-h-screen bg-white">
        {/* Unofficial-preview disclaimer */}
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} aria-hidden="true" />
            <p className="text-xs leading-5 text-amber-900">{disclaimer}</p>
          </div>
        </div>

        {/* Language toggle */}
        {data.contentKn && (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
            <div className="mx-auto flex max-w-6xl justify-end gap-2">
              <a
                href={`/preview/${slug}/puck`}
                className={`rounded-md px-3 py-1 text-xs font-medium ${!isKannada ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
              >
                English
              </a>
              <a
                href={`/preview/${slug}/puck?lang=kn`}
                className={`rounded-md px-3 py-1 text-xs font-medium ${isKannada ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
              >
                ಕನ್ನಡ
              </a>
            </div>
          </div>
        )}

        <PuckPreview data={puckData} content={content} lang={isKannada ? "kn" : "en"} slug={slug} />
      </div>
    </>
  );
}
