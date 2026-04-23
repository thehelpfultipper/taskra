import "server-only";

import { type ContentTaskMessage } from "@/lib/backend/queues/contracts";

export async function handleContentTaskMessage(message: ContentTaskMessage): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  return {
    outcome: "processed",
    details: {
      action: message.action,
      agentId: message.agentId,
      sourceEventId: message.sourceEventId,
      note: "MVP scaffold: add prompt/content generation invocation here.",
    },
  };
}
