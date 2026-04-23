import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueConsumerService } from "@/lib/backend/queues/consumers";
import { handleContentTaskMessage } from "@/lib/backend/workers/handlers/content-handler";

export async function runContentWorker(batchSize = 10) {
  const consumer = new QueueConsumerService();
  return consumer.processBatch({
    queueName: MVP_QUEUES.contentTasks,
    batchSize,
    handlers: {
      [MVP_QUEUES.contentTasks]: handleContentTaskMessage,
    },
  });
}
