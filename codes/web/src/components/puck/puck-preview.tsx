"use client";

import { Render, type Data } from "@measured/puck";

import { hospitalPuckConfig } from "@/lib/puck/config";
import type { GeneratedContent } from "@/lib/content/content-schema";
import type { HospitalAssets, HospitalLang } from "@/lib/puck/metadata";
import type { HospitalTheme } from "@/lib/puck/theme";

/**
 * Public, read-only Puck render. Approved content + approved first-party assets
 * + the chosen theme are passed as metadata; the editor is never bundled or
 * exposed here.
 */
export function PuckPreview({
  data,
  content,
  lang,
  slug,
  assets,
  theme,
}: {
  data: Data;
  content: GeneratedContent;
  lang: HospitalLang;
  slug: string;
  assets: HospitalAssets;
  theme: HospitalTheme;
}) {
  return (
    <Render
      config={hospitalPuckConfig}
      data={data}
      metadata={{ content, lang, slug, assets, theme }}
    />
  );
}
