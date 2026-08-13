/**
 * Lightweight LLM client — Gemini REST API via fetch.
 *
 * Keeps the project free of heavyweight SDK dependencies.
 * Supports extractStructured (JSON mode) and generateText.
 * Tracks token counts and estimated cost per call for the jobs table.
 */

import { z } from "zod";

import { DEFAULT_MODEL, estimateCost } from "@/lib/ai/pricing";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type LlmConfig = {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

const defaultModel = DEFAULT_MODEL;
const defaultMaxTokens = 4096;
const defaultTemperature = 0.1;

function getConfig(overrides?: Partial<LlmConfig>): LlmConfig {
  const apiKey = overrides?.apiKey ?? process.env.LLM_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Add it to .env.local to use AI features.",
    );
  }
  return {
    apiKey,
    model: overrides?.model ?? process.env.LLM_MODEL ?? defaultModel,
    maxTokens: overrides?.maxTokens ?? defaultMaxTokens,
    temperature: overrides?.temperature ?? defaultTemperature,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LlmUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedCostInr: number;
  pricingVersion: string;
};

export type LlmResult<T> = {
  data: T;
  usage: LlmUsage;
};

// ---------------------------------------------------------------------------
// Gemini REST helpers
// ---------------------------------------------------------------------------

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function buildGeminiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

function extractTextFromResponse(response: GeminiResponse): string {
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.trim();
}

function buildUsage(model: string, response: GeminiResponse): LlmUsage {
  const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens = response.usageMetadata?.totalTokenCount ?? 0;

  const cost = estimateCost(model, promptTokens, completionTokens);
  return {
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: cost.estimatedCostUsd,
    estimatedCostInr: cost.estimatedCostInr,
    pricingVersion: cost.pricingVersion,
  };
}

// ---------------------------------------------------------------------------
// Core call
// ---------------------------------------------------------------------------

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  config: LlmConfig,
  jsonMode: boolean,
): Promise<{ text: string; usage: LlmUsage }> {
  const url = buildGeminiUrl(config.model!, config.apiKey);

  const body: Record<string, unknown> = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: config.maxTokens,
      temperature: config.temperature,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Gemini API error ${response.status}: ${errorText.slice(0, 500)}`,
    );
  }

  const geminiResponse = (await response.json()) as GeminiResponse;
  const text = extractTextFromResponse(geminiResponse);
  const usage = buildUsage(config.model!, geminiResponse);

  return { text, usage };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call the LLM with JSON mode and parse the response against a Zod schema.
 */
export async function extractStructured<T>(input: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  config?: Partial<LlmConfig>;
}): Promise<LlmResult<T>> {
  const config = getConfig(input.config);
  const { text, usage } = await callGemini(
    input.systemPrompt,
    input.userPrompt,
    config,
    true,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `LLM returned invalid JSON. Raw output: ${text.slice(0, 500)}`,
    );
  }

  const validated = input.schema.parse(parsed);
  return { data: validated, usage };
}

/**
 * Call the LLM in plain text mode.
 */
export async function generateText(input: {
  systemPrompt: string;
  userPrompt: string;
  config?: Partial<LlmConfig>;
}): Promise<LlmResult<string>> {
  const config = getConfig(input.config);
  const { text, usage } = await callGemini(
    input.systemPrompt,
    input.userPrompt,
    config,
    false,
  );

  return { data: text, usage };
}

/**
 * Check if an LLM provider is configured.
 */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}
