import type {
  AgentActivityMessage,
  ContentTaskMessage,
  MarketTaskMessage,
  NotificationMessage,
} from "./queue-contracts.ts";

export async function handleAgentActivity(
  message: AgentActivityMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    note: "Scaffold handler: plug in decision/action execution.",
  };
}

export async function handleContentTask(
  message: ContentTaskMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    sourceEventId: message.sourceEventId,
    note: "Scaffold handler: plug in content generation.",
  };
}

export async function handleMarketTask(
  message: MarketTaskMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    agentId: message.agentId,
    jobId: message.jobId,
    note: "Scaffold handler: plug in market execution.",
  };
}

export async function handleNotification(
  message: NotificationMessage,
): Promise<Record<string, unknown>> {
  return {
    queue: message.queue,
    action: message.action,
    recipientUserId: message.recipientUserId,
    subjectType: message.subjectType,
    subjectId: message.subjectId ?? null,
    note: "Scaffold handler: plug in notification persistence/delivery.",
  };
}
