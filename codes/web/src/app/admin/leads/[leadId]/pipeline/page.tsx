import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PipelineActionButton } from "@/components/leads/pipeline-action-button";
import { OutreachPanel } from "@/components/leads/outreach-panel";
import {
  summarizeEvents,
  type AnalyticsEventRow,
} from "@/lib/analytics/summary";
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
    { data: analytics },
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
      .select("id,digital_gap_score,preview_readiness_score,created_at")
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
      .select(
        "id,slug,status,deployed_at,desktop_screenshot_path,mobile_screenshot_path",
      )
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("jobs")
      .select("id,job_type,status,tokens,estimated_cost,created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("analytics_events")
      .select("event,created_at")
      .eq("lead_id", leadId),
  ]);

  return { lead, sources, facts, audits, content, previews, jobs, analytics };
}

type BreakdownItem = {
  label: string;
  points: number;
  maxPoints: number;
  reason: string;
};

function BreakdownList({ title, items }: { title: string; items: BreakdownItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-600">{title}</h4>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3 text-xs text-slate-600">
            <span>{it.label}</span>
            <span className="tabular-nums text-slate-400">
              {it.points}/{it.maxPoints}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreBreakdown({ breakdown }: { breakdown: unknown }) {
  const b = (breakdown ?? {}) as {
    digitalGap?: BreakdownItem[];
    previewReadiness?: BreakdownItem[];
  };
  const gap = b.digitalGap ?? [];
  const readiness = b.previewReadiness ?? [];
  if (gap.length === 0 && readiness.length === 0) return null;
  return (
    <details className="mt-2 rounded-md border border-slate-100 bg-white p-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-600">
        Score breakdown
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <BreakdownList title="Digital Gap" items={gap} />
        <BreakdownList title="Preview Readiness" items={readiness} />
      </div>
    </details>
  );
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

  const { lead, sources, facts, audits, content, previews, jobs, analytics } =
    data;
  const analyticsSummary = summarizeEvents(
    (analytics ?? []) as AnalyticsEventRow[],
  );
  const hasSources = (sources?.length ?? 0) > 0;
  const factCount = facts?.length ?? 0;
  const verifiedCount = facts?.filter((f) => f.verification_status === "VERIFIED").length ?? 0;
  const hasAudit = (audits?.length ?? 0) > 0;
  const hasContent = (content?.length ?? 0) > 0;
  const contentStatus = content?.[0]?.status ?? null;
  const enApproved =
    contentStatus === "EN_APPROVED" ||
    contentStatus === "KN_REVIEW_REQUIRED" ||
    contentStatus === "KN_APPROVED" ||
    contentStatus === "VALIDATED";
  const hasKannada =
    contentStatus === "KN_REVIEW_REQUIRED" ||
    contentStatus === "KN_APPROVED" ||
    contentStatus === "VALIDATED";
  const knApproved =
    contentStatus === "KN_APPROVED" || contentStatus === "VALIDATED";
  const hasPreview = (previews?.length ?? 0) > 0;
  const previewSlug = previews?.[0]?.slug;
  const desktopShot = previews?.[0]?.desktop_screenshot_path ?? null;
  const mobileShot = previews?.[0]?.mobile_screenshot_path ?? null;
  const hasShots = Boolean(desktopShot && mobileShot);
  const totalCost = (jobs ?? []).reduce((s, j) => s + Number(j.estimated_cost ?? 0), 0);
  const totalTokens = (jobs ?? []).reduce((s, j) => s + (j.tokens ?? 0), 0);
  const gap = lead.digital_gap_score;
  const readiness = lead.preview_readiness_score;
  const priority =
    gap !== null && readiness !== null
      ? Math.round(gap * 0.4 + readiness * 0.6)
      : null;

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

        {/* Scores (heuristic) */}
        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl font-bold text-slate-950">{gap ?? "—"}</span>
              <span className="mt-1 block text-xs text-slate-500">Digital Gap</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl font-bold text-slate-950">{readiness ?? "—"}</span>
              <span className="mt-1 block text-xs text-slate-500">Preview Readiness</span>
            </div>
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center shadow-sm">
              <span className="text-2xl font-bold text-teal-900">{priority ?? "—"}</span>
              <span className="mt-1 block text-xs text-teal-700">Priority</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="text-2xl font-bold text-slate-950">₹{totalCost.toFixed(2)}</span>
              <span className="mt-1 block text-xs text-slate-500">{totalTokens} tokens</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Scores are heuristic and subject to change after real sales
            conversations. Priority = 40% Digital Gap + 60% Preview Readiness.
            Not a predictive/commercial signal.
          </p>
          <ScoreBreakdown breakdown={lead.score_breakdown} />
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
            detail={lead.digital_gap_score !== null ? `Gap: ${lead.digital_gap_score}, Fit: ${lead.preview_readiness_score}` : "Not scored yet"}
          >
            <PipelineActionButton leadId={leadId} action="score" label="Compute Scores" />
          </StepCard>

          <StepCard
            title="5. Generate English Content"
            status={hasContent ? (contentStatus === "BLOCKED" ? "error" : "done") : "pending"}
            detail={hasContent ? `Template: ${content![0].template_key}, Status: ${contentStatus}` : "Not generated yet"}
          >
            <PipelineActionButton
              leadId={leadId}
              action="generate"
              label="Generate"
              disabled={verifiedCount === 0}
            />
          </StepCard>

          <StepCard
            title="6. Approve English (human gate)"
            status={enApproved ? "done" : hasContent ? "blocked" : "pending"}
            detail={
              enApproved
                ? "English approved by a human reviewer."
                : "Review the English preview, then approve before translation."
            }
          >
            <PipelineActionButton
              leadId={leadId}
              action="approve-en"
              label="Approve English"
              disabled={!hasContent || contentStatus === "BLOCKED" || enApproved}
            />
          </StepCard>

          <StepCard
            title="7. Translate to Kannada"
            status={hasKannada ? "done" : "pending"}
            detail={
              enApproved
                ? `Content status: ${contentStatus}`
                : "Approve English first"
            }
          >
            <PipelineActionButton
              leadId={leadId}
              action="translate"
              label="Translate"
              disabled={!enApproved}
            />
          </StepCard>

          <StepCard
            title="8. Approve Kannada (human gate)"
            status={knApproved ? "done" : hasKannada ? "blocked" : "pending"}
            detail={
              knApproved
                ? "Kannada approved by a human reviewer."
                : "Review the Kannada preview, then approve before deploy."
            }
          >
            <PipelineActionButton
              leadId={leadId}
              action="approve-kn"
              label="Approve Kannada"
              disabled={!hasKannada || knApproved}
            />
          </StepCard>

          <StepCard
            title="9. Deploy Preview"
            status={hasPreview ? "done" : knApproved ? "pending" : "blocked"}
            detail={
              hasPreview
                ? `Slug: ${previewSlug}`
                : knApproved
                  ? "Ready to deploy."
                  : "Deploy is locked until English and Kannada are approved."
            }
          >
            <div className="flex gap-2">
              <PipelineActionButton
                leadId={leadId}
                action="deploy"
                label="Deploy"
                disabled={!knApproved}
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

          <StepCard
            title="10. Screenshots"
            status={hasShots ? "done" : "pending"}
            detail={
              hasShots
                ? "Desktop + mobile captured."
                : hasPreview
                  ? "Capture desktop (1440×900) + mobile (390×844)."
                  : "Deploy a preview first."
            }
          >
            <div className="flex flex-col gap-3">
              <PipelineActionButton
                leadId={leadId}
                action="screenshots"
                label="Capture screenshots"
                disabled={!hasPreview}
              />
              {hasShots && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href={desktopShot!} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={desktopShot!}
                      alt="Desktop preview screenshot"
                      className="w-full rounded-md border border-slate-200"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Desktop</span>
                  </a>
                  <a href={mobileShot!} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mobileShot!}
                      alt="Mobile preview screenshot"
                      className="w-full rounded-md border border-slate-200"
                    />
                    <span className="mt-1 block text-xs text-slate-500">Mobile</span>
                  </a>
                </div>
              )}
            </div>
          </StepCard>
        </div>

        {/* Preview analytics (coarse, privacy-preserving) */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-950">
              Preview analytics
            </h2>
            <span
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                analyticsSummary.label === "ENGAGED"
                  ? "bg-teal-100 text-teal-800"
                  : analyticsSummary.label === "VIEWED"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {analyticsSummary.label}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Preview opens", value: analyticsSummary.opens },
              { label: "Call clicks", value: analyticsSummary.callClicks },
              { label: "WhatsApp clicks", value: analyticsSummary.whatsappClicks },
              { label: "Directions clicks", value: analyticsSummary.directionsClicks },
              { label: "Contact clicks", value: analyticsSummary.contactClicks },
            ].map((m) => (
              <div key={m.label} className="rounded-md bg-slate-50 p-2 text-center">
                <div className="text-lg font-bold text-slate-950">{m.value}</div>
                <div className="text-xs text-slate-500">{m.label}</div>
              </div>
            ))}
            <div className="rounded-md bg-slate-50 p-2 text-center">
              <div className="text-xs font-medium text-slate-700">
                {analyticsSummary.lastOpened
                  ? new Date(analyticsSummary.lastOpened).toLocaleString()
                  : "—"}
              </div>
              <div className="text-xs text-slate-500">Last opened</div>
            </div>
          </div>
        </section>

        {/* Outreach drafts (generated only; never sent automatically) */}
        <OutreachPanel leadId={leadId} />

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
