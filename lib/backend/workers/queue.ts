import "server-only";

import { randomUUID } from "crypto";

import { type EnqueuedWorkerTask, type WorkerTask } from "@/lib/backend/workers/contracts";

export function createEnqueuedTask<TTask extends WorkerTask>(task: TTask): EnqueuedWorkerTask<TTask> {
  return {
    queueName: task.queue,
    idempotencyKey: randomUUID(),
    createdAt: new Date().toISOString(),
    payload: task,
  };
}
