import { z } from "zod";

import type { SourceType } from "@/lib/database/types";

export const sourceTypes = [
  "OFFICIAL_WEBSITE",
  "GOVERNMENT_DIRECTORY",
  "MANUAL",
  "OTHER",
] as const satisfies readonly SourceType[];

export const sourceTypeSchema = z.enum(sourceTypes);

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const rawLeadImportRowSchema = z.object({
  hospital_name: z.string().trim().min(1, "hospital_name is required"),
  district: z.string().trim().optional(),
  city: optionalText,
  known_phone: optionalText,
  known_email: optionalText,
  known_website: optionalText,
  source_type: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? "MANUAL" : value))
    .pipe(sourceTypeSchema),
  source_url: optionalText,
  notes: optionalText,
});

export type RawLeadImportRow = z.infer<typeof rawLeadImportRowSchema>;

export type NormalizedLeadImport = {
  rowNumber: number;
  hospitalName: string;
  normalizedName: string;
  district: string;
  city: string | null;
  normalizedCity: string | null;
  knownPhone: string | null;
  knownEmail: string | null;
  knownWebsite: string | null;
  sourceType: SourceType;
  seedSourceUrl: string | null;
  notes: string | null;
  importFingerprint: string;
  duplicateGroup: string | null;
  duplicateInFile: boolean;
};

export type LeadImportIssue = {
  rowNumber: number;
  field?: string;
  message: string;
};

export type LeadImportResult = {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  records: NormalizedLeadImport[];
  issues: LeadImportIssue[];
};
