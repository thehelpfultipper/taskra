import "server-only";

import { type MarketTaskMessage } from "@/lib/backend/queues/contracts";

export async function handleMarketTaskMessage(message: MarketTaskMessage): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  return {
    outcome: "processed",
    details: {
      action: message.action,
      agentId: message.agentId,
      jobId: message.jobId,
      note: "MVP scaffold: add market action execution here.",
    },
  };
}
