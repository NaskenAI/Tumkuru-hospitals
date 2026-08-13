import { createHash } from "node:crypto";

import type { Database, SourceType } from "@/lib/database/types";
import {
  fetchPageText,
  type FetchPageTextOptions,
} from "@/lib/research/safe-fetch";

const rawTextRetentionDays = 14;

export type SourceCollectionInput = {
  leadId: string;
  url: string;
  sourceType: SourceType;
  notes?: string | null;
  now?: Date;
};

export type SourceSnapshot = Database["public"]["Tables"]["sources"]["Insert"];

export async function collectSourceSnapshot(
  input: SourceCollectionInput,
  options: FetchPageTextOptions = {},
): Promise<SourceSnapshot> {
  const fetched = await fetchPageText(input.url, options);

  return buildSourceSnapshot(input, {
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.httpStatus,
    rawText: fetched.rawText,
    rawHtml: fetched.rawHtml,
    title: fetched.title,
    now: input.now,
  });
}

export function buildSourceSnapshot(
  input: SourceCollectionInput,
  fetched: {
    finalUrl: string;
    httpStatus: number;
    rawText: string;
    rawHtml?: string | null;
    title?: string | null;
    now?: Date;
  },
): SourceSnapshot {
  const now = fetched.now ?? input.now ?? new Date();
  const rawTextExpiresAt = new Date(now);
  rawTextExpiresAt.setDate(rawTextExpiresAt.getDate() + rawTextRetentionDays);

  return {
    lead_id: input.leadId,
    url: fetched.finalUrl,
    source_type: input.sourceType,
    retrieved_at: now.toISOString(),
    http_status: fetched.httpStatus,
    content_hash: hashSourceText(fetched.finalUrl, fetched.rawText),
    raw_text: fetched.rawText,
    raw_html: fetched.rawHtml ?? null,
    title: fetched.title ?? null,
    raw_text_expires_at: rawTextExpiresAt.toISOString(),
    notes: input.notes ?? null,
  };
}

export function hashSourceText(url: string, rawText: string) {
  return createHash("sha256").update(`${url}\n${rawText}`).digest("hex");
}
