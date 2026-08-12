"use client";

import { Check, ExternalLink, Save, X } from "lucide-react";
import { useState } from "react";

import type { Json, RiskTier, VerificationStatus } from "@/lib/database/types";

type FactReviewControlsProps = {
  fact: {
    id: string;
    fact_type: string;
    value: Json;
    risk_tier: RiskTier;
    source_excerpt: string | null;
    verification_status: VerificationStatus;
    source: {
      url: string | null;
      retrieved_at: string | null;
      title: string | null;
    } | null;
  };
};

type ReviewResponse =
  | {
      ok: true;
      fact: {
        verification_status: VerificationStatus;
      };
    }
  | {
      ok: false;
      message: string;
    };

export function FactReviewControls({ fact }: FactReviewControlsProps) {
  const [valueText, setValueText] = useState(formatJsonValue(fact.value));
  const [excerpt, setExcerpt] = useState(fact.source_excerpt ?? "");
  const [status, setStatus] = useState(fact.verification_status);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(action: "SAVE" | "VERIFY" | "REJECT") {
    setIsSaving(true);
    setMessage(null);

    const parsedValue = parseJsonValue(valueText);
    if (!parsedValue.ok) {
      setMessage(parsedValue.message);
      setIsSaving(false);
      return;
    }

    const response = await fetch(`/api/facts/${fact.id}/review`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action,
        value: parsedValue.value,
        sourceExcerpt: excerpt,
      }),
    });

    const result = (await response.json()) as ReviewResponse;

    if (result.ok) {
      setStatus(result.fact.verification_status);
      setMessage(action === "SAVE" ? "Saved" : result.fact.verification_status);
    } else {
      setMessage(result.message);
    }

    setIsSaving(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">
              {fact.fact_type}
            </h2>
            <span className={riskClassName(fact.risk_tier)}>
              {fact.risk_tier}
            </span>
            <span className={statusClassName(status)}>{status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submit("SAVE")}
            disabled={isSaving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:text-slate-400"
          >
            <Save size={15} aria-hidden="true" />
            Save
          </button>
          <button
            type="button"
            onClick={() => submit("VERIFY")}
            disabled={isSaving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800 disabled:bg-slate-300"
          >
            <Check size={15} aria-hidden="true" />
            Verify
          </button>
          <button
            type="button"
            onClick={() => submit("REJECT")}
            disabled={isSaving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-rose-700 px-3 text-sm font-medium text-white transition hover:bg-rose-800 disabled:bg-slate-300"
          >
            <X size={15} aria-hidden="true" />
            Reject
          </button>
        </div>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Value
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
          value={valueText}
          onChange={(event) => setValueText(event.target.value)}
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Source excerpt
        <textarea
          className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
        />
      </label>

      {/* Provenance: where this fact came from (P0-7). */}
      <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
        <div className="font-medium text-slate-700">Provenance</div>
        {fact.source?.title && (
          <p className="mt-1 text-slate-700">{fact.source.title}</p>
        )}
        {fact.source?.url ? (
          <a
            href={fact.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 break-all text-teal-700 hover:underline"
          >
            <ExternalLink size={12} aria-hidden="true" />
            {fact.source.url}
          </a>
        ) : (
          <p className="mt-1 text-slate-400">
            No source URL (manually collected).
          </p>
        )}
        <p className="mt-1 text-slate-500">
          Retrieved:{" "}
          {fact.source?.retrieved_at
            ? new Date(fact.source.retrieved_at).toLocaleString()
            : "—"}
        </p>
      </div>

      {message && <p className="mt-3 text-sm text-slate-500">{message}</p>}
    </div>
  );
}

function formatJsonValue(value: Json) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function parseJsonValue(value: string):
  | { ok: true; value: Json }
  | { ok: false; message: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Value cannot be empty." };
  }

  if (!startsLikeJson(trimmed)) {
    return { ok: true, value: trimmed };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) as Json };
  } catch {
    return { ok: false, message: "Value JSON is invalid." };
  }
}

function startsLikeJson(value: string) {
  return (
    value.startsWith("{") ||
    value.startsWith("[") ||
    value.startsWith('"') ||
    value === "null" ||
    value === "true" ||
    value === "false" ||
    /^-?\d/.test(value)
  );
}

function riskClassName(riskTier: RiskTier) {
  const base = "rounded-md px-2 py-1 text-xs font-medium";

  if (riskTier === "HIGH") return `${base} bg-rose-100 text-rose-800`;
  if (riskTier === "MEDIUM") return `${base} bg-amber-100 text-amber-800`;
  return `${base} bg-teal-100 text-teal-800`;
}

function statusClassName(status: VerificationStatus) {
  const base = "rounded-md px-2 py-1 text-xs font-medium";

  if (status === "VERIFIED") return `${base} bg-teal-100 text-teal-800`;
  if (status === "REJECTED") return `${base} bg-rose-100 text-rose-800`;
  return `${base} bg-slate-100 text-slate-700`;
}
