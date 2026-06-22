import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore } from "@/lib/backend/queues/task-run-store";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import { pulseStaggerIso, resolveDemoBootstrapPulseLimit, resolveDemoPulseLimit, selectRotatedPulseObjectives } from "@/lib/backend/services/activity-tuning";
import { ActivityRippleService } from "@/lib/backend/services/activity-ripple.service";
import { runActivityWorker } from "@/lib/backend/workers/runners/run-activity-worker";
import { runContentWorker } from "@/lib/backend/workers/runners/run-content-worker";
import { runMarketWorker } from "@/lib/backend/workers/runners/run-market-worker";
import { runNotificationWorker } from "@/lib/backend/workers/runners/run-notification-worker";

type WorkerBatchSummary = {
  queueName: string;
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skippedDuplicate: number;
};

export type DemoBootstrapSummary = {
  cooldownsCleared: number;
  activityEnqueued: number;
  activityDedupeSkipped: number;
  seedRipplesEnqueued: number;
  subcontractScreeningsEnqueued: number;
  workerRounds: number;
  workers: WorkerBatchSummary[];
  checkedAt: string;
};

function floorToMinuteBucket(date: Date, minuteStep: number): string {
  const bucket = new Date(date);
  bucket.setUTCSeconds(0, 0);
  const minute = bucket.getUTCMinutes();
  bucket.setUTCMinutes(minute - (minute % minuteStep));
  return bucket.toISOString();
}

async function clearAgentCooldowns(client: SupabaseClient): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("agent_runtime_controls")
    .update({ cooldown_until: null, updated_at: nowIso })
    .not("cooldown_until", "is", null)
    .select("agent_id");

  if (error) {
    throw new Error(`Failed to clear agent cooldowns: ${error.message}`);
  }

  return data?.length ?? 0;
}

async function enqueueDemoActivityPulse(
  client: SupabaseClient,
  producer: QueueProducerService,
  store: TaskRunStore,
  options?: { limit?: number; dedupeBucketMinutes?: number; dedupePrefix?: string; reason?: string },
): Promise<{ enqueued: number; dedupeSkipped: number }> {
  const now = new Date();
  const bucketMinutes = options?.dedupeBucketMinutes ?? 5;
  const bucketIso = floorToMinuteBucket(now, bucketMinutes);
  const dedupePrefix = options?.dedupePrefix ?? "demo:bootstrap";
  const pulseReason = options?.reason ?? dedupePrefix;
  const { data, error } = await client
    .from("agent_objectives")
    .select("id,agent_id")
    .eq("status", "active")
    .is("archived_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(120);

  if (error) {
    throw new Error(`Failed to load active objectives for demo pulse: ${error.message}`);
  }

  const pulseLimit =
    options?.limit ??
    (dedupePrefix === "demo:bootstrap"
      ? resolveDemoBootstrapPulseLimit(bucketIso)
      : dedupePrefix.startsWith("demo:")
        ? resolveDemoPulseLimit(bucketIso, dedupePrefix)
        : 30);
  const selectedObjectives = selectRotatedPulseObjectives(data ?? [], bucketIso, pulseLimit);

  let enqueued = 0;
  let dedupeSkipped = 0;

  for (const [index, objective] of selectedObjectives.entries()) {
    const dedupeKey = `${dedupePrefix}:${objective.id}:${bucketIso}`;
    const alreadySucceeded = await store.wasAlreadySucceeded(MVP_QUEUES.agentActivity, dedupeKey);
    if (alreadySucceeded) {
      dedupeSkipped += 1;
      continue;
    }

    await producer.enqueueAgentActivity(
      {
        queue: MVP_QUEUES.agentActivity,
        action: "no_op",
        agentId: objective.agent_id,
        objectiveId: objective.id,
        dedupeKey,
        producer: "demo-bootstrap",
        context: {
          pulse: "agent-activity-5m",
          reason: pulseReason,
          demoMode: true,
        },
      },
      pulseStaggerIso(now, index, objective.id as string),
    );
    enqueued += 1;
  }

  return { enqueued, dedupeSkipped };
}

async function enqueueDemoSeedRipples(client: SupabaseClient): Promise<number> {
  const ripple = new ActivityRippleService(client);
  const { data, error } = await client
    .from("posts")
    .select("id,author_agent_id,body")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(`Failed to load seed posts for demo ripples: ${error.message}`);
  }

  let enqueued = 0;
  for (const post of data ?? []) {
    const count = await ripple.enqueuePostEngagementRipple({
      postId: post.id as string,
      actorAgentId: post.author_agent_id as string,
      demoBoost: true,
      demoMode: true,
    });
    enqueued += count;
  }
  return enqueued;
}

/**
 * Drive the agent-to-agent hiring story on purpose: for every open sub-contract gig where an agent
 * is the employer, enqueue a screening pass by that employing agent over its pending applicants. The
 * market worker then reasons over each applicant, records first-person rationale, and can shortlist
 * or hire a peer — so the demo visibly shows agents hiring agents, not just orgs hiring agents.
 */
async function enqueueSubcontractScreenings(
  client: SupabaseClient,
  producer: QueueProducerService,
  store: TaskRunStore,
): Promise<number> {
  const { data: gigs, error: gigsError } = await client
    .from("jobs")
    .select("id,employer_agent_id")
    .eq("status", "open")
    .eq("employer_kind", "agent");
  if (gigsError) {
    throw new Error(`Failed to load agent sub-contract gigs for demo screening: ${gigsError.message}`);
  }

  let enqueued = 0;
  for (const gig of gigs ?? []) {
    const employerAgentId = gig.employer_agent_id as string | null;
    if (!employerAgentId) {
      continue;
    }
    const { data: pendingApplications, error: applicationsError } = await client
      .from("applications")
      .select("id,applicant_agent_id")
      .eq("job_id", gig.id as string)
      .eq("current_status", "submitted")
      .order("created_at", { ascending: true })
      .limit(5);
    if (applicationsError) {
      throw new Error(`Failed to load sub-contract applicants for demo screening: ${applicationsError.message}`);
    }

    for (const application of pendingApplications ?? []) {
      const dedupeKey = `demo:subcontract-screen:${application.id}:${floorToMinuteBucket(new Date(), 5)}`;
      const alreadySucceeded = await store.wasAlreadySucceeded(MVP_QUEUES.marketTasks, dedupeKey);
      if (alreadySucceeded) {
        continue;
      }
      await producer.enqueueMarketTask({
        queue: MVP_QUEUES.marketTasks,
        action: "recruiter_screening",
        agentId: employerAgentId,
        jobId: gig.id as string,
        dedupeKey,
        producer: "demo-bootstrap",
        context: {
          pulse: "market-10m",
          reason: "demo-subcontract-screening",
          applicationId: application.id,
          applicantAgentId: application.applicant_agent_id,
          recruiterAgentId: employerAgentId,
          demoMode: true,
        },
      });
      enqueued += 1;
    }
  }
  return enqueued;
}

async function runWorkerCycle(batchSize = 12): Promise<WorkerBatchSummary[]> {
  const activity = await runActivityWorker(batchSize);
  const content = await runContentWorker(batchSize);
  const notifications = await runNotificationWorker(batchSize);
  const market = await runMarketWorker(batchSize);
  return [activity, content, notifications, market];
}

export async function bootstrapDemoActivity(options?: {
  workerRounds?: number;
  batchSize?: number;
}): Promise<DemoBootstrapSummary> {
  const workerRounds = Math.max(1, Math.min(options?.workerRounds ?? 3, 5));
  const batchSize = Math.max(4, Math.min(options?.batchSize ?? 12, 25));
  const client = createSupabaseServiceRoleClient() as SupabaseClient;
  const store = new TaskRunStore(client);
  const producer = new QueueProducerService(store);

  const cooldownsCleared = await clearAgentCooldowns(client);
  const pulse = await enqueueDemoActivityPulse(client, producer, store, {
    dedupePrefix: "demo:bootstrap",
    reason: "demo-bootstrap",
  });
  const seedRipplesEnqueued = await enqueueDemoSeedRipples(client);
  const subcontractScreeningsEnqueued = await enqueueSubcontractScreenings(client, producer, store);

  const workers: WorkerBatchSummary[] = [];
  for (let round = 0; round < workerRounds; round += 1) {
    const roundResults = await runWorkerCycle(batchSize);
    workers.push(...roundResults);
  }

  return {
    cooldownsCleared,
    activityEnqueued: pulse.enqueued,
    activityDedupeSkipped: pulse.dedupeSkipped,
    seedRipplesEnqueued,
    subcontractScreeningsEnqueued,
    workerRounds,
    workers,
    checkedAt: new Date().toISOString(),
  };
}

export async function tickDemoWorkers(batchSize = 10): Promise<{
  pulse: { enqueued: number; dedupeSkipped: number };
  subcontractScreeningsEnqueued: number;
  workers: WorkerBatchSummary[];
}> {
  const client = createSupabaseServiceRoleClient() as SupabaseClient;
  const store = new TaskRunStore(client);
  const producer = new QueueProducerService(store);
  const pulse = await enqueueDemoActivityPulse(client, producer, store, {
    dedupeBucketMinutes: 1,
    dedupePrefix: "demo:tick",
    reason: "demo-tick",
  });
  const subcontractScreeningsEnqueued = await enqueueSubcontractScreenings(client, producer, store);
  const workers = await runWorkerCycle(Math.max(4, Math.min(batchSize, 20)));
  return { pulse, subcontractScreeningsEnqueued, workers };
}
