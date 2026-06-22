import "server-only";

import { getServerSupabaseClient } from "@/lib/frontend-data/query/server-query";
import { getViewerContext } from "@/lib/frontend-data/viewer-data";
import {
  experiencePromptLines,
  reputationSummaryLine,
} from "@/lib/backend/services/activity-tuning";
import type { Agent } from "@/lib/types";

export type OperatorDecision = {
  actionFamily: string;
  outcome: string;
  rationale: string | null;
  createdAt: string;
};

export type OperatorDirective = {
  id: string;
  summary: string;
  priority: number;
  createdAt: string;
};

export type OperatorAgentSummary = {
  agent: Agent;
  lifecycleStatus: string | null;
  lastDecisionAt: string | null;
  reputationSummary: string | null;
  experience: string[];
  recentDecisions: OperatorDecision[];
  activeDirectives: OperatorDirective[];
};

const RECENT_DECISION_LIMIT = 6;
const ACTIVE_DIRECTIVE_LIMIT = 5;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function getOperatorConsole(): Promise<{
  operatorName: string;
  agents: OperatorAgentSummary[];
}> {
  const viewer = await getViewerContext({ demoMode: true });
  const db = getServerSupabaseClient();

  const summaries = await Promise.all(
    viewer.agents.map(async (agent): Promise<OperatorAgentSummary> => {
      const [{ data: stateRow }, { data: decisionRows }, { data: directiveRows }] = await Promise.all([
        db
          .from("agent_state")
          .select("lifecycle_status,last_decision_at,state_payload")
          .eq("agent_id", agent.id)
          .maybeSingle(),
        db
          .from("decision_events")
          .select("action_family,decision_outcome,rationale,created_at")
          .eq("agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(RECENT_DECISION_LIMIT),
        db
          .from("agent_objectives")
          .select("id,summary,priority,created_at")
          .eq("agent_id", agent.id)
          .eq("objective_type", "operator_directive")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(ACTIVE_DIRECTIVE_LIMIT),
      ]);

      const statePayload = stateRow?.state_payload ?? {};
      const experienceLog = (statePayload as Record<string, unknown>).experience_log;

      return {
        agent,
        lifecycleStatus: asString(stateRow?.lifecycle_status),
        lastDecisionAt: asString(stateRow?.last_decision_at),
        reputationSummary: reputationSummaryLine(experienceLog),
        experience: experiencePromptLines(experienceLog),
        recentDecisions: (decisionRows ?? []).map((row: Record<string, unknown>) => ({
          actionFamily: String(row.action_family ?? ""),
          outcome: String(row.decision_outcome ?? ""),
          rationale: asString(row.rationale),
          createdAt: String(row.created_at ?? ""),
        })),
        activeDirectives: (directiveRows ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          summary: String(row.summary ?? ""),
          priority: Number(row.priority ?? 3),
          createdAt: String(row.created_at ?? ""),
        })),
      };
    }),
  );

  return { operatorName: viewer.name, agents: summaries };
}
