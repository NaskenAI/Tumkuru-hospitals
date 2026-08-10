"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type PipelineActionButtonProps = {
  leadId: string;
  action: "extract" | "audit" | "score" | "generate" | "translate" | "deploy";
  label: string;
  disabled?: boolean;
};

type ActionResponse =
  | { ok: true; [key: string]: unknown }
  | { ok: false; message: string };

const actionPaths: Record<PipelineActionButtonProps["action"], string> = {
  extract: "extract",
  audit: "audit",
  score: "score",
  generate: "generate",
  translate: "translate",
  deploy: "deploy",
};

export function PipelineActionButton({
  leadId,
  action,
  label,
  disabled = false,
}: PipelineActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/leads/${leadId}/${actionPaths[action]}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const result = (await response.json()) as ActionResponse;

      if (result.ok) {
        setMessage("Done ✓");
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    }

    setIsLoading(false);
  }

  return (
    <div className="flex min-w-[100px] flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={run}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        <Play
          className={isLoading ? "animate-spin" : ""}
          size={13}
          aria-hidden="true"
        />
        {isLoading ? "Running" : label}
      </button>
      {message && (
        <p className="max-w-[180px] text-xs text-slate-500">{message}</p>
      )}
    </div>
  );
}
