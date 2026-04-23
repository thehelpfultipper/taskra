import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

type PulseKind = "agent-activity-5m" | "market-10m" | "hourly-maintenance";

const QUEUES = {
  agentActivity: "agent_activity",
  marketTasks: "market_tasks",
} as const;

type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

type TaskRunInsert = {
  queue_name: QueueName;
  status: "queued";
  agent_id: string | null;
  objective_id: string | null;
  dedupe_key: string;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  payload: Record<string, unknown>;
};

type PulseSummary = {
  pulse: PulseKind;
  attempted: number;
  enqueued: number;
  dedupeSkipped: number;
  details: Record<string, number>;
  cleanup?: {
    cancelledQueued: number;
    failedRunning: number;
  };
};

function floorToMinuteBucket(date: Date, minuteStep: number): string {
  const bucket = new Date(date);
  bucket.setUTCSeconds(0, 0);
  const minute = bucket.getUTCMinutes();
  bucket.setUTCMinutes(minute - (minute % minuteStep));
  return bucket.toISOString();
}

function floorToHourBucket(date: Date): string {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

function getPayloadBase(queue: QueueName, action: string, nowIso: string, dedupeKey: string) {
  return {
    messageId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    enqueuedAt: nowIso,
    producer: "cron-pulse",
    queue,
    action,
    dedupeKey,
  };
}

async function loadExistingDedupeKeys(
  client: SupabaseClient,
  queueName: QueueName,
  dedupeKeys: string[],
): Promise<Set<string>> {
  if (dedupeKeys.length === 0) {
    return new Set();
  }

  const { data, error } = await client
    .from("task_runs")
    .select("dedupe_key")
    .eq("queue_name", queueName)
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw new Error(`Failed to check existing dedupe keys for ${queueName}: ${error.message}`);
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    if (row?.dedupe_key && typeof row.dedupe_key === "string") {
      keys.add(row.dedupe_key);
    }
  }
  return keys;
}

async function insertTaskRunsWithDedupe(
  client: SupabaseClient,
  rows: TaskRunInsert[],
): Promise<{ attempted: number; enqueued: number; dedupeSkipped: number }> {
  if (rows.length === 0) {
    return { attempted: 0, enqueued: 0, dedupeSkipped: 0 };
  }

  const queueName = rows[0].queue_name;
  const dedupeKeys = rows.map((row) => row.dedupe_key);
  const existingKeys = await loadExistingDedupeKeys(client, queueName, dedupeKeys);
  const filtered = rows.filter((row) => !existingKeys.has(row.dedupe_key));

  if (filtered.length > 0) {
    const { error } = await client.from("task_runs").insert(filtered);
    if (error) {
      throw new Error(`Failed to enqueue ${queueName} pulse tasks: ${error.message}`);
    }
  }

  return {
    attempted: rows.length,
    enqueued: filtered.length,
    dedupeSkipped: rows.length - filtered.length,
  };
}

async function buildAgentActivityPulseRows(
  client: SupabaseClient,
  now: Date,
): Promise<{ rows: TaskRunInsert[]; candidateCount: number }> {
  const bucketIso = floorToMinuteBucket(now, 5);
  const nowIso = now.toISOString();
  const { data, error } = await client
    .from("agent_objectives")
    .select("id,agent_id,priority,created_at")
    .eq("status", "active")
    .is("archived_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(30);

  if (error) {
    throw new Error(`Failed to load eligible objectives for 5m pulse: ${error.message}`);
  }

  const rows: TaskRunInsert[] = (data ?? []).map((objective) => {
    const dedupeKey = `pulse:activity:${objective.id}:${bucketIso}`;
    return {
      queue_name: QUEUES.agentActivity,
      status: "queued",
      agent_id: objective.agent_id,
      objective_id: objective.id,
      dedupe_key: dedupeKey,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: nowIso,
      payload: {
        ...getPayloadBase(QUEUES.agentActivity, "no_op", nowIso, dedupeKey),
        agentId: objective.agent_id,
        objectiveId: objective.id,
        context: {
          pulse: "agent-activity-5m",
          reason: "eligible-objective",
        },
      },
    };
  });

  return { rows, candidateCount: rows.length };
}

type MarketCandidateTasks = {
  fromNewJobs: TaskRunInsert[];
  fromNewlyOpenToWorkAgents: TaskRunInsert[];
  fromUnscreenedApplications: TaskRunInsert[];
};

async function buildMarketPulseRows(client: SupabaseClient, now: Date): Promise<MarketCandidateTasks> {
  const nowIso = now.toISOString();
  const bucketIso = floorToMinuteBucket(now, 10);
  const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newJobs, error: newJobsError } = await client
    .from("jobs")
    .select("id,created_at")
    .eq("status", "open")
    .gte("created_at", twentyMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(8);
  if (newJobsError) {
    throw new Error(`Failed to load new jobs for market pulse: ${newJobsError.message}`);
  }

  const { data: openToWorkPool, error: openToWorkPoolError } = await client
    .from("agent_state")
    .select("agent_id,updated_at,last_seen_at")
    .contains("state_payload", { open_to_work: true })
    .in("lifecycle_status", ["idle", "running"])
    .order("updated_at", { ascending: false })
    .limit(20);
  if (openToWorkPoolError) {
    throw new Error(`Failed to load open-to-work agent pool: ${openToWorkPoolError.message}`);
  }

  const { data: recentlyOpenAgents, error: recentlyOpenAgentsError } = await client
    .from("agent_state")
    .select("agent_id,updated_at")
    .contains("state_payload", { open_to_work: true })
    .gte("updated_at", ninetyMinutesAgo)
    .in("lifecycle_status", ["idle", "running"])
    .order("updated_at", { ascending: false })
    .limit(10);
  if (recentlyOpenAgentsError) {
    throw new Error(
      `Failed to load newly open-to-work agents for market pulse: ${recentlyOpenAgentsError.message}`,
    );
  }

  const { data: recentOpenJobs, error: recentOpenJobsError } = await client
    .from("jobs")
    .select("id,created_at")
    .eq("status", "open")
    .gte("created_at", tenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(12);
  if (recentOpenJobsError) {
    throw new Error(`Failed to load recent open jobs for market pulse: ${recentOpenJobsError.message}`);
  }

  const { data: unscreenedApplications, error: unscreenedApplicationsError } = await client
    .from("applications")
    .select("id,job_id,applicant_agent_id,created_at,jobs!inner(status)")
    .eq("current_status", "submitted")
    .eq("jobs.status", "open")
    .order("created_at", { ascending: true })
    .limit(24);
  if (unscreenedApplicationsError) {
    throw new Error(
      `Failed to load unscreened applications for market pulse: ${unscreenedApplicationsError.message}`,
    );
  }

  const fromNewJobs: TaskRunInsert[] = [];
  const newJobCandidateAgents = (openToWorkPool ?? []).slice(0, 12);
  for (const job of newJobs ?? []) {
    for (const agent of newJobCandidateAgents.slice(0, 3)) {
      if (fromNewJobs.length >= 24) {
        break;
      }
      const dedupeKey = `pulse:market:new-job:${job.id}:${agent.agent_id}:${bucketIso}`;
      fromNewJobs.push({
        queue_name: QUEUES.marketTasks,
        status: "queued",
        agent_id: agent.agent_id,
        objective_id: null,
        dedupe_key: dedupeKey,
        attempts: 0,
        max_attempts: 3,
        scheduled_for: nowIso,
        payload: {
          ...getPayloadBase(QUEUES.marketTasks, "apply_to_job", nowIso, dedupeKey),
          agentId: agent.agent_id,
          jobId: job.id,
          context: {
            pulse: "market-10m",
            reason: "new-job",
          },
        },
      });
    }
  }

  const fromNewlyOpenToWorkAgents: TaskRunInsert[] = [];
  for (const agent of recentlyOpenAgents ?? []) {
    for (const job of (recentOpenJobs ?? []).slice(0, 2)) {
      if (fromNewlyOpenToWorkAgents.length >= 20) {
        break;
      }
      const dedupeKey = `pulse:market:open-to-work:${agent.agent_id}:${job.id}:${bucketIso}`;
      fromNewlyOpenToWorkAgents.push({
        queue_name: QUEUES.marketTasks,
        status: "queued",
        agent_id: agent.agent_id,
        objective_id: null,
        dedupe_key: dedupeKey,
        attempts: 0,
        max_attempts: 3,
        scheduled_for: nowIso,
        payload: {
          ...getPayloadBase(QUEUES.marketTasks, "apply_to_job", nowIso, dedupeKey),
          agentId: agent.agent_id,
          jobId: job.id,
          context: {
            pulse: "market-10m",
            reason: "newly-open-to-work",
          },
        },
      });
    }
  }

  const fromUnscreenedApplications: TaskRunInsert[] = (unscreenedApplications ?? []).map((application) => {
    const dedupeKey = `pulse:market:unscreened:${application.id}:${bucketIso}`;
    return {
      queue_name: QUEUES.marketTasks,
      status: "queued",
      agent_id: application.applicant_agent_id,
      objective_id: null,
      dedupe_key: dedupeKey,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: nowIso,
      payload: {
        ...getPayloadBase(QUEUES.marketTasks, "recruiter_screening", nowIso, dedupeKey),
        agentId: application.applicant_agent_id,
        jobId: application.job_id,
        context: {
          pulse: "market-10m",
          reason: "unscreened-application",
          applicationId: application.id,
        },
      },
    };
  });

  return { fromNewJobs, fromNewlyOpenToWorkAgents, fromUnscreenedApplications };
}

async function buildHourlyRefreshRows(
  client: SupabaseClient,
  now: Date,
): Promise<{ rows: TaskRunInsert[]; candidateCount: number }> {
  const nowIso = now.toISOString();
  const bucketIso = floorToHourBucket(now);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("agent_state")
    .select("agent_id,updated_at")
    .in("lifecycle_status", ["idle", "running"])
    .lte("updated_at", oneHourAgo)
    .order("updated_at", { ascending: true })
    .limit(15);

  if (error) {
    throw new Error(`Failed to load hourly refresh candidates: ${error.message}`);
  }

  const rows: TaskRunInsert[] = (data ?? []).map((candidate) => {
    const dedupeKey = `pulse:hourly:refresh:${candidate.agent_id}:${bucketIso}`;
    return {
      queue_name: QUEUES.agentActivity,
      status: "queued",
      agent_id: candidate.agent_id,
      objective_id: null,
      dedupe_key: dedupeKey,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: nowIso,
      payload: {
        ...getPayloadBase(QUEUES.agentActivity, "no_op", nowIso, dedupeKey),
        agentId: candidate.agent_id,
        context: {
          pulse: "hourly-maintenance",
          reason: "hourly-refresh",
        },
      },
    };
  });

  return { rows, candidateCount: rows.length };
}

async function runHourlyCleanup(client: SupabaseClient): Promise<{ cancelledQueued: number; failedRunning: number }> {
  const nowIso = new Date().toISOString();
  const queuedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const runningCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: staleQueued, error: staleQueuedError } = await client
    .from("task_runs")
    .select("id")
    .eq("status", "queued")
    .lt("scheduled_for", queuedCutoff)
    .order("scheduled_for", { ascending: true })
    .limit(50);
  if (staleQueuedError) {
    throw new Error(`Failed to load stale queued tasks: ${staleQueuedError.message}`);
  }

  let cancelledQueued = 0;
  const staleQueuedIds = (staleQueued ?? []).map((row) => row.id);
  if (staleQueuedIds.length > 0) {
    const { error } = await client
      .from("task_runs")
      .update({
        status: "cancelled",
        error_message: "Hourly cleanup: cancelled stale queued task.",
        finished_at: nowIso,
        result: { outcome: "cleanup_cancelled_stale_queued" },
      })
      .in("id", staleQueuedIds)
      .eq("status", "queued");
    if (error) {
      throw new Error(`Failed to cancel stale queued tasks: ${error.message}`);
    }
    cancelledQueued = staleQueuedIds.length;
  }

  const { data: staleRunning, error: staleRunningError } = await client
    .from("task_runs")
    .select("id")
    .eq("status", "running")
    .lt("started_at", runningCutoff)
    .order("started_at", { ascending: true })
    .limit(25);
  if (staleRunningError) {
    throw new Error(`Failed to load stale running tasks: ${staleRunningError.message}`);
  }

  let failedRunning = 0;
  const staleRunningIds = (staleRunning ?? []).map((row) => row.id);
  if (staleRunningIds.length > 0) {
    const { error } = await client
      .from("task_runs")
      .update({
        status: "failed",
        error_message: "Hourly cleanup: marked stale running task as failed.",
        finished_at: nowIso,
        result: { outcome: "cleanup_failed_stale_running" },
      })
      .in("id", staleRunningIds)
      .eq("status", "running");
    if (error) {
      throw new Error(`Failed to fail stale running tasks: ${error.message}`);
    }
    failedRunning = staleRunningIds.length;
  }

  return { cancelledQueued, failedRunning };
}

async function runAgentActivityPulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const { rows, candidateCount } = await buildAgentActivityPulseRows(client, now);
  const enqueue = await insertTaskRunsWithDedupe(client, rows);
  return {
    pulse: "agent-activity-5m",
    attempted: enqueue.attempted,
    enqueued: enqueue.enqueued,
    dedupeSkipped: enqueue.dedupeSkipped,
    details: {
      eligibleObjectives: candidateCount,
    },
  };
}

async function runMarketPulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const candidates = await buildMarketPulseRows(client, now);

  const newJobsResult = await insertTaskRunsWithDedupe(client, candidates.fromNewJobs);
  const openToWorkResult = await insertTaskRunsWithDedupe(client, candidates.fromNewlyOpenToWorkAgents);
  const unscreenedResult = await insertTaskRunsWithDedupe(client, candidates.fromUnscreenedApplications);

  return {
    pulse: "market-10m",
    attempted: newJobsResult.attempted + openToWorkResult.attempted + unscreenedResult.attempted,
    enqueued: newJobsResult.enqueued + openToWorkResult.enqueued + unscreenedResult.enqueued,
    dedupeSkipped:
      newJobsResult.dedupeSkipped + openToWorkResult.dedupeSkipped + unscreenedResult.dedupeSkipped,
    details: {
      newJobs: candidates.fromNewJobs.length,
      newlyOpenToWork: candidates.fromNewlyOpenToWorkAgents.length,
      unscreenedApplications: candidates.fromUnscreenedApplications.length,
    },
  };
}

async function runHourlyMaintenancePulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const { rows, candidateCount } = await buildHourlyRefreshRows(client, now);
  const enqueue = await insertTaskRunsWithDedupe(client, rows);
  const cleanup = await runHourlyCleanup(client);

  return {
    pulse: "hourly-maintenance",
    attempted: enqueue.attempted,
    enqueued: enqueue.enqueued,
    dedupeSkipped: enqueue.dedupeSkipped,
    details: {
      refreshCandidates: candidateCount,
    },
    cleanup,
  };
}

export type RunPulseInput = {
  pulse: PulseKind;
  client: SupabaseClient;
};

export async function runPulseOrchestration(input: RunPulseInput): Promise<PulseSummary> {
  const now = new Date();
  if (input.pulse === "agent-activity-5m") {
    return runAgentActivityPulse(input.client, now);
  }
  if (input.pulse === "market-10m") {
    return runMarketPulse(input.client, now);
  }
  return runHourlyMaintenancePulse(input.client, now);
}

export function isPulseKind(value: string | null): value is PulseKind {
  return value === "agent-activity-5m" || value === "market-10m" || value === "hourly-maintenance";
}
