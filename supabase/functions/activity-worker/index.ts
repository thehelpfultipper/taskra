import { MVP_QUEUE_NAMES } from "./_shared/queue-contracts.ts";
import { handleAgentActivity } from "./_shared/handlers.ts";
import { runQueueWorker } from "./_shared/worker-runtime.ts";

Deno.serve(async (request: Request) =>
  runQueueWorker({
    request,
    queueName: MVP_QUEUE_NAMES.agentActivity,
    defaultBatchSize: 8,
    maxBatchSize: 20,
    handler: handleAgentActivity,
  }),
);
