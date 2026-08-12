/**
 * Preview renderer — dispatches to one of three genuinely distinct templates
 * based on templateKey. Pure presentational; no data fetching.
 */

import type { GeneratedContent, TemplateKey } from "@/lib/content/content-schema";
import { ClinicTemplate } from "@/components/preview/templates/clinic";
import { SpecialtyTemplate } from "@/components/preview/templates/specialty";
import { MultispecialtyTemplate } from "@/components/preview/templates/multispecialty";

type PreviewRendererProps = {
  content: GeneratedContent;
  templateKey: TemplateKey;
  slug: string;
};

export function PreviewRenderer({
  content,
  templateKey,
  slug,
}: PreviewRendererProps) {
  switch (templateKey) {
    case "multispecialty":
      return <MultispecialtyTemplate content={content} slug={slug} />;
    case "specialty":
      return <SpecialtyTemplate content={content} slug={slug} />;
    case "clinic":
    default:
      return <ClinicTemplate content={content} slug={slug} />;
  }
}
