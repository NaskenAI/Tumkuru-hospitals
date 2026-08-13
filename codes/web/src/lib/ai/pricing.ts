/**
 * LLM model + pricing (kept together so the model↔pricing pairing is explicit
 * and never mismatched).
 *
 * Official Google paid-tier pricing, per 1,000,000 tokens.
 * Source: https://ai.google.dev/gemini-api/docs/pricing  (verified 2026-08-13)
 *
 *   gemini-3.6-flash : input $1.50 / output $7.50 per 1M tokens (GA)
 *
 * gemini-2.0-flash was retired for this project. Note: Gemini 3.x models "think"
 * by default, so output token counts (billed as output) tend to be higher than
 * 2.0 Flash for the same task — pricing is per-token, so the estimate stays
 * accurate, but absolute cost per call differs.
 */

export type ModelPricing = {
  model: string;
  pricingVersion: string;
  usdInputPerMillion: number;
  usdOutputPerMillion: number;
};

export const DEFAULT_MODEL = "gemini-3.6-flash";

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-3.6-flash": {
    model: "gemini-3.6-flash",
    pricingVersion: "ai.google.dev 2026-08 (paid tier)",
    usdInputPerMillion: 1.5,
    usdOutputPerMillion: 7.5,
  },
};

/**
 * Approximate USD→INR conversion for the INR cost estimate. Configurable via
 * USD_TO_INR; the default is a rough 2026 rate. INR estimates are NOT exact.
 */
export function usdToInrRate(): number {
  const raw = Number(process.env.USD_TO_INR);
  return Number.isFinite(raw) && raw > 0 ? raw : 88;
}

export type CostBreakdown = {
  model: string;
  pricingVersion: string;
  /** false when we have no pricing row for `model` (estimate uses default). */
  matchedPricing: boolean;
  usdInputPerMillion: number;
  usdOutputPerMillion: number;
  usdToInr: number;
  estimatedCostUsd: number;
  estimatedCostInr: number;
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): CostBreakdown {
  const matched = MODEL_PRICING[model];
  const pricing = matched ?? MODEL_PRICING[DEFAULT_MODEL];

  const usd =
    (promptTokens / 1_000_000) * pricing.usdInputPerMillion +
    (completionTokens / 1_000_000) * pricing.usdOutputPerMillion;
  const rate = usdToInrRate();

  return {
    model,
    pricingVersion: matched
      ? pricing.pricingVersion
      : `NO PRICING for "${model}" — estimate uses ${DEFAULT_MODEL} rates`,
    matchedPricing: Boolean(matched),
    usdInputPerMillion: pricing.usdInputPerMillion,
    usdOutputPerMillion: pricing.usdOutputPerMillion,
    usdToInr: rate,
    estimatedCostUsd: usd,
    estimatedCostInr: usd * rate,
  };
}
