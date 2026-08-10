/**
 * Kannada translation — translates approved English content into Kannada.
 *
 * Uses the LLM to translate, preserving names, medical terms, and
 * the exact JSON structure. supporting_fact_ids are passed through unchanged.
 */

import type { LlmResult } from "@/lib/ai/client";
import { extractStructured, type LlmConfig } from "@/lib/ai/client";
import {
  type GeneratedContent,
  generatedContentSchema,
} from "@/lib/content/content-schema";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildTranslationPrompt(content: GeneratedContent): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a professional English-to-Kannada translator specializing in healthcare content.

STRICT RULES:
1. Translate all text fields from English to Kannada.
2. Preserve ALL proper nouns exactly: hospital names, doctor names, drug names, place names.
3. Preserve all supporting_fact_ids arrays exactly as they are — do not modify them.
4. Preserve the exact JSON structure — do not add or remove fields.
5. Keep medical terms recognizable — use common Kannada medical terminology.
6. Do not add, remove, or change any factual content during translation.
7. Return valid JSON matching the same schema as the input.`;

  const userPrompt = `Translate this English hospital content to Kannada. Keep all names, IDs, and structure intact.

INPUT JSON:
${JSON.stringify(content, null, 2)}

Return the translated JSON.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function translateToKannada(input: {
  content: GeneratedContent;
  config?: Partial<LlmConfig>;
}): Promise<LlmResult<GeneratedContent>> {
  const { systemPrompt, userPrompt } = buildTranslationPrompt(input.content);

  return extractStructured({
    systemPrompt,
    userPrompt,
    schema: generatedContentSchema,
    config: {
      ...input.config,
      temperature: 0.2,
    },
  });
}
