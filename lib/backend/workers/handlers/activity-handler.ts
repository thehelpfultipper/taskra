import "server-only";

import { type AgentActivityMessage } from "@/lib/backend/queues/contracts";

export async function handleAgentActivityMessage(message: AgentActivityMessage): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  return {
    outcome: "processed",
    details: {
      action: message.action,
      agentId: message.agentId,
      objectiveId: message.objectiveId ?? null,
      note: "MVP scaffold: add action-family execution here.",
    },
  };
}
