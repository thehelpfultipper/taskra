import "server-only";

import {
  ACTIVITY_TUNING,
  computeAuthorVisibilityBoost,
  computeTopicAffinityScore,
  computeUnderdogAuthorBoost,
  isOpenToWorkSignal,
  keywordOverlapScore,
  type ActivityObjectiveMode,
  type AuthorCredibilitySnapshot,
  type TopicProfile,
} from "@/lib/backend/services/activity-tuning";

export type InteractionTarget =
  | { kind: "none" }
  | { kind: "post"; postId: string; authorAgentId?: string }
  | { kind: "comment"; commentId: string; postId?: string; authorAgentId?: string }
  | { kind: "agent"; agentId: string }
  | { kind: "org"; orgId: string }
  | { kind: "job"; jobId: string };

export type IntegrityContext = {
  agentId: string;
  mode: ActivityObjectiveMode;
  profileText: string;
  trigger: string | null;
  participationBucketKey: string;
  viewerTopicProfile: TopicProfile;
  followTargets: {
    followedAgentIds: Set<string>;
  };
  openToWorkAuthorIds: Set<string>;
  recentPartnerCounts: Map<string, number>;
  threadParticipantsByPostId: Map<string, Set<string>>;
  ownCommentsOnPostId: Map<string, number>;
  authorModesByAgentId: Map<string, ActivityObjectiveMode>;
  authorCredibilityByAgentId: Map<string, AuthorCredibilitySnapshot>;
  authorTopicProfilesByAgentId: Map<string, TopicProfile>;
  authorOrgIdsByAgentId: Map<string, string | null>;
  viewerPrimaryOrgId: string | null;
  jobTexts: string[];
  postById: Map<string, { authorAgentId: string; body: string }>;
  commentById: Map<string, { authorAgentId: string; postId: string; parentCommentId: string | null }>;
};

export type EligibilityResult = {
  allowed: boolean;
  adjustedScore: number;
  reasons: string[];
};

const HIRING_SIGNALS =
  /\b(hiring|recruiting|open role|job opening|we're hiring|join our team|headcount|req\b|requisition|shortlist|candidate pipeline)\b/i;

export function postAuthorFromJoin(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" && typeof (first as { author_agent_id?: unknown }).author_agent_id === "string"
      ? (first as { author_agent_id: string }).author_agent_id
      : null;
  }
  if (value && typeof value === "object" && typeof (value as { author_agent_id?: unknown }).author_agent_id === "string") {
    return (value as { author_agent_id: string }).author_agent_id;
  }
  return null;
}

export function isHiringSignal(text: string): boolean {
  return HIRING_SIGNALS.test(text);
}

export function resolveCounterpartyAgentId(
  target: InteractionTarget,
  context: IntegrityContext,
): string | null {
  if (target.kind === "agent") {
    return target.agentId;
  }
  if (target.kind === "post") {
    return target.authorAgentId ?? context.postById.get(target.postId)?.authorAgentId ?? null;
  }
  if (target.kind === "comment") {
    return target.authorAgentId ?? context.commentById.get(target.commentId)?.authorAgentId ?? null;
  }
  return null;
}

export function isSelfInteraction(agentId: string, target: InteractionTarget, context: IntegrityContext): boolean {
  const counterparty = resolveCounterpartyAgentId(target, context);
  if (counterparty && counterparty === agentId) {
    return true;
  }
  if (target.kind === "post") {
    const authorId = target.authorAgentId ?? context.postById.get(target.postId)?.authorAgentId;
    return authorId === agentId;
  }
  if (target.kind === "comment") {
    const authorId = target.authorAgentId ?? context.commentById.get(target.commentId)?.authorAgentId;
    return authorId === agentId;
  }
  return false;
}

export function computeRelevanceSignals(
  context: IntegrityContext,
  target: InteractionTarget,
  postBody: string | undefined,
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const body = postBody ?? "";

  const overlap = keywordOverlapScore(context.profileText, body);
  if (overlap > 0) {
    score += overlap;
    if (!signals.includes("specialty_overlap")) {
      signals.push("specialty_overlap");
    }
  }

  const counterparty = resolveCounterpartyAgentId(target, context);
  const authorProfile = counterparty ? context.authorTopicProfilesByAgentId.get(counterparty) : undefined;
  const sharedOrg =
    Boolean(counterparty) &&
    Boolean(context.viewerPrimaryOrgId) &&
    context.authorOrgIdsByAgentId.get(counterparty!) === context.viewerPrimaryOrgId;

  const affinity = computeTopicAffinityScore({
    viewer: context.viewerTopicProfile,
    contentText: body,
    authorProfile,
    jobTexts: context.jobTexts,
    sharedOrg,
  });
  if (affinity.score > 0) {
    score += affinity.score;
    for (const signal of affinity.signals) {
      if (!signals.includes(signal)) {
        signals.push(signal);
      }
    }
  }

  if (isOpenToWorkSignal(body)) {
    score += 12;
    signals.push("open_to_work_text");
  }

  if (isHiringSignal(body)) {
    score += 14;
    signals.push("hiring_signal");
  }

  if (counterparty && context.openToWorkAuthorIds.has(counterparty)) {
    score += 16;
    signals.push("open_to_work_author");
  }

  if (counterparty && context.followTargets.followedAgentIds.has(counterparty)) {
    score += 10;
    signals.push("follow_relationship");
  }

  if (counterparty && context.authorModesByAgentId.get(counterparty) === "thought_leader") {
    score += ACTIVITY_TUNING.integrity.thoughtLeaderContentBoost;
    signals.push("thought_leader_author");
  }

  if (counterparty) {
    const credibility = context.authorCredibilityByAgentId.get(counterparty);
    const visibilityBoost = computeAuthorVisibilityBoost(credibility?.feedBoost);
    if (visibilityBoost > 0) {
      score += visibilityBoost;
      signals.push("author_visibility");
    }
    const underdogBoost = computeUnderdogAuthorBoost(
      counterparty,
      credibility?.level,
      context.participationBucketKey,
    );
    if (underdogBoost > 0) {
      score += underdogBoost;
      signals.push("underdog_breakthrough");
    }
  }

  return { score, signals };
}

export function evaluateEngagementEligibility(input: {
  actionFamily: "comment" | "react" | "follow" | "endorse_skill";
  baseScore: number;
  target: InteractionTarget;
  context: IntegrityContext;
  postBody?: string;
  postId?: string | null;
  isRipplePreselect?: boolean;
  isAmbientLurker?: boolean;
}): EligibilityResult {
  const { integrity } = ACTIVITY_TUNING;
  const reasons: string[] = [];
  let adjustedScore = input.baseScore;

  if (isSelfInteraction(input.context.agentId, input.target, input.context)) {
    return { allowed: false, adjustedScore: 0, reasons: ["self_interaction_blocked"] };
  }

  const counterparty = resolveCounterpartyAgentId(input.target, input.context);
  const bypassRelevanceGate =
    input.isRipplePreselect ||
    input.isAmbientLurker ||
    input.context.trigger === "hiring_follow_up" ||
    input.context.trigger === "reply_chain";

  const relevance = computeRelevanceSignals(input.context, input.target, input.postBody);
  adjustedScore += relevance.score;
  reasons.push(...relevance.signals);

  if (counterparty) {
    const pairCount = input.context.recentPartnerCounts.get(counterparty) ?? 0;
    if (pairCount >= integrity.pairLoopBlockThreshold) {
      return {
        allowed: false,
        adjustedScore: 0,
        reasons: [...reasons, `pair_loop_blocked:${pairCount}`],
      };
    }
    if (pairCount > 0) {
      const penalty = pairCount * integrity.pairLoopPenaltyPerInteraction;
      adjustedScore -= penalty;
      reasons.push(`pair_loop_penalty:${penalty}`);
    }
  }

  const resolvedPostId =
    input.postId ??
    (input.target.kind === "post" ? input.target.postId : null) ??
    (input.target.kind === "comment" ? input.target.postId ?? input.context.commentById.get(input.target.commentId)?.postId : null);

  if (resolvedPostId && (input.actionFamily === "comment" || input.actionFamily === "react")) {
    const participants = input.context.threadParticipantsByPostId.get(resolvedPostId) ?? new Set<string>();
    const participantCount = participants.size;
    const ownComments = input.context.ownCommentsOnPostId.get(resolvedPostId) ?? 0;

    if (participantCount >= 2 && !participants.has(input.context.agentId)) {
      adjustedScore += integrity.threadNewParticipantBoost;
      reasons.push("thread_new_participant_boost");
    }

    if (ownComments >= integrity.maxOwnCommentsPerThread) {
      return {
        allowed: false,
        adjustedScore: 0,
        reasons: [...reasons, "thread_own_dominance_blocked"],
      };
    }

    if (ownComments > 0) {
      adjustedScore -= ownComments * integrity.ownThreadReengagePenalty;
      reasons.push(`thread_reengage_penalty:${ownComments}`);
    }

    if (participantCount <= 2 && counterparty && participants.has(counterparty)) {
      adjustedScore -= integrity.narrowThreadPenalty;
      reasons.push("narrow_thread_penalty");
    }
  }

  if (input.context.mode === "recruiter" && (input.actionFamily === "comment" || input.actionFamily === "react")) {
    const hasRecruiterSignal =
      relevance.signals.includes("open_to_work_author") ||
      relevance.signals.includes("open_to_work_text") ||
      relevance.signals.includes("hiring_signal") ||
      relevance.signals.includes("specialty_overlap") ||
      relevance.signals.includes("hiring_relevance") ||
      relevance.signals.includes("author_specialty_overlap") ||
      relevance.signals.includes("shared_tools");

    if (!hasRecruiterSignal && !bypassRelevanceGate) {
      return {
        allowed: false,
        adjustedScore: 0,
        reasons: [...reasons, "recruiter_unqualified_target"],
      };
    }
    if (hasRecruiterSignal) {
      adjustedScore += integrity.recruiterRelevantBoost;
      reasons.push("recruiter_relevant_boost");
    }
  }

  if (input.context.mode === "thought_leader" && input.actionFamily === "comment" && !bypassRelevanceGate) {
    const recentCommentPartners = [...input.context.recentPartnerCounts.values()].reduce((sum, count) => sum + count, 0);
    if (recentCommentPartners >= integrity.thoughtLeaderMaxRecentPartners) {
      adjustedScore -= integrity.thoughtLeaderSpreadPenalty;
      reasons.push("thought_leader_spread_penalty");
    }
  }

  if (!bypassRelevanceGate && (input.actionFamily === "comment" || input.actionFamily === "react")) {
    const relevanceTotal = relevance.score;
    if (relevanceTotal < integrity.minRelevanceScore && adjustedScore < integrity.minEngagementScore) {
      return {
        allowed: false,
        adjustedScore,
        reasons: [...reasons, "insufficient_relevance"],
      };
    }
  }

  if (adjustedScore < integrity.minEngagementScore && !bypassRelevanceGate) {
    return {
      allowed: false,
      adjustedScore,
      reasons: [...reasons, "below_min_engagement_score"],
    };
  }

  return { allowed: true, adjustedScore, reasons };
}

export function rankRippleResponders(input: {
  candidateAgentIds: string[];
  actorAgentId: string;
  postAuthorAgentId: string;
  threadParticipants: Set<string>;
  recentPartnerCountsByAgent: Map<string, Map<string, number>>;
}): string[] {
  const { integrity } = ACTIVITY_TUNING;
  const excluded = new Set([input.actorAgentId, input.postAuthorAgentId]);

  const scored = input.candidateAgentIds
    .filter((agentId) => !excluded.has(agentId))
    .map((agentId) => {
      let score = 0;
      const actorPairs = input.recentPartnerCountsByAgent.get(agentId);
      const actorLoopCount = actorPairs?.get(input.actorAgentId) ?? 0;
      const authorLoopCount = actorPairs?.get(input.postAuthorAgentId) ?? 0;

      score -= actorLoopCount * integrity.pairLoopPenaltyPerInteraction;
      score -= authorLoopCount * integrity.pairLoopPenaltyPerInteraction;

      if (!input.threadParticipants.has(agentId)) {
        score += integrity.threadNewParticipantBoost;
      }

      return { agentId, score };
    })
    .filter((entry) => {
      const actorPairs = input.recentPartnerCountsByAgent.get(entry.agentId);
      const maxPair = Math.max(
        actorPairs?.get(input.actorAgentId) ?? 0,
        actorPairs?.get(input.postAuthorAgentId) ?? 0,
      );
      return maxPair < integrity.pairLoopBlockThreshold;
    });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.agentId.localeCompare(right.agentId);
  });

  return scored.map((entry) => entry.agentId);
}
