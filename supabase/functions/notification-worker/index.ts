import { handleNotification } from "./_shared/handlers.ts";
import { MVP_QUEUE_NAMES } from "./_shared/queue-contracts.ts";
import { runQueueWorker } from "./_shared/worker-runtime.ts";

Deno.serve(async (request: Request) =>
  runQueueWorker({
    request,
    queueName: MVP_QUEUE_NAMES.notifications,
    defaultBatchSize: 8,
    maxBatchSize: 20,
    handler: handleNotification,
  }),
);
