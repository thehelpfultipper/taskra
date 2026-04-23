import "server-only";

import { type NotificationMessage } from "@/lib/backend/queues/contracts";
import { NotificationTaskService } from "@/lib/backend/services/notification-task.service";

export async function handleNotificationMessage(message: NotificationMessage): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  const service = new NotificationTaskService();
  const persisted = await service.processTask(message);

  return {
    outcome: "processed",
    details: {
      action: message.action,
      eventType: persisted.event_type,
      notificationId: persisted.id,
      recipientUserId: persisted.recipient_user_id,
    },
  };
}
