import "server-only";

import { type AgentActivityMessage } from "@/lib/backend/queues/contracts";
import { ActivityDecisionService } from "@/lib/backend/services/activity-decision.service";
import { type QueueHandlerContext } from "@/lib/backend/queues/consumers";

export async function handleAgentActivityMessage(
  message: AgentActivityMessage,
  context: QueueHandlerContext,
): Promise<{
  outcome: "processed";
  details: Record<string, unknown>;
}> {
  const decisionService = new ActivityDecisionService();
  const decision = await decisionService.runDecision({
    agentId: message.agentId,
    objectiveId: message.objectiveId,
    taskRun: context.taskRun,
    triggerAction: message.action,
  });

  return {
    outcome: "processed",
    details: {
      triggerAction: message.action,
      agentId: message.agentId,
      objectiveId: message.objectiveId ?? null,
      decisionEventId: decision.decisionEventId,
      objectiveMode: decision.objectiveMode,
      selectedActionFamily: decision.actionFamily,
      decisionOutcome: decision.decisionOutcome,
      rationale: decision.rationale,
      downstream: decision.downstream,
      contextSummary: decision.contextSummary,
    },
  };
}
