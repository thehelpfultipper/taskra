import {
  parseQueueMessage,
  type MvpQueueName,
  type QueueMessageByName,
} from "./queue-contracts.ts";
import { getServiceRoleClient } from "./supabase-client.ts";
import { TaskRunStore } from "./task-run-store.ts";

export type WorkerResult = {
  queueName: MvpQueueName;
  requestedBatchSize: number;
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  skippedDuplicate: number;
};

type WorkerHandlerMap = {
  [K in MvpQueueName]: (
    message: QueueMessageByName[K],
    context: { taskRunId: string },
  ) => Promise<Record<string, unknown>>;
};

type RunWorkerInput<TQueue extends MvpQueueName> = {
  queueName: TQueue;
  defaultBatchSize?: number;
  maxBatchSize?: number;
  handler: WorkerHandlerMap[TQueue];
  request: Request;
};

function safeJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getRequestedBatchSize(request: Request, fallback: number, maxBatchSize: number): number {
  const url = new URL(request.url);
  const fromQuery = Number(url.searchParams.get("batchSize") ?? NaN);
  if (!Number.isNaN(fromQuery) && fromQuery > 0) {
    return Math.min(maxBatchSize, Math.max(1, Math.floor(fromQuery)));
  }

  return fallback;
}

function retryDelaySeconds(attempt: number): number {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  return 15 * 2 ** (boundedAttempt - 1);
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error ?? {}));
}

export async function runQueueWorker<TQueue extends MvpQueueName>(
  input: RunWorkerInput<TQueue>,
): Promise<Response> {
  const defaultBatchSize = Math.max(1, Math.min(input.defaultBatchSize ?? 10, 25));
  const maxBatchSize = Math.max(defaultBatchSize, Math.min(input.maxBatchSize ?? 25, 25));
  const requestedBatchSize = getRequestedBatchSize(input.request, defaultBatchSize, maxBatchSize);
  const store = new TaskRunStore(getServiceRoleClient());
  const queuedTasks = await store.getQueuedBatch(input.queueName, requestedBatchSize);

  const result: WorkerResult = {
    queueName: input.queueName,
    requestedBatchSize,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    failed: 0,
    skippedDuplicate: 0,
  };

  for (const queuedTask of queuedTasks) {
    const claimed = await store.tryClaimQueued(queuedTask);
    if (!claimed) {
      continue;
    }

    result.claimed += 1;

    try {
      const parsedMessage = parseQueueMessage(claimed.payload);
      if (parsedMessage.queue !== input.queueName) {
        throw new Error(`Queue mismatch for task ${claimed.id}.`);
      }

      if (parsedMessage.dedupeKey) {
        const alreadySucceeded = await store.hasSucceededByDedupe(
          input.queueName,
          parsedMessage.dedupeKey,
        );
        if (alreadySucceeded) {
          result.succeeded += 1;
          result.skippedDuplicate += 1;
          await store.markSucceeded(claimed.id, {
            outcome: "skipped_duplicate",
            dedupeKey: parsedMessage.dedupeKey,
          });
          continue;
        }
      }

      const handlerResult = await input.handler(parsedMessage as QueueMessageByName[TQueue], {
        taskRunId: claimed.id,
      });
      result.succeeded += 1;
      await store.markSucceeded(claimed.id, {
        outcome: "processed",
        ...safeJson(handlerResult),
      });
    } catch (error) {
      const parsedError = toError(error);
      const shouldRetry = claimed.attempts < claimed.max_attempts;
      if (shouldRetry) {
        result.retried += 1;
        await store.markRetryableFailure(claimed, parsedError, retryDelaySeconds(claimed.attempts));
      } else {
        result.failed += 1;
        await store.markTerminalFailure(claimed.id, parsedError);
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status: 200,
  });
}
