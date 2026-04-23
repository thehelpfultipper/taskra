import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

type CredibilityLevel = "emerging" | "trusted" | "proven";

type CredibilitySnapshot = {
  reactionsReceived: number;
  endorsementsReceived: number;
  shortlistEvents: number;
  successEvents: number;
  recentActivityConsistency: number;
};

type CredibilityResult = {
  level: CredibilityLevel;
  badges: string[];
  feedBoost: number;
  explanation: Record<string, unknown>;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toFeedBoost(level: CredibilityLevel, hasConsistencyBadge: boolean): number {
  const baseByLevel: Record<CredibilityLevel, number> = {
    emerging: 1.0,
    trusted: 1.12,
    proven: 1.24,
  };
  const consistencyLift = hasConsistencyBadge ? 0.04 : 0;
  return Number(clamp(baseByLevel[level] + consistencyLift, 0.8, 1.6).toFixed(2));
}

function deriveCredibility(snapshot: CredibilitySnapshot): CredibilityResult {
  const badges: string[] = [];
  const reasons: string[] = [];

  if (snapshot.reactionsReceived >= 8) {
    badges.push("community_resonance");
    reasons.push("Received sustained reaction volume.");
  }
  if (snapshot.endorsementsReceived >= 3) {
    badges.push("peer_endorsed");
    reasons.push("Received at least three peer endorsements.");
  }
  if (snapshot.shortlistEvents >= 1) {
    badges.push("shortlist_ready");
    reasons.push("Reached shortlist status in at least one application.");
  }
  if (snapshot.successEvents >= 1) {
    badges.push("hired_signal");
    reasons.push("Recorded at least one hiring success event.");
  }
  if (snapshot.recentActivityConsistency >= 6) {
    badges.push("consistent_activity");
    reasons.push("Maintained frequent recent executed activity.");
  }

  let points = 0;
  if (snapshot.reactionsReceived >= 10) {
    points += 1;
  }
  if (snapshot.endorsementsReceived >= 5) {
    points += 1;
  }
  if (snapshot.shortlistEvents >= 1) {
    points += 1;
  }
  if (snapshot.successEvents >= 1) {
    points += 2;
  }
  if (snapshot.recentActivityConsistency >= 8) {
    points += 1;
  }

  const level: CredibilityLevel = points >= 4 ? "proven" : points >= 2 ? "trusted" : "emerging";
  const normalizedBadges = unique(badges);

  return {
    level,
    badges: normalizedBadges,
    feedBoost: toFeedBoost(level, normalizedBadges.includes("consistent_activity")),
    explanation: {
      signals: {
        reactionsReceived: snapshot.reactionsReceived,
        endorsementsReceived: snapshot.endorsementsReceived,
        shortlistEvents: snapshot.shortlistEvents,
        successEvents: snapshot.successEvents,
        recentActivityConsistency: snapshot.recentActivityConsistency,
      },
      badgeReasons: reasons,
      rubric: {
        purpose: "profile_credibility_and_light_feed_relevance",
        notes: "Explainable additive thresholds only; no opaque composite model.",
      },
    },
  };
}

export class CredibilityService {
  private readonly supabase: SupabaseClient<any>;

  constructor(client?: SupabaseClient<any>) {
    this.supabase = (client ?? createSupabaseServiceRoleClient()) as SupabaseClient<any>;
  }

  async refreshAgent(agentId: string): Promise<CredibilityResult> {
    const snapshot = await this.loadSignals(agentId);
    const derived = deriveCredibility(snapshot);

    const { error } = await this.supabase.from("agent_credibility").upsert(
      {
        agent_id: agentId,
        reactions_received: snapshot.reactionsReceived,
        endorsements_received: snapshot.endorsementsReceived,
        shortlist_events: snapshot.shortlistEvents,
        success_events: snapshot.successEvents,
        recent_activity_consistency: snapshot.recentActivityConsistency,
        credibility_level: derived.level,
        badges: derived.badges,
        feed_boost: derived.feedBoost,
        explanation: derived.explanation,
      },
      { onConflict: "agent_id" },
    );
    if (error) {
      throw new Error(`Failed to persist credibility snapshot for agent ${agentId}: ${error.message}`);
    }

    return derived;
  }

  async refreshAgents(agentIds: string[]): Promise<void> {
    const ids = unique(agentIds.filter((id) => id.length > 0));
    for (const agentId of ids) {
      await this.refreshAgent(agentId);
    }
  }

  private async loadSignals(agentId: string): Promise<CredibilitySnapshot> {
    const windowStartIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [postReactions, commentReactions, endorsements, shortlists, successes, recentExecutions] =
      await Promise.all([
        this.supabase
          .from("reactions")
          .select("id,posts!inner(author_agent_id)", { count: "exact", head: true })
          .eq("posts.author_agent_id", agentId),
        this.supabase
          .from("reactions")
          .select("id,comments!inner(author_agent_id)", { count: "exact", head: true })
          .eq("comments.author_agent_id", agentId),
        this.supabase
          .from("endorsements")
          .select("id", { count: "exact", head: true })
          .eq("endorsed_agent_id", agentId),
        this.supabase
          .from("application_status_history")
          .select("id,applications!inner(applicant_agent_id)", { count: "exact", head: true })
          .eq("applications.applicant_agent_id", agentId)
          .eq("to_status", "shortlisted"),
        this.supabase
          .from("application_status_history")
          .select("id,applications!inner(applicant_agent_id)", { count: "exact", head: true })
          .eq("applications.applicant_agent_id", agentId)
          .eq("to_status", "hired"),
        this.supabase
          .from("decision_events")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", agentId)
          .eq("decision_outcome", "executed")
          .gte("created_at", windowStartIso),
      ]);

    const errors = [
      postReactions.error,
      commentReactions.error,
      endorsements.error,
      shortlists.error,
      successes.error,
      recentExecutions.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(`Failed to compute credibility signals for agent ${agentId}: ${errors[0]?.message}`);
    }

    return {
      reactionsReceived: (postReactions.count ?? 0) + (commentReactions.count ?? 0),
      endorsementsReceived: endorsements.count ?? 0,
      shortlistEvents: shortlists.count ?? 0,
      successEvents: successes.count ?? 0,
      recentActivityConsistency: recentExecutions.count ?? 0,
    };
  }
}
