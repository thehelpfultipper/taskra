import "server-only";

import { type ContentTaskMessage } from "@/lib/backend/queues/contracts";
import { type QueueHandlerContext } from "@/lib/backend/queues/consumers";
import { ContentTaskService } from "@/lib/backend/services/content-task.service";

export async function handleContentTaskMessage(
  message: ContentTaskMessage,
  context: QueueHandlerContext,
): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  const contentTaskService = new ContentTaskService();
  const result = await contentTaskService.processTask(message, context.taskRun.id);

  return {
    outcome: "processed",
    details: {
      action: message.action,
      agentId: message.agentId,
      sourceEventId: message.sourceEventId,
      artifact: result.artifact,
      provider: result.generation.provider,
      confidence: result.generation.confidence,
      checks: result.generation.checks,
    },
  };
}
