import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { type MvpQueueName } from "./queue-contracts.ts";

type RuntimeControlRow = {
  key: string;
  value: unknown;
};

type AgentRuntimeControlRow = {
  agent_id: string;
  is_disabled: boolean;
  cooldown_until: string | null;
  max_posts_per_day: number | null;
  max_applies_per_day: number | null;
};

type ActionFamily = "create_post" | "apply_to_job";

export type AgentSafetyEvaluation = {
  allowed: boolean;
  reason: string | null;
  details: Record<string, unknown>;
};

export type WorkerRunLogInput = {
  runType: "worker_batch" | "cron_pulse" | "cleanup";
  queueName?: MvpQueueName;
  pulseName?: "agent-activity-5m" | "market-10m" | "hourly-maintenance";
  status: "succeeded" | "failed" | "skipped";
  requestedBatchSize?: number;
  claimed?: number;
  succeeded?: number;
  retried?: number;
  failed?: number;
  skippedDuplicate?: number;
  details?: Record<string, unknown>;
  errorMessage?: string;
  startedAtIso: string;
  finishedAtIso: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
}

async function loadRuntimeControl(client: SupabaseClient, key: string): Promise<RuntimeControlRow | null> {
  const { data, error } = await client.from("runtime_controls").select("key,value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(`Failed to load runtime control ${key}: ${error.message}`);
  }
  return (data as RuntimeControlRow | null) ?? null;
}

async function loadAgentControl(client: SupabaseClient, agentId: string): Promise<AgentRuntimeControlRow | null> {
  const { data, error } = await client
    .from("agent_runtime_controls")
    .select("agent_id,is_disabled,cooldown_until,max_posts_per_day,max_applies_per_day")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load runtime controls for ${agentId}: ${error.message}`);
  }
  return (data as AgentRuntimeControlRow | null) ?? null;
}

async function readEnabledControl(client: SupabaseClient, key: string, defaultValue = true): Promise<boolean> {
  const control = await loadRuntimeControl(client, key);
  const enabled = asBoolean(asRecord(control?.value).enabled);
  return enabled ?? defaultValue;
}

async function loadDefaultLimits(client: SupabaseClient): Promise<{ maxPostsPerDay: number; maxAppliesPerDay: number }> {
  const control = await loadRuntimeControl(client, "limits:defaults");
  const value = asRecord(control?.value);
  return {
    maxPostsPerDay: Math.max(1, asNumber(value.max_posts_per_day) ?? 6),
    maxAppliesPerDay: Math.max(1, asNumber(value.max_applies_per_day) ?? 8),
  };
}

export async function isQueueProcessingEnabled(client: SupabaseClient, queueName: MvpQueueName): Promise<boolean> {
  const [globalEnabled, queueEnabled] = await Promise.all([
    readEnabledControl(client, "global_workers", true),
    readEnabledControl(client, `queue:${queueName}`, true),
  ]);
  return globalEnabled && queueEnabled;
}

export async function isPulseEnabled(
  client: SupabaseClient,
  pulse: "agent-activity-5m" | "market-10m" | "hourly-maintenance",
): Promise<boolean> {
  const pulseQueueMap: Record<string, MvpQueueName | null> = {
    "agent-activity-5m": "agent_activity",
    "market-10m": "market_tasks",
    "hourly-maintenance": "agent_activity",
  };
  const [cronEnabled, queueEnabled] = await Promise.all([
    readEnabledControl(client, "cron_pulse", true),
    pulseQueueMap[pulse] ? isQueueProcessingEnabled(client, pulseQueueMap[pulse] as MvpQueueName) : Promise.resolve(true),
  ]);
  return cronEnabled && queueEnabled;
}

export async function evaluateAgentActionSafety(
  client: SupabaseClient,
  input: { agentId: string; actionFamily: ActionFamily },
): Promise<AgentSafetyEvaluation> {
  const [enabled, control, defaults] = await Promise.all([
    readEnabledControl(client, "global_workers", true),
    loadAgentControl(client, input.agentId),
    loadDefaultLimits(client),
  ]);

  if (!enabled) {
    return {
      allowed: false,
      reason: "global_workers_disabled",
      details: { actionFamily: input.actionFamily },
    };
  }

  if (control?.is_disabled) {
    return {
      allowed: false,
      reason: "agent_disabled",
      details: { actionFamily: input.actionFamily },
    };
  }

  if (control?.cooldown_until && Date.parse(control.cooldown_until) > Date.now()) {
    return {
      allowed: false,
      reason: "agent_cooldown_active",
      details: { actionFamily: input.actionFamily, cooldownUntil: control.cooldown_until },
    };
  }

  if (input.actionFamily === "create_post") {
    const maxPosts = control?.max_posts_per_day ?? defaults.maxPostsPerDay;
    const { count, error } = await client
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_agent_id", input.agentId)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (error) {
      throw new Error(`Failed post limit check for ${input.agentId}: ${error.message}`);
    }
    const used = count ?? 0;
    if (used >= maxPosts) {
      return {
        allowed: false,
        reason: "post_daily_limit_reached",
        details: { actionFamily: input.actionFamily, count: used, max: maxPosts },
      };
    }
    return {
      allowed: true,
      reason: null,
      details: { actionFamily: input.actionFamily, count: used, max: maxPosts },
    };
  }

  const maxApplies = control?.max_applies_per_day ?? defaults.maxAppliesPerDay;
  const { count, error } = await client
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("applicant_agent_id", input.agentId)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (error) {
    throw new Error(`Failed apply limit check for ${input.agentId}: ${error.message}`);
  }
  const used = count ?? 0;
  if (used >= maxApplies) {
    return {
      allowed: false,
      reason: "apply_daily_limit_reached",
      details: { actionFamily: input.actionFamily, count: used, max: maxApplies },
    };
  }
  return {
    allowed: true,
    reason: null,
    details: { actionFamily: input.actionFamily, count: used, max: maxApplies },
  };
}

export async function checkAgentAvailability(
  client: SupabaseClient,
  agentId: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  const [enabled, control] = await Promise.all([
    readEnabledControl(client, "global_workers", true),
    loadAgentControl(client, agentId),
  ]);
  if (!enabled) {
    return { allowed: false, reason: "global_workers_disabled" };
  }
  if (control?.is_disabled) {
    return { allowed: false, reason: "agent_disabled" };
  }
  if (control?.cooldown_until && Date.parse(control.cooldown_until) > Date.now()) {
    return { allowed: false, reason: "agent_cooldown_active" };
  }
  return { allowed: true, reason: null };
}

export async function recordWorkerRunLog(client: SupabaseClient, input: WorkerRunLogInput): Promise<void> {
  const { error } = await client.from("worker_run_logs").insert({
    run_type: input.runType,
    queue_name: input.queueName ?? null,
    pulse_name: input.pulseName ?? null,
    status: input.status,
    requested_batch_size: input.requestedBatchSize ?? null,
    claimed: input.claimed ?? 0,
    succeeded: input.succeeded ?? 0,
    retried: input.retried ?? 0,
    failed: input.failed ?? 0,
    skipped_duplicate: input.skippedDuplicate ?? 0,
    details: input.details ?? {},
    error_message: input.errorMessage?.slice(0, 1000) ?? null,
    started_at: input.startedAtIso,
    finished_at: input.finishedAtIso,
  });
  if (error) {
    console.error("[worker-log] persist_failed", error.message);
  }
}
