import { parse } from "csv-parse/sync";
import { ZodError } from "zod";

import type { Database } from "@/lib/database/types";
import {
  type LeadImportIssue,
  type LeadImportResult,
  type NormalizedLeadImport,
  rawLeadImportRowSchema,
} from "@/lib/leads/schema";
import {
  buildImportFingerprint,
  normalizeCity,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUrl,
} from "@/lib/leads/normalize";

type CsvRecord = Record<string, string | undefined>;

const requiredColumns = [
  "hospital_name",
  "district",
  "city",
  "known_phone",
  "known_email",
  "known_website",
  "source_type",
  "source_url",
  "notes",
];

function normalizeRecordKeys(record: CsvRecord): CsvRecord {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key.trim(), value]),
  );
}

function collectMissingColumns(records: CsvRecord[]) {
  const first = records[0];
  if (!first) return requiredColumns;

  const columns = new Set(Object.keys(first));
  return requiredColumns.filter((column) => !columns.has(column));
}

function zodIssues(error: ZodError, rowNumber: number): LeadImportIssue[] {
  return error.issues.map((issue) => ({
    rowNumber,
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function parseLeadCsv(csvText: string): LeadImportResult {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];

  const issues: LeadImportIssue[] = [];
  const missingColumns = collectMissingColumns(records);

  if (missingColumns.length > 0) {
    issues.push({
      rowNumber: 1,
      message: `Missing columns: ${missingColumns.join(", ")}`,
    });
  }

  const seen = new Map<string, number>();
  const normalizedRecords: NormalizedLeadImport[] = [];

  records.forEach((csvRecord, index) => {
    const rowNumber = index + 2;
    const parsed = rawLeadImportRowSchema.safeParse(
      normalizeRecordKeys(csvRecord),
    );

    if (!parsed.success) {
      issues.push(...zodIssues(parsed.error, rowNumber));
      return;
    }

    const row = parsed.data;
    const importFingerprint = buildImportFingerprint(row);
    const firstSeenRow = seen.get(importFingerprint);
    const duplicateInFile = firstSeenRow !== undefined;

    if (!duplicateInFile) {
      seen.set(importFingerprint, rowNumber);
    }

    const normalized: NormalizedLeadImport = {
      rowNumber,
      hospitalName: row.hospital_name,
      normalizedName: normalizeName(row.hospital_name),
      district: row.district?.trim() || "Tumakuru",
      city: row.city ?? null,
      normalizedCity: normalizeCity(row.city),
      knownPhone: normalizePhone(row.known_phone),
      knownEmail: normalizeEmail(row.known_email),
      knownWebsite: normalizeUrl(row.known_website),
      sourceType: row.source_type,
      seedSourceUrl: normalizeUrl(row.source_url),
      notes: row.notes ?? null,
      importFingerprint,
      duplicateGroup: duplicateInFile ? `duplicate-of-row-${firstSeenRow}` : null,
      duplicateInFile,
    };

    normalizedRecords.push(normalized);
  });

  return {
    totalRows: records.length,
    validRows: normalizedRecords.length,
    duplicateRows: normalizedRecords.filter((record) => record.duplicateInFile)
      .length,
    records: normalizedRecords,
    issues,
  };
}

export function buildLeadInsertPayloads(
  records: NormalizedLeadImport[],
): Database["public"]["Tables"]["leads"]["Insert"][] {
  return records.map((record) => ({
    hospital_name: record.hospitalName,
    normalized_name: record.normalizedName,
    district: record.district,
    city: record.city,
    normalized_city: record.normalizedCity,
    known_phone: record.knownPhone,
    known_email: record.knownEmail,
    known_website: record.knownWebsite,
    source_type: record.sourceType,
    seed_source_url: record.seedSourceUrl,
    import_fingerprint: record.importFingerprint,
    duplicate_group: record.duplicateGroup,
    status: "NEW",
    notes: record.notes,
  }));
}
