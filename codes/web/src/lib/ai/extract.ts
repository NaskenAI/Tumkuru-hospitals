/**
 * Fact extraction — uses the LLM client to extract structured hospital facts.
 *
 * Reads the extraction prompt from prompts/extract-hospital.md and calls
 * the LLM in JSON mode, parsing the result against the extraction schema.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { LlmResult, LlmUsage } from "@/lib/ai/client";
import { extractStructured, type LlmConfig } from "@/lib/ai/client";
import { buildHospitalFactPayloads, type HospitalFactInsert } from "@/lib/extraction/facts";
import {
  type ExtractionOutput,
  extractionOutputSchema,
} from "@/lib/extraction/schema";

// ---------------------------------------------------------------------------
// Prompt loader
// ---------------------------------------------------------------------------

let cachedPrompt: { system: string; userTemplate: string } | null = null;

async function loadPrompt(): Promise<{ system: string; userTemplate: string }> {
  if (cachedPrompt) return cachedPrompt;

  const promptPath = join(process.cwd(), "prompts", "extract-hospital.md");
  const raw = await readFile(promptPath, "utf-8");

  // Split on "USER:" marker
  const userIdx = raw.indexOf("USER:");
  if (userIdx === -1) {
    throw new Error(
      "Extraction prompt missing USER: marker. Check prompts/extract-hospital.md",
    );
  }

  const systemPart = raw.slice(raw.indexOf("SYSTEM:") + "SYSTEM:".length, userIdx).trim();
  const userPart = raw.slice(userIdx + "USER:".length).trim();

  cachedPrompt = { system: systemPart, userTemplate: userPart };
  return cachedPrompt;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ExtractionResult = {
  extraction: ExtractionOutput;
  factPayloads: HospitalFactInsert[];
  usage: LlmUsage;
};

/**
 * Extract structured facts from source text using the LLM.
 */
export async function extractHospitalFacts(input: {
  sourceText: string;
  leadId: string;
  sourceId: string;
  config?: Partial<LlmConfig>;
}): Promise<ExtractionResult> {
  const prompt = await loadPrompt();
  const userPrompt = prompt.userTemplate.replace(
    "{{SOURCE_TEXT}}",
    input.sourceText,
  );

  const result: LlmResult<ExtractionOutput> = await extractStructured({
    systemPrompt: prompt.system,
    userPrompt,
    schema: extractionOutputSchema,
    config: input.config,
  });

  const factPayloads = buildHospitalFactPayloads({
    leadId: input.leadId,
    sourceId: input.sourceId,
    extraction: result.data,
  });

  return {
    extraction: result.data,
    factPayloads,
    usage: result.usage,
  };
}
