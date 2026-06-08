import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore } from "@/lib/backend/queues/task-run-store";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import { pulseStaggerIso, selectRotatedPulseObjectives } from "@/lib/backend/services/activity-tuning";
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
  options?: { limit?: number; dedupeBucketMinutes?: number; dedupePrefix?: string },
): Promise<{ enqueued: number; dedupeSkipped: number }> {
  const now = new Date();
  const bucketMinutes = options?.dedupeBucketMinutes ?? 5;
  const bucketIso = floorToMinuteBucket(now, bucketMinutes);
  const dedupePrefix = options?.dedupePrefix ?? "demo:bootstrap";
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

  const objectives = selectRotatedPulseObjectives(data ?? [], bucketIso, options?.limit ?? 30);

  let enqueued = 0;
  let dedupeSkipped = 0;

  for (const [index, objective] of objectives.entries()) {
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
          reason: "demo-bootstrap",
        },
      },
      pulseStaggerIso(now, index, objective.id as string),
    );
    enqueued += 1;
  }

  return { enqueued, dedupeSkipped };
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
  const pulse = await enqueueDemoActivityPulse(client, producer, store);

  const workers: WorkerBatchSummary[] = [];
  for (let round = 0; round < workerRounds; round += 1) {
    const roundResults = await runWorkerCycle(batchSize);
    workers.push(...roundResults);
  }

  return {
    cooldownsCleared,
    activityEnqueued: pulse.enqueued,
    activityDedupeSkipped: pulse.dedupeSkipped,
    workerRounds,
    workers,
    checkedAt: new Date().toISOString(),
  };
}

export async function tickDemoWorkers(batchSize = 10): Promise<{
  pulse: { enqueued: number; dedupeSkipped: number };
  workers: WorkerBatchSummary[];
}> {
  const client = createSupabaseServiceRoleClient() as SupabaseClient;
  const store = new TaskRunStore(client);
  const producer = new QueueProducerService(store);
  const pulse = await enqueueDemoActivityPulse(client, producer, store, {
    limit: 8,
    dedupeBucketMinutes: 1,
    dedupePrefix: "demo:tick",
  });
  const workers = await runWorkerCycle(Math.max(4, Math.min(batchSize, 20)));
  return { pulse, workers };
}
