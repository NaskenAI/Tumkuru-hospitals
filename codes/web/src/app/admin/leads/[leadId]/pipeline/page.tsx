import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PipelineActionButton } from "@/components/leads/pipeline-action-button";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PipelinePageProps = {
  params: Promise<{ leadId: string }>;
};

async function getLeadPipelineData(leadId: string) {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServiceClient();

  const [
    { data: lead },
    { data: sources },
    { data: facts },
    { data: audits },
    { data: content },
    { data: previews },
    { data: jobs },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single(),
    supabase
      .from("sources")
      .select("id,url,http_status,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    supabase
      .from("hospital_facts")
      .select("id,fact_type,verification_status")
      .eq("lead_id", leadId),
    supabase
      .from("website_audits")
      .select("id,digital_gap_score,commercial_fit_score,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("generated_content")
      .select("id,template_key,status,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("previews")
      .select("id,slug,status,deployed_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("jobs")
      .select("id,job_type,status,tokens,estimated_cost,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return { lead, sources, facts, audits, content, previews, jobs };
}

function StepCard({
  title,
  status,
  detail,
  children,
}: {
  title: string;
  status: "done" | "pending" | "error" | "blocked";
  detail?: string;
  children?: React.ReactNode;
}) {
  const borderColor = {
    done: "border-teal-200",
    pending: "border-slate-200",
    error: "border-rose-200",
    blocked: "border-amber-200",
  }[status];

  const badgeColor = {
    done: "bg-teal-100 text-teal-800",
    pending: "bg-slate-100 text-slate-700",
    error: "bg-rose-100 text-rose-800",
    blocked: "bg-amber-100 text-amber-800",
  }[status];

  return (
    <div className={`rounded-lg border ${borderColor} bg-white p-4 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${badgeColor}`}>
          {status.toUpperCase()}
        </span>
      </div>
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default async function PipelinePage({ params }: PipelinePageProps) {
  const { leadId } = await params;
  const data = await getLeadPipelineData(leadId);

  if (!data || !data.lead) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-500">Lead not found or Supabase not configured.</p>
      </main>
    );
  }

  const { lead, sources, facts, audits, content, previews, jobs } = data;
  const hasSources = (sources?.length ?? 0) > 0;
  const factCount = facts?.length ?? 0;
  const verifiedCount = facts?.filter((f) => f.verification_status === "VERIFIED").length ?? 0;
  const hasAudit = (audits?.length ?? 0) > 0;
  const hasContent = (content?.length ?? 0) > 0;
  const hasPreview = (previews?.length ?? 0) > 0;
  const previewSlug = previews?.[0]?.slug;
  const totalCost = (jobs ?? []).reduce((s, j) => s + Number(j.estimated_cost ?? 0), 0);
  const totalTokens = (jobs ?? []).reduce((s, j) => s + (j.tokens ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
          <Link
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
            href="/admin/leads"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Leads
          </Link>
          <div>
            <p className="text-sm font-medium text-teal-700">Pipeline</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              {lead.hospital_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {lead.city ?? "Tumakuru"} · Status: {lead.status}
            </p>
          </div>
        </header>

        {/* Cost summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <span className="text-2xl font-bold text-slate-950">{lead.digital_gap_score ?? "—"}</span>
            <span className="block text-xs text-slate-500 mt-1">Digital Gap</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <span className="text-2xl font-bold text-slate-950">{lead.commercial_fit_score ?? "—"}</span>
            <span className="block text-xs text-slate-500 mt-1">Commercial Fit</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <span className="text-2xl font-bold text-slate-950">₹{totalCost.toFixed(2)}</span>
            <span className="block text-xs text-slate-500 mt-1">{totalTokens} tokens</span>
          </div>
        </div>

        {/* Pipeline steps */}
        <div className="grid gap-4">
          <StepCard
            title="1. Collect Sources"
            status={hasSources ? "done" : "pending"}
            detail={hasSources ? `${sources!.length} source(s) collected` : "No sources yet"}
          >
            <PipelineActionButton leadId={leadId} action="extract" label="Collect & Extract" />
          </StepCard>

          <StepCard
            title="2. Extract Facts"
            status={factCount > 0 ? "done" : "pending"}
            detail={`${factCount} facts extracted, ${verifiedCount} verified`}
          >
            <div className="flex gap-2">
              <PipelineActionButton leadId={leadId} action="extract" label="Re-extract" />
              <Link
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                href={`/admin/leads/${leadId}/facts`}
              >
                Review Facts
              </Link>
            </div>
          </StepCard>

          <StepCard
            title="3. Audit Website"
            status={hasAudit ? "done" : "pending"}
            detail={hasAudit ? `Gap score: ${audits![0].digital_gap_score}` : "Not audited yet"}
          >
            <PipelineActionButton leadId={leadId} action="audit" label="Run Audit" />
          </StepCard>

          <StepCard
            title="4. Score Lead"
            status={lead.digital_gap_score !== null ? "done" : "pending"}
            detail={lead.digital_gap_score !== null ? `Gap: ${lead.digital_gap_score}, Fit: ${lead.commercial_fit_score}` : "Not scored yet"}
          >
            <PipelineActionButton leadId={leadId} action="score" label="Compute Scores" />
          </StepCard>

          <StepCard
            title="5. Generate English Content"
            status={hasContent ? (content![0].status === "BLOCKED" ? "error" : "done") : "pending"}
            detail={hasContent ? `Template: ${content![0].template_key}, Status: ${content![0].status}` : "Not generated yet"}
          >
            <PipelineActionButton
              leadId={leadId}
              action="generate"
              label="Generate"
              disabled={verifiedCount === 0}
            />
          </StepCard>

          <StepCard
            title="6. Translate to Kannada"
            status={hasContent && content![0].status === "KN_REVIEW_REQUIRED" ? "done" : "pending"}
            detail={hasContent ? `Content status: ${content![0].status}` : "Generate English first"}
          >
            <PipelineActionButton
              leadId={leadId}
              action="translate"
              label="Translate"
              disabled={!hasContent}
            />
          </StepCard>

          <StepCard
            title="7. Deploy Preview"
            status={hasPreview ? "done" : "pending"}
            detail={hasPreview ? `Slug: ${previewSlug}` : "Not deployed yet"}
          >
            <div className="flex gap-2">
              <PipelineActionButton
                leadId={leadId}
                action="deploy"
                label="Deploy"
                disabled={!hasContent}
              />
              {previewSlug && (
                <a
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-medium text-white transition hover:bg-teal-800"
                  href={`/preview/${previewSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  View Preview
                </a>
              )}
            </div>
          </StepCard>
        </div>

        {/* Job history */}
        {jobs && jobs.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-950">Job History</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="text-slate-500 uppercase">
                    <th className="border-b border-slate-200 px-3 py-2">Type</th>
                    <th className="border-b border-slate-200 px-3 py-2">Status</th>
                    <th className="border-b border-slate-200 px-3 py-2">Tokens</th>
                    <th className="border-b border-slate-200 px-3 py-2">Cost</th>
                    <th className="border-b border-slate-200 px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="border-b border-slate-100 px-3 py-2 font-medium">{job.job_type}</td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${job.status === "SUCCESS" ? "bg-teal-100 text-teal-800" : job.status === "FAILED" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">{job.tokens ?? "—"}</td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        {job.estimated_cost ? `₹${Number(job.estimated_cost).toFixed(4)}` : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-500">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
