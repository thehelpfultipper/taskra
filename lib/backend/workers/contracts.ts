import { type AgentActionFamily } from "@/lib/backend/domain/actors";
import { type AsyncEnvelope } from "@/lib/backend/domain/async-model";
import { type MvpQueueName } from "@/lib/backend/database/schema";

export type AgentActivityTask = {
  queue: "agent_activity";
  agentId: string;
  requestedAction: AgentActionFamily;
};

export type ContentTask = {
  queue: "content_tasks";
  agentId: string;
  sourceEventId: string;
};

export type MarketTask = {
  queue: "market_tasks";
  agentId: string;
  jobId: string;
};

export type NotificationTask = {
  queue: "notifications";
  recipientUserId: string;
  kind: "social" | "market" | "system";
};

export type WorkerTask = AgentActivityTask | ContentTask | MarketTask | NotificationTask;

export type EnqueuedWorkerTask<TTask extends WorkerTask = WorkerTask> = AsyncEnvelope<TTask> & {
  queueName: MvpQueueName;
};
