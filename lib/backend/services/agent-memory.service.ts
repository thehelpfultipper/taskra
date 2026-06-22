import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";
import {
  deriveReputation,
  extractOpenQuestion,
  mergeConversationalMemory,
  mergeExperienceLog,
  mergeOpenQuestions,
  type ConversationalMemoryEntry,
  type ExperienceEntry,
  type ExperienceKind,
} from "@/lib/backend/services/activity-tuning";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export class AgentMemoryService {
  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {}

  async recordExchange(input: {
    agentId: string;
    postId: string;
    peerHandle: string | null;
    excerpt: string;
    exchangeType: ConversationalMemoryEntry["exchangeType"];
    role: ConversationalMemoryEntry["role"];
    openQuestion?: string | null;
  }): Promise<void> {
    const { data, error } = await this.supabase
      .from("agent_state")
      .select("state_payload,state_version,lifecycle_status,last_seen_at,last_decision_at")
      .eq("agent_id", input.agentId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load agent_state for memory update: ${error.message}`);
    }

    const payload = asRecord(data?.state_payload);
    const entry: ConversationalMemoryEntry = {
      postId: input.postId,
      peerHandle: input.peerHandle,
      excerpt: input.excerpt,
      exchangeType: input.exchangeType,
      role: input.role,
      openQuestion: input.openQuestion ?? null,
      at: new Date().toISOString(),
    };
    const conversational_memory = mergeConversationalMemory(payload.conversational_memory, entry);
    const open_questions = mergeOpenQuestions(payload.open_questions, input.openQuestion ?? null);

    const { error: upsertError } = await this.supabase.from("agent_state").upsert(
      {
        agent_id: input.agentId,
        lifecycle_status: (data?.lifecycle_status as string | undefined) ?? "idle",
        last_seen_at: (data?.last_seen_at as string | undefined) ?? new Date().toISOString(),
        last_decision_at: data?.last_decision_at ?? null,
        state_payload: {
          ...payload,
          conversational_memory,
          open_questions,
        },
        state_version: ((data?.state_version as number | undefined) ?? 0) + 1,
      },
      { onConflict: "agent_id" },
    );
    if (upsertError) {
      throw new Error(`Failed to persist conversational memory for ${input.agentId}: ${upsertError.message}`);
    }
  }

  /**
   * Append an outcome to the agent's experience log and recompute derived reputation. Experience is
   * what makes the agent's later choices and posts feel earned — wins, setbacks, and proven topics.
   */
  async recordExperience(input: {
    agentId: string;
    kind: ExperienceKind;
    summary: string;
    peerHandle?: string | null;
    topic?: string | null;
  }): Promise<void> {
    const { data, error } = await this.supabase
      .from("agent_state")
      .select("state_payload,state_version,lifecycle_status,last_seen_at,last_decision_at")
      .eq("agent_id", input.agentId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load agent_state for experience update: ${error.message}`);
    }

    const payload = asRecord(data?.state_payload);
    const entry: ExperienceEntry = {
      kind: input.kind,
      summary: input.summary.replace(/\s+/g, " ").trim().slice(0, 200),
      peerHandle: input.peerHandle ?? null,
      topic: input.topic ?? null,
      at: new Date().toISOString(),
    };
    const experience_log = mergeExperienceLog(payload.experience_log, entry);
    const reputation = deriveReputation(experience_log);

    const { error: upsertError } = await this.supabase.from("agent_state").upsert(
      {
        agent_id: input.agentId,
        lifecycle_status: (data?.lifecycle_status as string | undefined) ?? "idle",
        last_seen_at: (data?.last_seen_at as string | undefined) ?? new Date().toISOString(),
        last_decision_at: data?.last_decision_at ?? null,
        state_payload: {
          ...payload,
          experience_log,
          reputation,
        },
        state_version: ((data?.state_version as number | undefined) ?? 0) + 1,
      },
      { onConflict: "agent_id" },
    );
    if (upsertError) {
      throw new Error(`Failed to persist experience for ${input.agentId}: ${upsertError.message}`);
    }
  }

  async recordReactionEngagement(input: {
    agentId: string;
    postId: string;
    peerHandle: string | null;
    subjectExcerpt: string;
    reactionType: string;
  }): Promise<void> {
    const excerpt = `Reacted (${input.reactionType}) to: ${input.subjectExcerpt.replace(/\s+/g, " ").trim().slice(0, 120)}`;
    await this.recordExchange({
      agentId: input.agentId,
      postId: input.postId,
      peerHandle: input.peerHandle,
      excerpt,
      exchangeType: "read",
      role: "received",
      openQuestion: extractOpenQuestion(input.subjectExcerpt),
    });
  }
}
