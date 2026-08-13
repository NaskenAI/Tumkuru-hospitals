import { notFound } from "next/navigation";
import type { Data } from "@measured/puck";

import { PuckEditor } from "@/components/puck/puck-editor";
import { defaultPuckPage, sanitizePuckData } from "@/lib/puck/default-page";
import type { GeneratedContent } from "@/lib/content/content-schema";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Internal layout designer. Auth is enforced by proxy.ts (all /admin/*).
export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return <main className="p-8 text-slate-500">Supabase not configured.</main>;
  }

  const supabase = createSupabaseServiceClient();
  const { data: preview } = await supabase
    .from("previews")
    .select("id,slug,generated_content_id,puck_data")
    .eq("id", id)
    .single();
  if (!preview) notFound();

  const { data: contentRow } = await supabase
    .from("generated_content")
    .select("content_en")
    .eq("id", preview.generated_content_id!)
    .single();
  if (!contentRow?.content_en) notFound();

  const content = contentRow.content_en as unknown as GeneratedContent;
  const initialData: Data = preview.puck_data
    ? sanitizePuckData(preview.puck_data as unknown as Data)
    : defaultPuckPage(content);

  return (
    <PuckEditor
      previewId={preview.id}
      initialData={initialData}
      content={content}
      slug={preview.slug}
    />
  );
}
