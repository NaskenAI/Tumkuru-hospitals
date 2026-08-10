/**
 * Outreach draft generation.
 *
 * Generates a personalized outreach message draft for a hospital lead.
 * The draft is generated but NEVER sent automatically — a human must
 * review and send it manually.
 */

import { z } from "zod";

import { extractStructured, type LlmConfig, type LlmResult } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutreachInput = {
  hospitalName: string;
  city: string | null;
  contactName: string | null;
  digitalGapScore: number;
  commercialFitScore: number;
  previewUrl: string | null;
  gapHighlights: string[];
};

export type OutreachDraft = {
  subject: string;
  body: string;
  whatsappMessage: string;
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const outreachSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  whatsappMessage: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildOutreachPrompt(input: OutreachInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a professional business development assistant for Nasken AI, a company that builds digital presence solutions for hospitals and clinics in India.

RULES:
1. Write a warm, professional outreach message.
2. Be specific about what you noticed about their current digital presence.
3. Mention the preview website if a URL is provided.
4. Keep it concise — busy hospital owners don't read long messages.
5. Do not make false claims or promises.
6. Generate three things: email subject, email body, and a short WhatsApp message.
7. Return as JSON with keys: subject, body, whatsappMessage.`;

  const gaps = input.gapHighlights.length > 0
    ? `\nDigital gaps noticed: ${input.gapHighlights.join(", ")}`
    : "";

  const preview = input.previewUrl
    ? `\nPreview URL to share: ${input.previewUrl}`
    : "";

  const userPrompt = `Generate outreach drafts for:
Hospital: ${input.hospitalName}
Location: ${input.city ?? "Tumakuru"}
Contact: ${input.contactName ?? "Hospital Administrator"}
Digital Gap Score: ${input.digitalGapScore}/100
Commercial Fit Score: ${input.commercialFitScore}/100${gaps}${preview}

Generate JSON with: subject, body, whatsappMessage`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateOutreachDraft(input: {
  lead: OutreachInput;
  config?: Partial<LlmConfig>;
}): Promise<LlmResult<OutreachDraft>> {
  const { systemPrompt, userPrompt } = buildOutreachPrompt(input.lead);

  return extractStructured({
    systemPrompt,
    userPrompt,
    schema: outreachSchema,
    config: input.config,
  });
}
