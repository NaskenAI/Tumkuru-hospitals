/**
 * English content generation — uses the LLM to create preview website content
 * from verified facts only.
 *
 * The LLM generates JSON matching the GeneratedContent schema.
 * Every factual sentence must reference supporting_fact_ids.
 * The LLM never writes HTML or React — only structured content.
 */

import type { LlmResult } from "@/lib/ai/client";
import { extractStructured, type LlmConfig } from "@/lib/ai/client";
import {
  type GeneratedContent,
  generatedContentSchema,
  type TemplateKey,
} from "@/lib/content/content-schema";
import type { Json } from "@/lib/database/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerifiedFact = {
  id: string;
  fact_type: string;
  value: Json;
  source_excerpt: string | null;
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildGenerationPrompt(
  templateKey: TemplateKey,
  facts: VerifiedFact[],
): { systemPrompt: string; userPrompt: string } {
  const factList = facts
    .map(
      (f) =>
        `[ID: ${f.id}] ${f.fact_type}: ${typeof f.value === "string" ? f.value : JSON.stringify(f.value)}`,
    )
    .join("\n");

  const systemPrompt = `You are a professional medical copywriter creating content for an unofficial preview hospital website.

STRICT RULES:
1. Use ONLY the verified facts provided. Do not invent, infer, or embellish.
2. Every claim must reference one or more fact IDs in supporting_fact_ids.
3. Do not generate HTML, React, or any markup — only structured JSON.
4. Do not make medical promises, guarantees, or outcome claims.
5. Keep the tone professional, warm, and factual.
6. The template is: ${templateKey}.
7. Write naturally but stay strictly within the facts.

Return JSON matching the schema and nothing else.`;

  const userPrompt = `Generate preview website content for this hospital.

TEMPLATE: ${templateKey}

VERIFIED FACTS:
${factList}

Generate JSON with these fields:
- hospital_name: string
- tagline: { text: string, supporting_fact_ids: string[] }
- about: [{ text: string, supporting_fact_ids: string[] }] (1-3 paragraphs)
- specialties: [{ name, description?, supporting_fact_ids }] (if applicable)
- services: [{ name, description?, supporting_fact_ids }] (if applicable)
- doctors: [{ name, qualification?, specialty?, supporting_fact_ids }] (if applicable)
- facilities: [{ name, description?, supporting_fact_ids }] (if applicable)
- contact: { phone?, email?, address?, hours?, emergency?, supporting_fact_ids }
- accreditations: [{ text, supporting_fact_ids }] (if applicable)
- insurance: [{ text, supporting_fact_ids }] (if applicable)

Omit optional sections if no facts support them.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateEnglishContent(input: {
  templateKey: TemplateKey;
  facts: VerifiedFact[];
  config?: Partial<LlmConfig>;
}): Promise<LlmResult<GeneratedContent>> {
  if (input.facts.length === 0) {
    throw new Error("Cannot generate content without verified facts.");
  }

  const { systemPrompt, userPrompt } = buildGenerationPrompt(
    input.templateKey,
    input.facts,
  );

  return extractStructured({
    systemPrompt,
    userPrompt,
    schema: generatedContentSchema,
    config: input.config,
  });
}
