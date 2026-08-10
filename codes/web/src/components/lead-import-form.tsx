"use client";

import { AlertCircle, CheckCircle2, FileText, Upload } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import type { LeadImportResult } from "@/lib/leads/schema";

type ImportResponse =
  | {
      ok: true;
      dryRun: boolean;
      parsed: LeadImportResult;
      inserted: number;
      leads?: Array<{
        id: string;
        hospital_name: string;
        status: string;
        duplicate_group: string | null;
      }>;
    }
  | {
      ok: false;
      message: string;
      parsed?: LeadImportResult;
      inserted?: number;
    };

export function LeadImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<ImportResponse | null>(null);

  const parsed = response?.parsed;
  const canSubmit = useMemo(
    () => Boolean(file) && !isSubmitting,
    [file, isSubmitting],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    setResponse(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await fetch(`/api/leads/import?dryRun=${dryRun ? "1" : "0"}`, {
      method: "POST",
      body: formData,
    });

    const body = (await result.json()) as ImportResponse;
    setResponse(body);
    setIsSubmitting(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Upload size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Lead CSV import
            </h2>
            <p className="text-sm text-slate-500">Phase 1 foundation</p>
          </div>
        </div>

        <label className="mt-6 block text-sm font-medium text-slate-700">
          CSV file
          <input
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            className="size-4 rounded border-slate-300 text-teal-700"
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Dry run
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <FileText size={17} aria-hidden="true" />
          {isSubmitting ? "Processing" : "Process CSV"}
        </button>

        {response && (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              response.ok
                ? "border-teal-200 bg-teal-50 text-teal-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="flex items-start gap-2">
              {response.ok ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <AlertCircle size={18} aria-hidden="true" />
              )}
              <div>
                <p className="font-medium">
                  {response.ok
                    ? response.dryRun
                      ? "CSV parsed"
                      : `${response.inserted ?? 0} leads imported`
                    : response.message}
                </p>
                {parsed && (
                  <p className="mt-1">
                    {parsed.validRows} valid of {parsed.totalRows} rows,{" "}
                    {parsed.duplicateRows} duplicates in file.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">Parsed rows</h2>
          {parsed && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {parsed.validRows} valid
            </span>
          )}
        </div>

        {!parsed ? (
          <div className="mt-6 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Upload a CSV to preview normalized leads.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-2">Row</th>
                  <th className="border-b border-slate-200 px-3 py-2">
                    Hospital
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2">City</th>
                  <th className="border-b border-slate-200 px-3 py-2">Phone</th>
                  <th className="border-b border-slate-200 px-3 py-2">
                    Website
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.records.map((record) => (
                  <tr key={`${record.rowNumber}-${record.importFingerprint}`}>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-500">
                      {record.rowNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                      {record.hospitalName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {record.city ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {record.knownPhone ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {record.knownWebsite ?? "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          record.duplicateInFile
                            ? "bg-amber-100 text-amber-800"
                            : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {record.duplicateInFile ? "Duplicate" : "New"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {parsed && parsed.issues.length > 0 && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-950">
              CSV issues
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {parsed.issues.map((issue, index) => (
                <li key={`${issue.rowNumber}-${issue.field ?? "row"}-${index}`}>
                  Row {issue.rowNumber}: {issue.field ? `${issue.field} - ` : ""}
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
