import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { extractStructured } from "@/lib/ai/client";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
});

describe("Gemini structured-output request", () => {
  it("targets the configured model and requests JSON output", async () => {
    process.env.LLM_API_KEY = "test-key";
    // No LLM_MODEL set → default gemini-3.6-flash.

    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (url: unknown, init?: unknown) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse((init as { body: string }).body);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"name":"ABC"}' }] } }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 20,
            totalTokenCount: 120,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await extractStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      schema: z.object({ name: z.string() }),
    });

    // Model is in the REST path.
    expect(capturedUrl).toContain("gemini-3.6-flash");
    expect(capturedUrl).toContain(":generateContent");
    // Structured-output mechanism is requested.
    const gen = capturedBody.generationConfig as Record<string, unknown>;
    expect(gen.responseMimeType).toBe("application/json");
    // Response parsed against the schema.
    expect(result.data).toEqual({ name: "ABC" });
    // Usage carries model + pricing provenance.
    expect(result.usage.model).toBe("gemini-3.6-flash");
    expect(result.usage.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.usage.pricingVersion).toMatch(/2026-08/);
  });

  it("counts Gemini 3.x thinking tokens as billed output", async () => {
    process.env.LLM_API_KEY = "test-key";
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"n":1}' }] } }],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              thoughtsTokenCount: 100,
              totalTokenCount: 115,
            },
          }),
          { status: 200 },
        ),
    ) as typeof fetch;

    const r = await extractStructured({
      systemPrompt: "s",
      userPrompt: "u",
      schema: z.object({ n: z.number() }),
    });
    expect(r.usage.thoughtsTokens).toBe(100);
    // billed output = candidates(5) + thoughts(100) = 105
    const expectedUsd = (10 * 1.5) / 1e6 + (105 * 7.5) / 1e6;
    expect(r.usage.estimatedCostUsd).toBeCloseTo(expectedUsd, 10);
  });

  it("honours the LLM_MODEL override in the request URL", async () => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "gemini-3.6-flash";

    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (url: unknown) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: {},
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await extractStructured({
      systemPrompt: "s",
      userPrompt: "u",
      schema: z.object({ ok: z.boolean() }),
    });
    expect(capturedUrl).toContain("gemini-3.6-flash");
  });
});
