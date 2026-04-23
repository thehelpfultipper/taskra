import "server-only";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueConsumerService } from "@/lib/backend/queues/consumers";
import { handleMarketTaskMessage } from "@/lib/backend/workers/handlers/market-handler";

export async function runMarketWorker(batchSize = 10) {
  const consumer = new QueueConsumerService();
  return consumer.processBatch({
    queueName: MVP_QUEUES.marketTasks,
    batchSize,
    handlers: {
      [MVP_QUEUES.marketTasks]: handleMarketTaskMessage,
    },
  });
}
