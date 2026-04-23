import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  checkAgentAvailability,
  evaluateAgentActionSafety,
  isPulseEnabled,
  isQueueProcessingEnabled,
} from "./safety-rails.ts";

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
  skippedReason?: string;
  cleanup?: {
    cancelledQueued: number;
    failedRunning: number;
    deletedSucceededOrCancelled: number;
    deletedFailed: number;
    deletedWorkerLogs: number;
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

async function filterRowsByAgentSafety(
  client: SupabaseClient,
  rows: TaskRunInsert[],
): Promise<{ rows: TaskRunInsert[]; skipped: number }> {
  if (rows.length === 0) {
    return { rows, skipped: 0 };
  }

  const cache = new Map<string, { allowed: boolean }>();
  const filtered: TaskRunInsert[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.agent_id) {
      filtered.push(row);
      continue;
    }

    const payloadAction = typeof row.payload?.action === "string" ? row.payload.action : null;
    const cacheKey = `${row.agent_id}:${payloadAction ?? "none"}`;
    let decision = cache.get(cacheKey);

    if (!decision) {
      if (payloadAction === "apply_to_job" || payloadAction === "create_post") {
        const safety = await evaluateAgentActionSafety(client, {
          agentId: row.agent_id,
          actionFamily: payloadAction,
        });
        decision = { allowed: safety.allowed };
      } else {
        const availability = await checkAgentAvailability(client, row.agent_id);
        decision = { allowed: availability.allowed };
      }
      cache.set(cacheKey, decision);
    }

    if (decision.allowed) {
      filtered.push(row);
    } else {
      skipped += 1;
    }
  }

  return { rows: filtered, skipped };
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
    .select("id,org_id,created_at")
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
    .select("id,org_id,created_at")
    .eq("status", "open")
    .gte("created_at", tenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(12);
  if (recentOpenJobsError) {
    throw new Error(`Failed to load recent open jobs for market pulse: ${recentOpenJobsError.message}`);
  }

  const { data: unscreenedApplications, error: unscreenedApplicationsError } = await client
    .from("applications")
    .select("id,job_id,applicant_agent_id,created_at,jobs!inner(id,org_id,status)")
    .eq("current_status", "submitted")
    .eq("jobs.status", "open")
    .order("created_at", { ascending: true })
    .limit(24);
  if (unscreenedApplicationsError) {
    throw new Error(
      `Failed to load unscreened applications for market pulse: ${unscreenedApplicationsError.message}`,
    );
  }

  const candidateAgentIds = Array.from(
    new Set([...(openToWorkPool ?? []).map((row) => row.agent_id), ...(recentlyOpenAgents ?? []).map((row) => row.agent_id)]),
  );
  const { data: candidateAgents, error: candidateAgentsError } =
    candidateAgentIds.length > 0
      ? await client
          .from("agents")
          .select("id,primary_org_id")
          .in("id", candidateAgentIds)
      : { data: [], error: null };
  if (candidateAgentsError) {
    throw new Error(`Failed to load candidate agents for market pulse: ${candidateAgentsError.message}`);
  }

  const { data: candidateObjectives, error: candidateObjectivesError } =
    candidateAgentIds.length > 0
      ? await client
          .from("agent_objectives")
          .select("agent_id,objective_type,status,archived_at,priority,created_at")
          .in("agent_id", candidateAgentIds)
          .eq("status", "active")
          .is("archived_at", null)
      : { data: [], error: null };
  if (candidateObjectivesError) {
    throw new Error(
      `Failed to load candidate objectives for market pulse: ${candidateObjectivesError.message}`,
    );
  }

  const objectiveByAgent = new Map<string, string>();
  for (const objective of candidateObjectives ?? []) {
    if (!objectiveByAgent.has(objective.agent_id)) {
      objectiveByAgent.set(objective.agent_id, objective.objective_type);
    }
  }

  const agentById = new Map(
    (candidateAgents ?? []).map((agent) => [agent.id, { id: agent.id, primaryOrgId: agent.primary_org_id }]),
  );
  const eligibleOpenToWorkAgents = (openToWorkPool ?? []).filter((candidate) => {
    const objectiveType = objectiveByAgent.get(candidate.agent_id);
    return objectiveType === "open_to_work" || objectiveType === "passive_candidate";
  });
  const eligibleRecentlyOpenAgents = (recentlyOpenAgents ?? []).filter((candidate) => {
    const objectiveType = objectiveByAgent.get(candidate.agent_id);
    return objectiveType === "open_to_work" || objectiveType === "passive_candidate";
  });

  const { data: recruiterMemberships, error: recruiterMembershipsError } = await client
    .from("org_memberships")
    .select("org_id,user_id,role,status")
    .eq("status", "active")
    .in("role", ["owner", "admin", "recruiter"]);
  if (recruiterMembershipsError) {
    throw new Error(
      `Failed to load recruiter memberships for market pulse: ${recruiterMembershipsError.message}`,
    );
  }

  const recruiterOwnerIds = Array.from(new Set((recruiterMemberships ?? []).map((membership) => membership.user_id)));
  const { data: recruiterAgents, error: recruiterAgentsError } =
    recruiterOwnerIds.length > 0
      ? await client
          .from("agents")
          .select("id,owner_user_id,primary_org_id")
          .in("owner_user_id", recruiterOwnerIds)
      : { data: [], error: null };
  if (recruiterAgentsError) {
    throw new Error(`Failed to load recruiter agents for market pulse: ${recruiterAgentsError.message}`);
  }

  const recruiterOwnersByOrg = new Map<string, Set<string>>();
  for (const membership of recruiterMemberships ?? []) {
    if (!recruiterOwnersByOrg.has(membership.org_id)) {
      recruiterOwnersByOrg.set(membership.org_id, new Set());
    }
    recruiterOwnersByOrg.get(membership.org_id)?.add(membership.user_id);
  }

  function pickRecruiterAgentForOrg(orgId: string): string | null {
    const owners = recruiterOwnersByOrg.get(orgId);
    if (!owners || owners.size === 0) {
      return null;
    }
    const candidates = (recruiterAgents ?? []).filter((agent) => owners.has(agent.owner_user_id));
    const primaryOrgCandidate = candidates.find((agent) => agent.primary_org_id === orgId);
    return (primaryOrgCandidate ?? candidates[0])?.id ?? null;
  }

  const fromNewJobs: TaskRunInsert[] = [];
  const newJobCandidateAgents = eligibleOpenToWorkAgents.slice(0, 12);
  for (const job of newJobs ?? []) {
    for (const agent of newJobCandidateAgents.slice(0, 4)) {
      if (fromNewJobs.length >= 24) {
        break;
      }
      const profile = agentById.get(agent.agent_id);
      if (profile?.primaryOrgId && profile.primaryOrgId === job.org_id) {
        continue;
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
            matching: {
              objectiveType: objectiveByAgent.get(agent.agent_id) ?? null,
              simpleGate: "open_to_work + objective + not_primary_org",
            },
          },
        },
      });
    }
  }

  const fromNewlyOpenToWorkAgents: TaskRunInsert[] = [];
  for (const agent of eligibleRecentlyOpenAgents) {
    for (const job of (recentOpenJobs ?? []).slice(0, 2)) {
      if (fromNewlyOpenToWorkAgents.length >= 20) {
        break;
      }
      const profile = agentById.get(agent.agent_id);
      if (profile?.primaryOrgId && profile.primaryOrgId === job.org_id) {
        continue;
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
            matching: {
              objectiveType: objectiveByAgent.get(agent.agent_id) ?? null,
              simpleGate: "open_to_work + objective + not_primary_org",
            },
          },
        },
      });
    }
  }

  const fromUnscreenedApplications: TaskRunInsert[] = [];
  for (const application of unscreenedApplications ?? []) {
    const jobOrgId = application.jobs.org_id as string | undefined;
    if (!jobOrgId) {
      continue;
    }
    const recruiterAgentId = pickRecruiterAgentForOrg(jobOrgId);
    if (!recruiterAgentId) {
      continue;
    }
    const dedupeKey = `pulse:market:unscreened:${application.id}:${bucketIso}`;
    fromUnscreenedApplications.push({
      queue_name: QUEUES.marketTasks,
      status: "queued",
      agent_id: recruiterAgentId,
      objective_id: null,
      dedupe_key: dedupeKey,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: nowIso,
      payload: {
        ...getPayloadBase(QUEUES.marketTasks, "recruiter_screening", nowIso, dedupeKey),
        agentId: recruiterAgentId,
        jobId: application.job_id,
        context: {
          pulse: "market-10m",
          reason: "unscreened-application",
          applicationId: application.id,
          applicantAgentId: application.applicant_agent_id,
          recruiterAgentId,
        },
      },
    });
  }

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

async function runHourlyCleanup(client: SupabaseClient): Promise<{
  cancelledQueued: number;
  failedRunning: number;
  deletedSucceededOrCancelled: number;
  deletedFailed: number;
  deletedWorkerLogs: number;
}> {
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

  const successfulCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const failedCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const logsCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldSucceededRows, error: oldSucceededRowsError } = await client
    .from("task_runs")
    .select("id")
    .in("status", ["succeeded", "cancelled"])
    .lt("finished_at", successfulCutoff)
    .order("finished_at", { ascending: true })
    .limit(200);
  if (oldSucceededRowsError) {
    throw new Error(`Failed to load old succeeded/cancelled tasks: ${oldSucceededRowsError.message}`);
  }
  const oldSucceededIds = (oldSucceededRows ?? []).map((row) => row.id);
  let deletedSucceededOrCancelled = 0;
  if (oldSucceededIds.length > 0) {
    const { error } = await client.from("task_runs").delete().in("id", oldSucceededIds);
    if (error) {
      throw new Error(`Failed to delete old succeeded/cancelled tasks: ${error.message}`);
    }
    deletedSucceededOrCancelled = oldSucceededIds.length;
  }

  const { data: oldFailedRows, error: oldFailedRowsError } = await client
    .from("task_runs")
    .select("id")
    .eq("status", "failed")
    .lt("finished_at", failedCutoff)
    .order("finished_at", { ascending: true })
    .limit(100);
  if (oldFailedRowsError) {
    throw new Error(`Failed to load old failed tasks: ${oldFailedRowsError.message}`);
  }
  const oldFailedIds = (oldFailedRows ?? []).map((row) => row.id);
  let deletedFailed = 0;
  if (oldFailedIds.length > 0) {
    const { error } = await client.from("task_runs").delete().in("id", oldFailedIds);
    if (error) {
      throw new Error(`Failed to delete old failed tasks: ${error.message}`);
    }
    deletedFailed = oldFailedIds.length;
  }

  const { data: oldLogRows, error: oldLogRowsError } = await client
    .from("worker_run_logs")
    .select("id")
    .lt("started_at", logsCutoff)
    .order("started_at", { ascending: true })
    .limit(300);
  if (oldLogRowsError) {
    throw new Error(`Failed to load old worker logs: ${oldLogRowsError.message}`);
  }
  const oldLogIds = (oldLogRows ?? []).map((row) => row.id);
  let deletedWorkerLogs = 0;
  if (oldLogIds.length > 0) {
    const { error } = await client.from("worker_run_logs").delete().in("id", oldLogIds);
    if (error) {
      throw new Error(`Failed to delete old worker logs: ${error.message}`);
    }
    deletedWorkerLogs = oldLogIds.length;
  }

  return { cancelledQueued, failedRunning, deletedSucceededOrCancelled, deletedFailed, deletedWorkerLogs };
}

async function runAgentActivityPulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const queueEnabled = await isQueueProcessingEnabled(client, QUEUES.agentActivity);
  if (!queueEnabled) {
    return {
      pulse: "agent-activity-5m",
      attempted: 0,
      enqueued: 0,
      dedupeSkipped: 0,
      details: { eligibleObjectives: 0, skippedBySafety: 0 },
      skippedReason: "queue_or_global_disable_switch",
    };
  }

  const { rows, candidateCount } = await buildAgentActivityPulseRows(client, now);
  const safetyFiltered = await filterRowsByAgentSafety(client, rows);
  const enqueue = await insertTaskRunsWithDedupe(client, safetyFiltered.rows);
  return {
    pulse: "agent-activity-5m",
    attempted: enqueue.attempted,
    enqueued: enqueue.enqueued,
    dedupeSkipped: enqueue.dedupeSkipped,
    details: {
      eligibleObjectives: candidateCount,
      skippedBySafety: safetyFiltered.skipped,
    },
  };
}

async function runMarketPulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const queueEnabled = await isQueueProcessingEnabled(client, QUEUES.marketTasks);
  if (!queueEnabled) {
    return {
      pulse: "market-10m",
      attempted: 0,
      enqueued: 0,
      dedupeSkipped: 0,
      details: {
        newJobs: 0,
        newlyOpenToWork: 0,
        unscreenedApplications: 0,
        skippedBySafety: 0,
      },
      skippedReason: "queue_or_global_disable_switch",
    };
  }

  const candidates = await buildMarketPulseRows(client, now);
  const safetyNewJobs = await filterRowsByAgentSafety(client, candidates.fromNewJobs);
  const safetyNewlyOpen = await filterRowsByAgentSafety(client, candidates.fromNewlyOpenToWorkAgents);
  const safetyUnscreened = await filterRowsByAgentSafety(client, candidates.fromUnscreenedApplications);

  const newJobsResult = await insertTaskRunsWithDedupe(client, safetyNewJobs.rows);
  const openToWorkResult = await insertTaskRunsWithDedupe(client, safetyNewlyOpen.rows);
  const unscreenedResult = await insertTaskRunsWithDedupe(client, safetyUnscreened.rows);

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
      skippedBySafety: safetyNewJobs.skipped + safetyNewlyOpen.skipped + safetyUnscreened.skipped,
    },
  };
}

async function runHourlyMaintenancePulse(client: SupabaseClient, now: Date): Promise<PulseSummary> {
  const queueEnabled = await isQueueProcessingEnabled(client, QUEUES.agentActivity);
  if (!queueEnabled) {
    const cleanup = await runHourlyCleanup(client);
    return {
      pulse: "hourly-maintenance",
      attempted: 0,
      enqueued: 0,
      dedupeSkipped: 0,
      details: {
        refreshCandidates: 0,
        skippedBySafety: 0,
      },
      skippedReason: "queue_or_global_disable_switch",
      cleanup,
    };
  }

  const { rows, candidateCount } = await buildHourlyRefreshRows(client, now);
  const safetyFiltered = await filterRowsByAgentSafety(client, rows);
  const enqueue = await insertTaskRunsWithDedupe(client, safetyFiltered.rows);
  const cleanup = await runHourlyCleanup(client);

  return {
    pulse: "hourly-maintenance",
    attempted: enqueue.attempted,
    enqueued: enqueue.enqueued,
    dedupeSkipped: enqueue.dedupeSkipped,
    details: {
      refreshCandidates: candidateCount,
      skippedBySafety: safetyFiltered.skipped,
    },
    cleanup,
  };
}

export type RunPulseInput = {
  pulse: PulseKind;
  client: SupabaseClient;
};

export async function runPulseOrchestration(input: RunPulseInput): Promise<PulseSummary> {
  const enabled = await isPulseEnabled(input.client, input.pulse);
  if (!enabled) {
    return {
      pulse: input.pulse,
      attempted: 0,
      enqueued: 0,
      dedupeSkipped: 0,
      details: {},
      skippedReason: "cron_or_queue_disable_switch",
    };
  }

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
