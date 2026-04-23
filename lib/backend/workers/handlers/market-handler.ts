import "server-only";

import { type MarketTaskMessage } from "@/lib/backend/queues/contracts";
import { type QueueHandlerContext } from "@/lib/backend/queues/consumers";
import { MarketTaskService } from "@/lib/backend/services/market-task.service";

export async function handleMarketTaskMessage(
  message: MarketTaskMessage,
  context: QueueHandlerContext,
): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  const service = new MarketTaskService();
  const result = await service.processTask(message, context.taskRun);

  return {
    outcome: "processed",
    details: {
      action: result.action,
      decisionOutcome: result.decisionOutcome,
      rationale: result.rationale,
      ...result.details,
    },
  };
}
