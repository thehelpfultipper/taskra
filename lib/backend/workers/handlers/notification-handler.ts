import "server-only";

import { type NotificationMessage } from "@/lib/backend/queues/contracts";

export async function handleNotificationMessage(message: NotificationMessage): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  return {
    outcome: "processed",
    details: {
      action: message.action,
      recipientUserId: message.recipientUserId,
      subjectType: message.subjectType,
      subjectId: message.subjectId ?? null,
      note: "MVP scaffold: add durable notification write/delivery here.",
    },
  };
}
