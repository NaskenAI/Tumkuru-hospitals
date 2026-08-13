import {
  AlertCircle,
  ArrowLeft,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";

import { CollectSourceButton } from "@/components/leads/collect-source-button";
import { PipelineActionButton } from "@/components/leads/pipeline-action-button";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeadListRow = {
  id: string;
  hospital_name: string;
  city: string | null;
  known_website: string | null;
  seed_source_url: string | null;
  status: string;
  duplicate_group: string | null;
  digital_gap_score: number | null;
  preview_readiness_score: number | null;
  created_at: string;
};

async function getLeads(): Promise<{
  leads: LeadListRow[];
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return { leads: [], error: "Supabase is not configured yet." };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,hospital_name,city,known_website,seed_source_url,status,duplicate_group,digital_gap_score,preview_readiness_score,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    leads: data ?? [],
    error: error?.message ?? null,
  };
}

function statusColor(status: string) {
  switch (status) {
    case "NEW":
      return "bg-slate-100 text-slate-700";
    case "RESEARCHING":
      return "bg-blue-100 text-blue-800";
    case "RESEARCHED":
      return "bg-blue-100 text-blue-800";
    case "REVIEW_REQUIRED":
      return "bg-amber-100 text-amber-800";
    case "QUALIFIED":
      return "bg-teal-100 text-teal-800";
    case "PREVIEW_READY":
      return "bg-emerald-100 text-emerald-800";
    case "CONTACTED":
      return "bg-purple-100 text-purple-800";
    case "WON":
      return "bg-green-100 text-green-800";
    case "LOST":
      return "bg-rose-100 text-rose-800";
    case "SKIPPED":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function ScoreBadge({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  if (score === null) {
    return (
      <span className="text-xs text-slate-400">—</span>
    );
  }

  const color =
    score >= 70
      ? "text-emerald-700"
      : score >= 40
        ? "text-amber-700"
        : "text-rose-700";

  return (
    <div className="text-center">
      <span className={`text-sm font-semibold ${color}`}>{score}</span>
      <span className="block text-xs text-slate-400">{label}</span>
    </div>
  );
}

export default async function LeadsPage() {
  const { leads, error } = await getLeads();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
              href="/admin"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Admin
            </Link>
            <p className="mt-5 text-sm font-medium text-teal-700">Leads</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              Prospect list
            </h1>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="/admin/leads/import"
          >
            <FileSpreadsheet size={17} aria-hidden="true" />
            Import CSV
          </Link>
        </header>

        {error ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">Setup needed</h2>
                <p className="mt-2 text-sm leading-6">{error}</p>
                <p className="mt-2 text-sm leading-6">
                  Dry-run CSV import still works. Add Supabase keys and run the
                  migration before saving real leads or source snapshots.
                </p>
              </div>
            </div>
          </section>
        ) : leads.length === 0 ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Database size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">
              No leads imported yet
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Import a CSV to start the first pipeline run.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3">
                      Hospital
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3">
                      City
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3">
                      Status
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-center">
                      Gap
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-center">
                      Fit
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const sourceUrl =
                      lead.known_website ?? lead.seed_source_url;

                    return (
                      <tr key={lead.id}>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="font-medium text-slate-950">
                            {lead.hospital_name}
                          </div>
                          {lead.duplicate_group && (
                            <div className="mt-1 text-xs text-amber-700">
                              {lead.duplicate_group}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                          {lead.city ?? "-"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${statusColor(lead.status)}`}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <ScoreBadge
                            label="Gap"
                            score={lead.digital_gap_score}
                          />
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <ScoreBadge
                            label="Fit"
                            score={lead.preview_readiness_score}
                          />
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <CollectSourceButton
                              leadId={lead.id}
                              disabled={!sourceUrl}
                            />
                            <PipelineActionButton
                              leadId={lead.id}
                              action="extract"
                              label="Extract"
                            />
                            <Link
                              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                              href={`/admin/leads/${lead.id}/facts`}
                            >
                              Review
                            </Link>
                            <Link
                              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
                              href={`/admin/leads/${lead.id}/pipeline`}
                            >
                              Pipeline
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
