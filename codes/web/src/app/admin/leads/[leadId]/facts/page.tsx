import { AlertCircle, ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { FactReviewControls } from "@/components/leads/fact-review-controls";
import { detectConflicts } from "@/lib/facts/conflicts";
import type { Json, RiskTier, VerificationStatus } from "@/lib/database/types";
import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeadFactReviewPageProps = {
  params: Promise<{ leadId: string }>;
};

type LeadSummary = {
  id: string;
  hospital_name: string;
  city: string | null;
  status: string;
};

type FactRow = {
  id: string;
  fact_type: string;
  value: Json;
  risk_tier: RiskTier;
  source_excerpt: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  source_id: string | null;
  source: {
    url: string | null;
    retrieved_at: string | null;
    title: string | null;
  } | null;
};

async function getLeadAndFacts(leadId: string): Promise<{
  lead: LeadSummary | null;
  facts: FactRow[];
  error: string | null;
}> {
  if (!isSupabaseConfigured()) {
    return {
      lead: null,
      facts: [],
      error: "Supabase is not configured yet.",
    };
  }

  const supabase = createSupabaseServiceClient();
  const [{ data: lead, error: leadError }, { data: facts, error: factsError }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id,hospital_name,city,status")
        .eq("id", leadId)
        .single(),
      supabase
        .from("hospital_facts")
        .select(
          "id,fact_type,value,risk_tier,source_excerpt,verification_status,created_at,source_id,source:sources(url,retrieved_at,title)",
        )
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true }),
    ]);

  return {
    lead: lead ?? null,
    facts: (facts as FactRow[] | null) ?? [],
    error: leadError?.message ?? factsError?.message ?? null,
  };
}

export default async function LeadFactReviewPage({
  params,
}: LeadFactReviewPageProps) {
  const { leadId } = await params;
  const { lead, facts, error } = await getLeadAndFacts(leadId);
  const conflicts = detectConflicts(
    facts.map((f) => ({
      id: f.id,
      fact_type: f.fact_type,
      value: f.value,
      source_id: f.source_id,
    })),
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
          <Link
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
            href="/admin/leads"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Leads
          </Link>
          <div>
            <p className="text-sm font-medium text-teal-700">Fact review</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              {lead?.hospital_name ?? "Lead facts"}
            </h1>
            {lead?.city && (
              <p className="mt-1 text-sm text-slate-500">{lead.city}</p>
            )}
          </div>
        </header>

        {conflicts.length > 0 && (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-sm font-semibold">
              ⚠ {conflicts.length} source conflict
              {conflicts.length > 1 ? "s" : ""} — human decision required
            </h2>
            <p className="mt-1 text-xs">
              Different sources disagree on these facts. Verify the correct value
              and reject the others. Do not approve a conflicting fact without
              resolving it.
            </p>
            <ul className="mt-3 space-y-2">
              {conflicts.map((c) => (
                <li key={c.fact_type} className="text-xs">
                  <span className="font-semibold">{c.fact_type}:</span>{" "}
                  {c.variants.map((v, i) => (
                    <span key={i}>
                      {i > 0 && " vs "}
                      <span className="rounded bg-white px-1.5 py-0.5">
                        {v.value}
                      </span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        {error ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">Setup needed</h2>
                <p className="mt-2 text-sm leading-6">{error}</p>
              </div>
            </div>
          </section>
        ) : facts.length === 0 ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <ClipboardCheck size={22} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-950">
              No extracted facts yet
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Collect a source, run extraction, then review facts here.
            </p>
          </section>
        ) : (
          <section className="grid gap-4">
            {facts.map((fact) => (
              <FactReviewControls key={fact.id} fact={fact} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
