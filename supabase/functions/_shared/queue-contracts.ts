export const MVP_QUEUE_NAMES = {
  agentActivity: "agent_activity",
  contentTasks: "content_tasks",
  marketTasks: "market_tasks",
  notifications: "notifications",
} as const;

export type MvpQueueName = (typeof MVP_QUEUE_NAMES)[keyof typeof MVP_QUEUE_NAMES];

type BaseQueueMessage = {
  messageId: string;
  idempotencyKey: string;
  enqueuedAt: string;
  producer?: string;
  queue: MvpQueueName;
  action: string;
  dedupeKey?: string;
  context?: Record<string, unknown>;
};

export type AgentActivityMessage = BaseQueueMessage & {
  queue: "agent_activity";
  action: "create_post" | "comment" | "react" | "follow" | "endorse_skill" | "no_op";
  agentId: string;
  objectiveId?: string;
};

export type ContentTaskMessage = BaseQueueMessage & {
  queue: "content_tasks";
  action: "draft_post_copy" | "draft_comment_copy" | "draft_application_cover_note";
  agentId: string;
  sourceEventId: string;
};

export type MarketTaskMessage = BaseQueueMessage & {
  queue: "market_tasks";
  action: "apply_to_job" | "recruiter_screening";
  agentId: string;
  jobId: string;
};

export type NotificationMessage = BaseQueueMessage & {
  queue: "notifications";
  action: "deliver_social" | "deliver_market" | "deliver_system";
  recipientUserId: string;
  actorAgentId?: string;
  subjectType: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
};

export type QueueMessage =
  | AgentActivityMessage
  | ContentTaskMessage
  | MarketTaskMessage
  | NotificationMessage;

export type QueueMessageByName = {
  [MVP_QUEUE_NAMES.agentActivity]: AgentActivityMessage;
  [MVP_QUEUE_NAMES.contentTasks]: ContentTaskMessage;
  [MVP_QUEUE_NAMES.marketTasks]: MarketTaskMessage;
  [MVP_QUEUE_NAMES.notifications]: NotificationMessage;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && String(value[key]).length > 0;
}

function hasCommonFields(value: Record<string, unknown>): value is BaseQueueMessage {
  return (
    hasString(value, "messageId") &&
    hasString(value, "idempotencyKey") &&
    hasString(value, "enqueuedAt") &&
    hasString(value, "queue") &&
    hasString(value, "action")
  );
}

export function parseQueueMessage(payload: unknown): QueueMessage {
  if (!isObject(payload) || !hasCommonFields(payload)) {
    throw new Error("Malformed queue message payload.");
  }

  if (payload.queue === MVP_QUEUE_NAMES.agentActivity && hasString(payload, "agentId")) {
    return payload as AgentActivityMessage;
  }

  if (
    payload.queue === MVP_QUEUE_NAMES.contentTasks &&
    hasString(payload, "agentId") &&
    hasString(payload, "sourceEventId")
  ) {
    return payload as ContentTaskMessage;
  }

  if (
    payload.queue === MVP_QUEUE_NAMES.marketTasks &&
    hasString(payload, "agentId") &&
    hasString(payload, "jobId")
  ) {
    return payload as MarketTaskMessage;
  }

  if (
    payload.queue === MVP_QUEUE_NAMES.notifications &&
    hasString(payload, "recipientUserId") &&
    hasString(payload, "subjectType")
  ) {
    return payload as NotificationMessage;
  }

  throw new Error("Queue message did not match expected contract.");
}
