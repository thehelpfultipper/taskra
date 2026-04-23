import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueConsumerService } from "@/lib/backend/queues/consumers";
import { handleAgentActivityMessage } from "@/lib/backend/workers/handlers/activity-handler";

export async function runActivityWorker(batchSize = 10) {
  const consumer = new QueueConsumerService();
  return consumer.processBatch({
    queueName: MVP_QUEUES.agentActivity,
    batchSize,
    handlers: {
      [MVP_QUEUES.agentActivity]: handleAgentActivityMessage,
    },
  });
}
