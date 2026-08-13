/**
 * Normalized hospital model contract (Task 1 — Extraction & Normalization).
 *
 * The single typed, provenance-preserving intermediate between raw first-party
 * source material and any downstream composition. Every meaningful entity
 * carries `evidence[]`; nothing here is rendered directly and nothing here is
 * hospital-specific. Runtime validation uses Zod (the repo's convention).
 *
 * Design rules encoded by the types:
 *  - Source is EVIDENCE, not fact: marketing/superlatives live only in
 *    `positioningClaims`, never in neutral factual fields.
 *  - Nothing is silently merged, strengthened, or fabricated: ambiguity is a
 *    first-class `resolution` state; accreditation carries an explicit status;
 *    conflicting values are preserved as candidates.
 *  - A partial model is distinguishable from a complete one via `status` +
 *    `coverage`.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Evidence & source tiers
// ---------------------------------------------------------------------------

/** 1 WordPress REST · 2 Semantic HTML · 3 First-party documents · 4 Vision. */
export const sourceTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type SourceTier = z.infer<typeof sourceTierSchema>;

export const evidenceSchema = z.object({
  sourcePageId: z.string(),
  sourceUrl: z.string(),
  sourceTier: sourceTierSchema,
  excerpt: z.string().optional(),
  /** True when the excerpt was verified to occur in the fetched source text. */
  provenanceVerified: z.boolean(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

/** A single-valued field that still needs to carry its provenance. */
const attested = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, evidence: z.array(evidenceSchema) });

// ---------------------------------------------------------------------------
// Enumerations / state machines
// ---------------------------------------------------------------------------

export const hospitalStatusSchema = z.enum(["COMPLETE", "PARTIAL", "FAILED"]);
export type HospitalStatus = z.infer<typeof hospitalStatusSchema>;

export const resolutionStateSchema = z.enum(["confident", "ambiguous", "unresolved"]);
export type ResolutionState = z.infer<typeof resolutionStateSchema>;

export const personRoleSchema = z.enum(["clinician", "administrator", "other"]);
export type PersonRole = z.infer<typeof personRoleSchema>;

export const accreditationStatusSchema = z.enum(["HELD", "APPLIED", "EXPIRED", "UNKNOWN"]);
export type AccreditationStatus = z.infer<typeof accreditationStatusSchema>;

export const facilityCategorySchema = z.enum([
  "critical_care",
  "surgical",
  "diagnostic",
  "inpatient",
  "patient_services",
  "infrastructure",
  "other",
]);
export type FacilityCategory = z.infer<typeof facilityCategorySchema>;

/** 3 high · 2 moderate · 1 administrative · 0 back-of-house. */
export const relevanceSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type Relevance = z.infer<typeof relevanceSchema>;

export const captionSourceSchema = z.enum([
  "figcaption",
  "heading",
  "alt",
  "title",
  "filename",
  "none",
]);
export type CaptionSource = z.infer<typeof captionSourceSchema>;

export const assetClassificationSchema = z.enum([
  "LOGO",
  "EXTERIOR",
  "INTERIOR",
  "FACILITY",
  "EQUIPMENT",
  "PORTRAIT",
  "INSURER_MARK",
  "RENDER",
  "OTHER",
]);
export type NormalizedAssetClassification = z.infer<typeof assetClassificationSchema>;

/**
 * Asset approval state machine (app-level; see docs in normalize/assets.ts).
 * DISCOVERED → policy not yet applied. AUTO_APPROVED → safe, non-attributive
 * use. REVIEW_REQUIRED → attributive/sensitive, needs a human. HUMAN_APPROVED →
 * a reviewer approved the specific association. REJECTED → never public.
 */
export const approvalStateSchema = z.enum([
  "DISCOVERED",
  "AUTO_APPROVED",
  "REVIEW_REQUIRED",
  "HUMAN_APPROVED",
  "REJECTED",
]);
export type ApprovalState = z.infer<typeof approvalStateSchema>;

export const appointmentChannelSchema = z.enum([
  "page",
  "phone",
  "whatsapp",
  "other",
  "none",
]);
export type AppointmentChannel = z.infer<typeof appointmentChannelSchema>;

// ---------------------------------------------------------------------------
// Contact / location / emergency / appointment
// ---------------------------------------------------------------------------

const contactValueSchema = z.object({
  value: z.string(),
  evidence: z.array(evidenceSchema),
});

/** A field with more than one distinct first-party value — surfaced, not resolved. */
const conflictSchema = z.object({
  field: z.string(),
  values: z.array(contactValueSchema),
});

export const contactSchema = z.object({
  phones: z.array(contactValueSchema),
  emails: z.array(contactValueSchema),
  /** Candidate values that disagree across pages (phones, emails, …). */
  conflicts: z.array(conflictSchema),
});
export type Contact = z.infer<typeof contactSchema>;

export const locationSchema = z.object({
  address: attested(z.string()).optional(),
  city: attested(z.string()).optional(),
  postalCode: attested(z.string()).optional(),
  geo: attested(z.object({ lat: z.number(), lng: z.number() })).optional(),
});
export type Location = z.infer<typeof locationSchema>;

export const emergencySchema = z.object({
  /** unknown = no supporting evidence either way. */
  available: z.union([z.boolean(), z.literal("unknown")]),
  text: z.string().optional(),
  evidence: z.array(evidenceSchema),
});
export type Emergency = z.infer<typeof emergencySchema>;

export const appointmentSchema = z.object({
  channel: appointmentChannelSchema,
  value: z.string().optional(),
  evidence: z.array(evidenceSchema),
});
export type Appointment = z.infer<typeof appointmentSchema>;

// ---------------------------------------------------------------------------
// People (doctors + administrators)
// ---------------------------------------------------------------------------

export const personResolutionSchema = z.object({
  state: resolutionStateSchema,
  collidesWith: z.array(z.string()),
  reason: z.string().optional(),
});

export const personSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  /** Every raw spelling encountered across the source. */
  rawNames: z.array(z.string()),
  role: personRoleSchema,
  /** Source specialty/section groups this person appeared under. */
  sourceGroups: z.array(z.string()),
  detailUrl: z.string().optional(),
  resolution: personResolutionSchema,
  evidence: z.array(evidenceSchema),
});
export type Person = z.infer<typeof personSchema>;

// ---------------------------------------------------------------------------
// Specialties / facilities / assets / insurers / narrative
// ---------------------------------------------------------------------------

export const specialtySchema = z.object({
  source_label: z.string(),
  display_label: z.string(),
  /** Higher = more prominent (person count + dedicated page + facility + meta). */
  prominence: z.number(),
  /** Whether display_label came from a known-specialty dictionary. */
  known: z.boolean(),
  evidence: z.array(evidenceSchema),
});
export type Specialty = z.infer<typeof specialtySchema>;

export const facilitySchema = z.object({
  facility_id: z.string(),
  source_label: z.string(),
  display_label: z.string(),
  category: facilityCategorySchema,
  patient_relevance: relevanceSchema,
  caption: z.string().optional(),
  caption_source: captionSourceSchema,
  assetRef: z.string().optional(),
  evidence: z.array(evidenceSchema),
});
export type Facility = z.infer<typeof facilitySchema>;

export const assetSchema = z.object({
  asset_id: z.string(),
  source_page_id: z.string(),
  source_page_url: z.string(),
  original_url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  aspect: z.number().optional(),
  mime: z.string().optional(),
  og_declared: z.boolean(),
  page_banner: z.boolean(),
  caption: z.string().optional(),
  caption_source: captionSourceSchema,
  classification: assetClassificationSchema,
  is_photograph: z.boolean(),
  crowding: z.union([z.literal("low"), z.literal("medium"), z.literal("high"), z.literal("unknown")]),
  hero_suitability: z.number().optional(),
  /** Subject this asset is (loosely) associated with + how strong the link is. */
  subject_ref: z
    .object({ kind: z.string(), id: z.string().optional(), confidence: z.number() })
    .optional(),
  approval_state: approvalStateSchema,
  evidence: z.array(evidenceSchema),
});
export type NormalizedAsset = z.infer<typeof assetSchema>;

export const insurerSchema = z.object({
  name: z.string(),
  /** Where the name came from: alt/heading/text vs a filename slug. */
  name_source: z.enum(["text", "alt", "heading", "filename"]),
  confidence: z.number(),
  human_confirmed: z.boolean(),
  logo_asset: z.string().optional(),
  evidence: z.array(evidenceSchema),
});
export type Insurer = z.infer<typeof insurerSchema>;

export const milestoneSchema = z.object({
  label: z.string(),
  date: z.object({
    year: z.number().optional(),
    month: z.number().optional(),
    day: z.number().optional(),
  }),
  evidence: z.array(evidenceSchema),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const positioningClaimSchema = z.object({
  text: z.string(),
  evidence: z.array(evidenceSchema),
});
export type PositioningClaim = z.infer<typeof positioningClaimSchema>;

export const accreditationSchema = z.object({
  body: z.string(),
  status: accreditationStatusSchema,
  rawText: z.string(),
  evidence: z.array(evidenceSchema),
});
export type Accreditation = z.infer<typeof accreditationSchema>;

export const narrativeSchema = z.object({
  about: z.array(z.object({ text: z.string(), evidence: z.array(evidenceSchema) })),
  founder: z
    .object({ name: z.string(), evidence: z.array(evidenceSchema) })
    .optional(),
  milestones: z.array(milestoneSchema),
});
export type Narrative = z.infer<typeof narrativeSchema>;

// ---------------------------------------------------------------------------
// Coverage / status
// ---------------------------------------------------------------------------

export const coverageSchema = z.object({
  pagesDiscovered: z.number(),
  pagesCrawled: z.number(),
  pagesParsed: z.number(),
  unparsed: z.array(
    z.object({ url: z.string(), reason: z.string(), parser: z.string().optional() }),
  ),
});
export type Coverage = z.infer<typeof coverageSchema>;

// ---------------------------------------------------------------------------
// Top-level normalized hospital
// ---------------------------------------------------------------------------

export const normalizedHospitalSchema = z.object({
  status: hospitalStatusSchema,
  hospitalName: attested(z.string()).optional(),
  contact: contactSchema,
  location: locationSchema,
  emergency: emergencySchema,
  appointment: appointmentSchema,
  accreditations: z.array(accreditationSchema),
  people: z.object({
    doctors: z.array(personSchema),
    administrators: z.array(personSchema),
    others: z.array(personSchema),
  }),
  specialties: z.array(specialtySchema),
  facilities: z.array(facilitySchema),
  assets: z.array(assetSchema),
  insurers: z.array(insurerSchema),
  narrative: narrativeSchema,
  positioningClaims: z.array(positioningClaimSchema),
  coverage: coverageSchema,
});
export type NormalizedHospital = z.infer<typeof normalizedHospitalSchema>;

export function parseNormalizedHospital(value: unknown): NormalizedHospital {
  return normalizedHospitalSchema.parse(value);
}

// ---------------------------------------------------------------------------
// Parser inputs (what the deterministic parsers consume)
// ---------------------------------------------------------------------------

/** A crawled first-party page handed to the normalizer. */
export type SourcePage = {
  id: string;
  url: string;
  /** 1 if this HTML came from the WordPress REST API, else 2 (semantic HTML). */
  tier: SourceTier;
  pageType?: string;
  html: string;
};

/** Vision/quality signals — advisory only; never the sole basis of a text fact. */
export type VisionSignal = {
  classification?: NormalizedAssetClassification;
  is_photograph?: boolean;
  crowding?: "low" | "medium" | "high";
  composition_quality?: number;
  technical_quality?: number;
};
