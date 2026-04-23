import "server-only";

import { type MvpQueueName } from "@/lib/backend/database/schema";
import { parseQueueMessage, type QueueMessageByName } from "@/lib/backend/queues/contracts";
import { TaskRunStore, type TaskRunRecord } from "@/lib/backend/queues/task-run-store";

export type QueueHandlerContext = {
  taskRun: TaskRunRecord;
};

export type QueueHandlerResult = {
  outcome: "processed" | "skipped_duplicate";
  details?: Record<string, unknown>;
};

export type QueueBatchResult = {
  queueName: MvpQueueName;
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skippedDuplicate: number;
};

type QueueHandlerMap = {
  [K in MvpQueueName]: (
    message: QueueMessageByName[K],
    context: QueueHandlerContext,
  ) => Promise<QueueHandlerResult>;
};

export type ProcessQueueBatchInput<TQueue extends MvpQueueName> = {
  queueName: TQueue;
  batchSize?: number;
  handlers: Pick<QueueHandlerMap, TQueue>;
};

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = typeof error === "string" ? error : JSON.stringify(error ?? {});
  return new Error(message || "Unknown queue processing error.");
}

function retryDelaySeconds(attempt: number): number {
  const boundedAttempt = Math.max(1, Math.min(attempt, 6));
  return 15 * 2 ** (boundedAttempt - 1);
}

export class QueueConsumerService {
  constructor(private readonly store = new TaskRunStore()) {}

  async processBatch<TQueue extends MvpQueueName>(
    input: ProcessQueueBatchInput<TQueue>,
  ): Promise<QueueBatchResult> {
    const queueName = input.queueName;
    const batchSize = Math.max(1, Math.min(input.batchSize ?? 10, 25));
    const queuedTasks = await this.store.getQueuedBatch(queueName, batchSize);

    const result: QueueBatchResult = {
      queueName,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      skippedDuplicate: 0,
    };

    for (const queuedTask of queuedTasks) {
      const claimedTask = await this.store.tryClaimQueuedTask(queuedTask);
      if (!claimedTask) {
        continue;
      }

      result.claimed += 1;

      try {
        const parsedMessage = parseQueueMessage(claimedTask.payload);
        if (parsedMessage.queue !== queueName) {
          throw new Error(`Task ${claimedTask.id} queue mismatch for ${queueName}.`);
        }

        if (parsedMessage.dedupeKey) {
          const duplicate = await this.store.wasAlreadySucceeded(queueName, parsedMessage.dedupeKey);
          if (duplicate) {
            result.succeeded += 1;
            result.skippedDuplicate += 1;
            await this.store.markSucceeded(claimedTask.id, {
              outcome: "skipped_duplicate",
              dedupeKey: parsedMessage.dedupeKey,
            });
            continue;
          }
        }

        const handler = input.handlers[queueName] as (
          message: QueueMessageByName[TQueue],
          context: QueueHandlerContext,
        ) => Promise<QueueHandlerResult>;
        const handlerResult = await handler(parsedMessage as QueueMessageByName[TQueue], {
          taskRun: claimedTask,
        });

        result.succeeded += 1;
        if (handlerResult.outcome === "skipped_duplicate") {
          result.skippedDuplicate += 1;
        }

        await this.store.markSucceeded(claimedTask.id, {
          queue: queueName,
          ...handlerResult,
        });
      } catch (error) {
        const parsedError = toError(error);
        const shouldRetry = claimedTask.attempts < claimedTask.max_attempts;
        if (shouldRetry) {
          result.retried += 1;
          await this.store.markRetryableFailure(
            claimedTask,
            parsedError,
            retryDelaySeconds(claimedTask.attempts),
          );
        } else {
          result.failed += 1;
          await this.store.markTerminalFailure(claimedTask.id, parsedError);
        }
      }
    }

    return result;
  }
}
