import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import {
  createQueueMessage,
  type AgentActivityMessage,
  type ContentTaskMessage,
  type MarketTaskMessage,
  type NewQueueMessage,
  type NotificationMessage,
} from "@/lib/backend/queues/contracts";
import { TaskRunStore, type TaskRunRecord } from "@/lib/backend/queues/task-run-store";

type QueueProducerResult<TMessage> = {
  taskRun: TaskRunRecord;
  message: TMessage;
};

function deriveDedupeKey(message: { dedupeKey?: string; idempotencyKey: string }): string {
  return message.dedupeKey ?? message.idempotencyKey;
}

export class QueueProducerService {
  constructor(private readonly store = new TaskRunStore()) {}

  async enqueueAgentActivity(
    input: NewQueueMessage<typeof MVP_QUEUES.agentActivity>,
  ): Promise<QueueProducerResult<AgentActivityMessage>> {
    const message = createQueueMessage<typeof MVP_QUEUES.agentActivity>({
      ...input,
      queue: MVP_QUEUES.agentActivity,
    });

    const taskRun = await this.store.enqueue({
      queueName: MVP_QUEUES.agentActivity,
      dedupeKey: deriveDedupeKey(message),
      payload: message,
      agentId: message.agentId,
      objectiveId: message.objectiveId,
    });
    return { taskRun, message };
  }

  async enqueueContentTask(
    input: NewQueueMessage<typeof MVP_QUEUES.contentTasks>,
  ): Promise<QueueProducerResult<ContentTaskMessage>> {
    const message = createQueueMessage<typeof MVP_QUEUES.contentTasks>({
      ...input,
      queue: MVP_QUEUES.contentTasks,
    });

    const taskRun = await this.store.enqueue({
      queueName: MVP_QUEUES.contentTasks,
      dedupeKey: deriveDedupeKey(message),
      payload: message,
      agentId: message.agentId,
    });
    return { taskRun, message };
  }

  async enqueueMarketTask(
    input: NewQueueMessage<typeof MVP_QUEUES.marketTasks>,
  ): Promise<QueueProducerResult<MarketTaskMessage>> {
    const message = createQueueMessage<typeof MVP_QUEUES.marketTasks>({
      ...input,
      queue: MVP_QUEUES.marketTasks,
    });

    const taskRun = await this.store.enqueue({
      queueName: MVP_QUEUES.marketTasks,
      dedupeKey: deriveDedupeKey(message),
      payload: message,
      agentId: message.agentId,
    });
    return { taskRun, message };
  }

  async enqueueNotification(
    input: NewQueueMessage<typeof MVP_QUEUES.notifications>,
  ): Promise<QueueProducerResult<NotificationMessage>> {
    const message = createQueueMessage<typeof MVP_QUEUES.notifications>({
      ...input,
      queue: MVP_QUEUES.notifications,
    });

    const taskRun = await this.store.enqueue({
      queueName: MVP_QUEUES.notifications,
      dedupeKey: deriveDedupeKey(message),
      payload: message,
      agentId: message.actorAgentId,
    });
    return { taskRun, message };
  }
}
