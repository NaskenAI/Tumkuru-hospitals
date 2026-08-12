"use client";

import { useState } from "react";
import { Mail, MessageSquare, Sparkles } from "lucide-react";

type Draft = {
  subject: string;
  body: string;
  whatsappMessage: string;
};

type OutreachResponse =
  | { ok: true; draft: Draft; previewUrl: string | null }
  | { ok: false; message: string };

type Language = "en" | "kn" | "bilingual";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "kn", label: "ಕನ್ನಡ" },
  { value: "bilingual", label: "Bilingual" },
];

export function OutreachPanel({ leadId }: { leadId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");

  async function generate() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/outreach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const result = (await response.json()) as OutreachResponse;
      if (result.ok) {
        setDraft(result.draft);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
    setIsLoading(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">
          Outreach draft (human sends manually)
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
            aria-label="Outreach language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800 disabled:bg-slate-300"
          >
            <Sparkles size={14} aria-hidden="true" />
            {isLoading ? "Generating…" : "Generate draft"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {draft && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Mail size={13} aria-hidden="true" /> Email subject
            </div>
            <textarea
              readOnly
              value={draft.subject}
              className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800"
              rows={1}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Mail size={13} aria-hidden="true" /> Email body
            </div>
            <textarea
              readOnly
              value={draft.body}
              className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800"
              rows={6}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <MessageSquare size={13} aria-hidden="true" /> WhatsApp message
            </div>
            <textarea
              readOnly
              value={draft.whatsappMessage}
              className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800"
              rows={3}
            />
          </div>
          <p className="text-xs text-slate-400">
            Review carefully before sending. Nothing is sent automatically.
          </p>
        </div>
      )}
    </section>
  );
}
