import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES, type MvpQueueName } from "@/lib/backend/database/schema";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

export const TASK_RUN_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];

export type TaskRunRecord = {
  id: string;
  queue_name: MvpQueueName;
  status: TaskRunStatus;
  agent_id: string | null;
  objective_id: string | null;
  dedupe_key: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  payload: unknown;
  result: unknown;
  created_at: string;
  updated_at: string;
};

export type EnqueueTaskRunInput = {
  queueName: MvpQueueName;
  agentId?: string;
  objectiveId?: string;
  dedupeKey?: string;
  payload: unknown;
  maxAttempts?: number;
  scheduledFor?: string;
};

const TASK_RUN_SELECT = [
  "id",
  "queue_name",
  "status",
  "agent_id",
  "objective_id",
  "dedupe_key",
  "attempts",
  "max_attempts",
  "scheduled_for",
  "started_at",
  "finished_at",
  "error_message",
  "payload",
  "result",
  "created_at",
  "updated_at",
].join(",");

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const details = typeof error === "object" && error ? JSON.stringify(error) : String(error ?? "");
  return new Error(details || fallback);
}

export class TaskRunStore {
  private readonly supabase: SupabaseClient<any>;

  constructor(client?: SupabaseClient<any>) {
    this.supabase = (client ?? createSupabaseServiceRoleClient()) as SupabaseClient<any>;
  }

  async enqueue(input: EnqueueTaskRunInput): Promise<TaskRunRecord> {
    const { data, error } = await this.supabase
      .from("task_runs")
      .insert({
        queue_name: input.queueName,
        status: "queued",
        agent_id: input.agentId ?? null,
        objective_id: input.objectiveId ?? null,
        dedupe_key: input.dedupeKey ?? null,
        payload: input.payload,
        max_attempts: input.maxAttempts ?? 3,
        scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      })
      .select(TASK_RUN_SELECT)
      .single();

    if (error) {
      throw normalizeError(error, "Failed to enqueue task run.");
    }

    return data as unknown as TaskRunRecord;
  }

  async getQueuedBatch(queueName: MvpQueueName, batchSize: number): Promise<TaskRunRecord[]> {
    const { data, error } = await this.supabase
      .from("task_runs")
      .select(TASK_RUN_SELECT)
      .eq("queue_name", queueName)
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(Math.max(1, Math.min(batchSize, 25)));

    if (error) {
      throw normalizeError(error, `Failed to fetch queued tasks for ${queueName}.`);
    }

    return (data ?? []) as unknown as TaskRunRecord[];
  }

  async wasAlreadySucceeded(queueName: MvpQueueName, dedupeKey: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from("task_runs")
      .select("id", { count: "exact", head: true })
      .eq("queue_name", queueName)
      .eq("status", "succeeded")
      .eq("dedupe_key", dedupeKey);

    if (error) {
      throw normalizeError(error, `Failed to check dedupe state for ${queueName}.`);
    }

    return (count ?? 0) > 0;
  }

  async tryClaimQueuedTask(task: TaskRunRecord): Promise<TaskRunRecord | null> {
    const nextAttempt = task.attempts + 1;
    const { data, error } = await this.supabase
      .from("task_runs")
      .update({
        status: "running",
        attempts: nextAttempt,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", task.id)
      .eq("status", "queued")
      .select(TASK_RUN_SELECT)
      .maybeSingle();

    if (error) {
      throw normalizeError(error, `Failed to claim task ${task.id}.`);
    }

    return (data as unknown as TaskRunRecord | null) ?? null;
  }

  async markSucceeded(taskRunId: string, result: unknown): Promise<void> {
    const { error } = await this.supabase
      .from("task_runs")
      .update({
        status: "succeeded",
        result,
        error_message: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", taskRunId);

    if (error) {
      throw normalizeError(error, `Failed to mark task ${taskRunId} as succeeded.`);
    }
  }

  async markRetryableFailure(task: TaskRunRecord, failure: Error, delaySeconds: number): Promise<void> {
    const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const { error } = await this.supabase
      .from("task_runs")
      .update({
        status: "queued",
        scheduled_for: scheduledFor,
        error_message: failure.message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      throw normalizeError(error, `Failed to mark task ${task.id} for retry.`);
    }
  }

  async markTerminalFailure(taskRunId: string, failure: Error): Promise<void> {
    const { error } = await this.supabase
      .from("task_runs")
      .update({
        status: "failed",
        error_message: failure.message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", taskRunId);

    if (error) {
      throw normalizeError(error, `Failed to mark task ${taskRunId} as failed.`);
    }
  }
}

export function isMvpQueueName(queueName: string): queueName is MvpQueueName {
  return (Object.values(MVP_QUEUES) as string[]).includes(queueName);
}
