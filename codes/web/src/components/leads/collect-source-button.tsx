"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

type CollectSourceButtonProps = {
  leadId: string;
  disabled?: boolean;
};

type CollectSourceResponse =
  | {
      ok: true;
      textLength: number;
      source: {
        id: string;
        url: string | null;
        http_status: number | null;
      };
    }
  | {
      ok: false;
      message: string;
    };

export function CollectSourceButton({
  leadId,
  disabled = false,
}: CollectSourceButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function collectSource() {
    setIsLoading(true);
    setMessage(null);

    const response = await fetch(`/api/leads/${leadId}/sources/collect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const result = (await response.json()) as CollectSourceResponse;

    if (result.ok) {
      setMessage(`${result.textLength} chars saved`);
    } else {
      setMessage(result.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="flex min-w-[150px] flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={collectSource}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        <RefreshCw
          className={isLoading ? "animate-spin" : ""}
          size={15}
          aria-hidden="true"
        />
        {isLoading ? "Collecting" : "Collect"}
      </button>
      {message && <p className="max-w-[180px] text-xs text-slate-500">{message}</p>}
    </div>
  );
}
