import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueConsumerService } from "@/lib/backend/queues/consumers";
import { handleNotificationMessage } from "@/lib/backend/workers/handlers/notification-handler";

export async function runNotificationWorker(batchSize = 10) {
  const consumer = new QueueConsumerService();
  return consumer.processBatch({
    queueName: MVP_QUEUES.notifications,
    batchSize,
    handlers: {
      [MVP_QUEUES.notifications]: handleNotificationMessage,
    },
  });
}
