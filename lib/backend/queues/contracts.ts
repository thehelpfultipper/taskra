import { randomUUID } from "crypto";

import { AGENT_ACTION_FAMILIES } from "@/lib/backend/domain/actors";
import { MVP_QUEUES, type MvpQueueName } from "@/lib/backend/database/schema";
import { z } from "zod";

const agentActivityActions = AGENT_ACTION_FAMILIES.filter(
  (action) => action !== "apply_to_job" && action !== "recruiter_screening",
);

const agentActivityActionSchema = z.enum(agentActivityActions as [string, ...string[]]);
const contentTaskActionSchema = z.enum([
  "draft_post_copy",
  "draft_comment_copy",
  "draft_application_cover_note",
]);
const marketTaskActionSchema = z.enum(["apply_to_job", "recruiter_screening"]);
const notificationActionSchema = z.enum(["deliver_social", "deliver_market", "deliver_system"]);

const baseMessageSchema = z.object({
  messageId: z.uuid(),
  idempotencyKey: z.string().min(8),
  enqueuedAt: z.iso.datetime({ offset: true }),
  producer: z.string().min(2),
});

const agentActivityMessageSchema = baseMessageSchema.extend({
  queue: z.literal(MVP_QUEUES.agentActivity),
  action: agentActivityActionSchema,
  agentId: z.uuid(),
  objectiveId: z.uuid().optional(),
  dedupeKey: z.string().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});

const contentTaskMessageSchema = baseMessageSchema.extend({
  queue: z.literal(MVP_QUEUES.contentTasks),
  action: contentTaskActionSchema,
  agentId: z.uuid(),
  sourceEventId: z.uuid(),
  dedupeKey: z.string().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});

const marketTaskMessageSchema = baseMessageSchema.extend({
  queue: z.literal(MVP_QUEUES.marketTasks),
  action: marketTaskActionSchema,
  agentId: z.uuid(),
  jobId: z.uuid(),
  dedupeKey: z.string().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});

const notificationMessageSchema = baseMessageSchema.extend({
  queue: z.literal(MVP_QUEUES.notifications),
  action: notificationActionSchema,
  recipientUserId: z.uuid(),
  actorAgentId: z.uuid().optional(),
  subjectType: z.string().min(1),
  subjectId: z.uuid().optional(),
  dedupeKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const queueMessageSchema = z.discriminatedUnion("queue", [
  agentActivityMessageSchema,
  contentTaskMessageSchema,
  marketTaskMessageSchema,
  notificationMessageSchema,
]);

export type AgentActivityMessage = z.infer<typeof agentActivityMessageSchema>;
export type ContentTaskMessage = z.infer<typeof contentTaskMessageSchema>;
export type MarketTaskMessage = z.infer<typeof marketTaskMessageSchema>;
export type NotificationMessage = z.infer<typeof notificationMessageSchema>;
export type QueueMessage = z.infer<typeof queueMessageSchema>;

export type QueueMessageByName = {
  [MVP_QUEUES.agentActivity]: AgentActivityMessage;
  [MVP_QUEUES.contentTasks]: ContentTaskMessage;
  [MVP_QUEUES.marketTasks]: MarketTaskMessage;
  [MVP_QUEUES.notifications]: NotificationMessage;
};

export type NewQueueMessage<TQueue extends MvpQueueName> = Omit<
  QueueMessageByName[TQueue],
  "messageId" | "idempotencyKey" | "enqueuedAt"
> & {
  messageId?: string;
  idempotencyKey?: string;
  enqueuedAt?: string;
};

export function createQueueMessage<TQueue extends MvpQueueName>(
  input: NewQueueMessage<TQueue>,
): QueueMessageByName[TQueue] {
  return queueMessageSchema.parse({
    ...input,
    messageId: input.messageId ?? randomUUID(),
    idempotencyKey: input.idempotencyKey ?? randomUUID(),
    enqueuedAt: input.enqueuedAt ?? new Date().toISOString(),
  }) as QueueMessageByName[TQueue];
}

export function parseQueueMessage(payload: unknown): QueueMessage {
  return queueMessageSchema.parse(payload);
}
