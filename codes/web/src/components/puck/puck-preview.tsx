"use client";

import { Render, type Data } from "@measured/puck";

import { hospitalPuckConfig } from "@/lib/puck/config";
import type { GeneratedContent } from "@/lib/content/content-schema";
import type { HospitalLang } from "@/lib/puck/metadata";

/**
 * Public, read-only Puck render. Approved content is passed as metadata; the
 * editor is never bundled or exposed here.
 */
export function PuckPreview({
  data,
  content,
  lang,
  slug,
}: {
  data: Data;
  content: GeneratedContent;
  lang: HospitalLang;
  slug: string;
}) {
  return (
    <Render
      config={hospitalPuckConfig}
      data={data}
      metadata={{ content, lang, slug }}
    />
  );
}
