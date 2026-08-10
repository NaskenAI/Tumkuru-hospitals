/**
 * Job runner — processes pipeline jobs with retries, cost tracking, and logging.
 *
 * Jobs are stored in the `jobs` table and processed on-demand via API call.
 * Each job is idempotent and safe to retry.
 */

import {
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { Json } from "@/lib/database/types";
import type { LlmUsage } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobType =
  | "collectSources"
  | "extractFacts"
  | "auditWebsite"
  | "scoreLead"
  | "generateContent"
  | "translateContent"
  | "validateClaims"
  | "renderPreview"
  | "deployPreview"
  | "captureScreenshots"
  | "generateOutreachDraft";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export type JobRecord = {
  id: string;
  lead_id: string | null;
  job_type: JobType;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  model: string | null;
  tokens: number | null;
  estimated_cost: number | null;
  result: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Job CRUD
// ---------------------------------------------------------------------------

export async function createJob(input: {
  leadId: string;
  jobType: JobType;
}): Promise<JobRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured.");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      lead_id: input.leadId,
      job_type: input.jobType,
      status: "PENDING" as const,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message}`);
  }

  return data as unknown as JobRecord;
}

export async function startJob(jobId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "RUNNING" as const,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to start job: ${error.message}`);
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>,
  usage?: LlmUsage,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "SUCCESS" as const,
      completed_at: new Date().toISOString(),
      result: result as unknown as Json,
      model: usage?.model ?? null,
      tokens: usage?.totalTokens ?? null,
      estimated_cost: usage?.estimatedCostInr ?? null,
    })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to complete job: ${error.message}`);
}

export async function failJob(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "FAILED" as const,
      completed_at: new Date().toISOString(),
      error: errorMessage,
    })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to record job failure: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Cost tracking
// ---------------------------------------------------------------------------

export async function getTotalCostForLead(
  leadId: string,
): Promise<{ totalTokens: number; totalCostInr: number }> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("tokens,estimated_cost")
    .eq("lead_id", leadId)
    .eq("status", "SUCCESS");

  if (error) throw new Error(`Failed to get costs: ${error.message}`);

  const totalTokens = (data ?? []).reduce(
    (sum, j) => sum + (j.tokens ?? 0),
    0,
  );
  const totalCostInr = (data ?? []).reduce(
    (sum, j) => sum + Number(j.estimated_cost ?? 0),
    0,
  );

  return { totalTokens, totalCostInr };
}

/**
 * Check if spending is within configured caps.
 */
export function checkCostCaps(input: {
  totalTokens: number;
  totalCostInr: number;
}): { withinCaps: boolean; reason: string | null } {
  const tokenCap = Number(process.env.AI_TOKEN_CAP_PER_LEAD ?? 20000);
  const costCap = Number(process.env.AI_COST_CAP_PER_RUN_INR ?? 250);

  if (input.totalTokens > tokenCap) {
    return {
      withinCaps: false,
      reason: `Token cap exceeded: ${input.totalTokens} > ${tokenCap}`,
    };
  }

  if (input.totalCostInr > costCap) {
    return {
      withinCaps: false,
      reason: `Cost cap exceeded: ₹${input.totalCostInr.toFixed(2)} > ₹${costCap}`,
    };
  }

  return { withinCaps: true, reason: null };
}

// ---------------------------------------------------------------------------
// Run a job with error handling
// ---------------------------------------------------------------------------

export async function runJobWithTracking<T>(input: {
  leadId: string;
  jobType: JobType;
  execute: () => Promise<{ result: T; usage?: LlmUsage }>;
}): Promise<{ job: JobRecord; result: T }> {
  const job = await createJob({
    leadId: input.leadId,
    jobType: input.jobType,
  });

  await startJob(job.id);

  try {
    // Check cost caps before running
    const costs = await getTotalCostForLead(input.leadId);
    const caps = checkCostCaps(costs);
    if (!caps.withinCaps) {
      await failJob(job.id, caps.reason!);
      throw new Error(caps.reason!);
    }

    const { result, usage } = await input.execute();
    await completeJob(job.id, { success: true } as Record<string, unknown>, usage);

    return { job: { ...job, status: "SUCCESS" }, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job.id, message);
    throw err;
  }
}
