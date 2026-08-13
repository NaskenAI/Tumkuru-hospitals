/**
 * Gemini live provider smoke test (gated). Runs only when RUN_LIVE_SMOKE is set,
 * so it never runs in the normal offline suite. Uses the repository's actual
 * provider code (generateText / extractStructured). No hospital data.
 *
 *   set -a; . ./.env.local; set +a; \
 *     RUN_LIVE_SMOKE=1 npx vitest run src/lib/ai/live-smoke.demo.test.ts
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  extractStructured,
  generateText,
  isLlmConfigured,
} from "@/lib/ai/client";
import { DEFAULT_MODEL } from "@/lib/ai/pricing";

describe("gemini live smoke", () => {
  it.skipIf(!process.env.RUN_LIVE_SMOKE)(
    "basic + structured live call through the real provider code",
    async () => {
      // 1 + 2: key detected (never printed) and model is the approved one.
      expect(isLlmConfigured()).toBe(true);
      const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
      console.log(`[smoke] model: ${model}`);
      expect(model).toBe("gemini-3.6-flash");

      // 3: one inexpensive basic request through generateText.
      const basic = await generateText({
        systemPrompt: "You are a connectivity test.",
        userPrompt: "Reply with exactly one word: pong",
      });
      console.log(
        `[smoke] basic reply: ${JSON.stringify(basic.data.slice(0, 30))}`,
      );
      console.log(
        `[smoke] basic usage: prompt=${basic.usage.promptTokens} completion=${basic.usage.completionTokens} total=${basic.usage.totalTokens} usd=${basic.usage.estimatedCostUsd.toFixed(6)} inr=${basic.usage.estimatedCostInr.toFixed(4)} pricing="${basic.usage.pricingVersion}"`,
      );
      expect(basic.data.length).toBeGreaterThan(0);

      // 4 + 5: structured output via the SAME extraction mechanism, validated by
      // the repo's Zod schema (extractStructured throws on schema mismatch).
      const schema = z.object({ answer: z.number() });
      const structured = await extractStructured({
        systemPrompt: "Return only JSON.",
        userPrompt: 'What is 2+2? Return JSON of the form {"answer": <number>}',
        schema,
      });
      console.log(`[smoke] structured: ${JSON.stringify(structured.data)}`);
      console.log(
        `[smoke] structured usage: prompt=${structured.usage.promptTokens} completion=${structured.usage.completionTokens} total=${structured.usage.totalTokens} usd=${structured.usage.estimatedCostUsd.toFixed(6)} inr=${structured.usage.estimatedCostInr.toFixed(4)}`,
      );
      expect(typeof structured.data.answer).toBe("number");
      expect(structured.data.answer).toBe(4);

      // 6: total test cost.
      const usd = basic.usage.estimatedCostUsd + structured.usage.estimatedCostUsd;
      const inr = basic.usage.estimatedCostInr + structured.usage.estimatedCostInr;
      const tokens = basic.usage.totalTokens + structured.usage.totalTokens;
      console.log(
        `[smoke] TOTAL: tokens=${tokens} usd=${usd.toFixed(6)} inr=${inr.toFixed(4)} tokenUsageReturned=${basic.usage.totalTokens > 0 || structured.usage.totalTokens > 0}`,
      );
    },
    60_000,
  );
});
