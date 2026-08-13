import { AlertTriangle } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { HospitalV1Render } from "@/components/hospital-v1/render";
import { PreviewAnalytics } from "@/components/preview/preview-analytics";
import { isAutomatedUserAgent } from "@/lib/analytics/automation";
import { buildHospitalV1 } from "@/lib/hospital-v1/build";
import { toRenderModel } from "@/lib/hospital-v1/render-model";
import { t, type Lang } from "@/lib/hospital-v1/strings";
import { buildNormalizedHospitalForLead } from "@/lib/normalize/integration";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

// Canonical hospital preview: crawl → normalize → eligibility → Hospital V1.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
    title: "Hospital Preview — Nasken AI",
  };
}

async function getData(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServiceClient();

  const { data: preview } = await supabase
    .from("previews")
    .select("id,lead_id,slug,status,stale_after")
    .eq("slug", slug)
    .single();
  if (!preview || preview.status === "REMOVED") return null;
  if (preview.stale_after && new Date(preview.stale_after) < new Date()) return null;

  const { model, eligibility } = await buildNormalizedHospitalForLead(supabase, preview.lead_id);
  const data = buildHospitalV1(model, eligibility);
  const renderModel = toRenderModel(model);

  if (!isAutomatedUserAgent((await headers()).get("user-agent"))) {
    await supabase.from("analytics_events").insert({
      lead_id: preview.lead_id,
      preview_id: preview.id,
      event: "preview_opened",
      device_category: null,
    });
  }

  return { preview, model: renderModel, eligibility, data };
}

export default async function HospitalPreviewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { lang: langParam } = await searchParams;
  const data = await getData(slug);
  if (!data) notFound();
  const lang: Lang = langParam === "kn" ? "kn" : "en";

  return (
    <div lang={lang}>
      <meta name="robots" content="noindex, nofollow" />
      <PreviewAnalytics slug={slug} />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
        <div className="mx-auto flex max-w-6xl items-start gap-2.5">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={16} aria-hidden="true" />
          <p className="text-xs leading-5 text-amber-900">{t("unofficial_preview", lang)}</p>
        </div>
      </div>
      <HospitalV1Render
        data={data.data}
        model={data.model}
        eligibility={data.eligibility}
        lang={lang}
        slug={slug}
      />
    </div>
  );
}
