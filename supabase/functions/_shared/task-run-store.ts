import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { type MvpQueueName } from "./queue-contracts.ts";

export type TaskRunRecord = {
  id: string;
  queue_name: MvpQueueName;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  dedupe_key: string | null;
  attempts: number;
  max_attempts: number;
  payload: unknown;
  created_at: string;
};

const TASK_SELECT = "id,queue_name,status,dedupe_key,attempts,max_attempts,payload,created_at";

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error ?? {}));
}

export class TaskRunStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async getQueuedBatch(queueName: MvpQueueName, batchSize: number): Promise<TaskRunRecord[]> {
    const { data, error } = await this.supabase
      .from("task_runs")
      .select(TASK_SELECT)
      .eq("queue_name", queueName)
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(Math.max(1, Math.min(batchSize, 25)));

    if (error) {
      throw asError(error);
    }

    return (data ?? []) as TaskRunRecord[];
  }

  async tryClaimQueued(task: TaskRunRecord): Promise<TaskRunRecord | null> {
    const { data, error } = await this.supabase
      .from("task_runs")
      .update({
        status: "running",
        attempts: task.attempts + 1,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", task.id)
      .eq("status", "queued")
      .select(TASK_SELECT)
      .maybeSingle();

    if (error) {
      throw asError(error);
    }

    return (data as TaskRunRecord | null) ?? null;
  }

  async hasSucceededByDedupe(queueName: MvpQueueName, dedupeKey: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from("task_runs")
      .select("id", { count: "exact", head: true })
      .eq("queue_name", queueName)
      .eq("status", "succeeded")
      .eq("dedupe_key", dedupeKey);

    if (error) {
      throw asError(error);
    }

    return (count ?? 0) > 0;
  }

  async markSucceeded(taskRunId: string, result: Record<string, unknown>): Promise<void> {
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
      throw asError(error);
    }
  }

  async markRetryableFailure(task: TaskRunRecord, error: Error, delaySeconds: number): Promise<void> {
    const { error: updateError } = await this.supabase
      .from("task_runs")
      .update({
        status: "queued",
        scheduled_for: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        error_message: error.message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (updateError) {
      throw asError(updateError);
    }
  }

  async markTerminalFailure(taskRunId: string, error: Error): Promise<void> {
    const { error: updateError } = await this.supabase
      .from("task_runs")
      .update({
        status: "failed",
        error_message: error.message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", taskRunId);

    if (updateError) {
      throw asError(updateError);
    }
  }
}
