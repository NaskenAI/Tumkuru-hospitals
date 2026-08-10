/**
 * Content schema — the fixed JSON structure that preview templates consume.
 *
 * The LLM generates content matching this schema. The templates render it.
 * Every factual sentence carries supporting_fact_ids for claim validation.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Template keys
// ---------------------------------------------------------------------------

export const templateKeys = ["clinic", "specialty", "multispecialty"] as const;
export type TemplateKey = (typeof templateKeys)[number];

// ---------------------------------------------------------------------------
// Content blocks
// ---------------------------------------------------------------------------

const claimSchema = z.object({
  text: z.string().min(1),
  supporting_fact_ids: z.array(z.string()).min(1),
});

export type Claim = z.infer<typeof claimSchema>;

const doctorSchema = z.object({
  name: z.string().min(1),
  qualification: z.string().optional(),
  specialty: z.string().optional(),
  supporting_fact_ids: z.array(z.string()).min(1),
});

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  supporting_fact_ids: z.array(z.string()).min(1),
});

const contactInfoSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  emergency: z.string().optional(),
  supporting_fact_ids: z.array(z.string()).min(1),
});

// ---------------------------------------------------------------------------
// Full content schema
// ---------------------------------------------------------------------------

export const generatedContentSchema = z.object({
  hospital_name: z.string().min(1),
  tagline: claimSchema,
  about: z.array(claimSchema).min(1),
  specialties: z.array(serviceSchema).optional(),
  services: z.array(serviceSchema).optional(),
  doctors: z.array(doctorSchema).optional(),
  facilities: z.array(serviceSchema).optional(),
  contact: contactInfoSchema,
  accreditations: z.array(claimSchema).optional(),
  insurance: z.array(claimSchema).optional(),
});

export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export function parseGeneratedContent(value: unknown): GeneratedContent {
  return generatedContentSchema.parse(value);
}
