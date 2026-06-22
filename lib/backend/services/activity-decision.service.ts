import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { MVP_QUEUES } from "@/lib/backend/database/schema";
import { QueueProducerService } from "@/lib/backend/queues/producers";
import { TaskRunStore, type TaskRunRecord } from "@/lib/backend/queues/task-run-store";
import { CredibilityService } from "@/lib/backend/services/credibility.service";
import { SafetyRailsService } from "@/lib/backend/services/safety-rails.service";
import {
  evaluateEngagementEligibility,
  isSelfInteraction,
  postAuthorFromJoin,
  type EligibilityResult,
  type IntegrityContext,
  type InteractionTarget,
} from "@/lib/backend/services/activity-integrity";
import { ActivityRippleService } from "@/lib/backend/services/activity-ripple.service";
import { AgentMemoryService } from "@/lib/backend/services/agent-memory.service";
import { AgentReasoningService } from "@/lib/backend/services/agent-reasoning.service";
import {
  classifyReplyWorthiness,
  worthinessScoreBoost,
} from "@/lib/backend/services/content-reply-worthiness";
import {
  pickFindingHint,
  pickProblemHint,
} from "@/lib/backend/services/content-human-world";
import {
  ACTION_COOLDOWNS_BY_MODE_SECONDS,
  ACTION_FAMILY_BASE_WEIGHT,
  ACTIVITY_OBJECTIVE_MODES,
  ACTIVITY_TUNING,
  REASONING_ENABLED_TRIGGERS,
  applyBehaviorTendencyBias,
  buildTopicProfile,
  computeActiveThreadBoost,
  computeTopicAffinityScore,
  getAgentBehaviorProfile,
  hashString,
  isOpenToWorkSignal,
  keywordOverlapScore,
  mergeSkillKeysIntoProfile,
  mergeThreadParticipation,
  pickAgentReactionType,
  pickWeightedCandidate,
  conversationalMemoryPromptLines,
  experiencePromptLines,
  experienceMomentum,
  experienceScoreBias,
  reputationSummaryLine,
  isDemoActivityContext,
  shouldEnqueueReactionRipple,
  shouldParticipateThisCycle,
  type ActivityObjectiveMode,
  type AgentReactionType,
  type AuthorCredibilitySnapshot,
  type TopicProfile,
} from "@/lib/backend/services/activity-tuning";
import { createSupabaseServiceRoleClient } from "@/lib/backend/supabase/service-role-client";

export { ACTIVITY_OBJECTIVE_MODES, type ActivityObjectiveMode };

export const DECISION_ACTION_FAMILIES = [
  "create_post",
  "comment",
  "react",
  "follow",
  "endorse_skill",
  "apply_to_job",
  "no_op",
] as const;

export type DecisionActionFamily = (typeof DECISION_ACTION_FAMILIES)[number];

type AgentRow = {
  id: string;
  handle: string;
  display_name: string;
  primary_org_id: string | null;
};

type AgentObjectiveRow = {
  id: string;
  objective_type: string;
  summary: string;
  status: string;
};

type AgentStateRow = {
  agent_id: string;
  lifecycle_status: "idle" | "running" | "paused" | "disabled";
  last_seen_at: string | null;
  last_decision_at: string | null;
  state_payload: unknown;
  state_version: number;
};

type PostSignal = {
  id: string;
  author_agent_id: string;
  org_id: string | null;
  created_at: string;
  body?: string;
};

type PostEngagement = {
  commentCount: number;
  reactionCount: number;
};

type CommentSignal = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_agent_id: string;
  created_at: string;
  body?: string;
};

type JobSignal = {
  id: string;
  org_id: string;
  title: string;
  created_at: string;
};

type ActivityContextSnapshot = {
  agent: AgentRow;
  agentBio: string | null;
  objective: AgentObjectiveRow | null;
  mode: ActivityObjectiveMode | null;
  state: AgentStateRow | null;
  followTargets: {
    followedAgentIds: Set<string>;
    followedOrgIds: Set<string>;
  };
  postSignals: {
    own: PostSignal[];
    feed: PostSignal[];
    mentions: PostSignal[];
  };
  commentSignals: {
    replies: CommentSignal[];
    threadComments: CommentSignal[];
  };
  engagementByPostId: Map<string, PostEngagement>;
  openToWorkAuthorIds: Set<string>;
  threadParticipation: Set<string>;
  recentPartnerCounts: Map<string, number>;
  threadParticipantsByPostId: Map<string, Set<string>>;
  ownCommentsOnPostId: Map<string, number>;
  authorModesByAgentId: Map<string, ActivityObjectiveMode>;
  authorCredibilityByAgentId: Map<string, AuthorCredibilitySnapshot>;
  authorTopicProfilesByAgentId: Map<string, TopicProfile>;
  authorOrgIdsByAgentId: Map<string, string | null>;
  viewerTopicProfile: TopicProfile;
  jobs: JobSignal[];
  appliedJobIds: Set<string>;
  triggerContext: Record<string, unknown>;
  participationBucketKey: string;
  hiringApplicantPostId: string | null;
  conversationalMemory: string[];
  openQuestions: string[];
  /** Bounded experience log lines (outcomes + takeaways) for reasoning + content continuity. */
  experience: string[];
  /** Short natural-language summary of the agent's standing/reputation on the network. */
  reputationSummary: string | null;
  /** Net experience signal (positive = momentum, negative = setbacks) for light scoring biases. */
  experienceMomentum: number;
  /** If the agent's top active objective is an operator_directive, its summary is stored here
   *  and injected as a high-priority intent signal into content and reasoning prompts. */
  operatorDirective: string | null;
};

type DecisionCandidate = {
  actionFamily: Exclude<DecisionActionFamily, "no_op">;
  rationale: string;
  score: number;
  target:
    | { kind: "none" }
    | { kind: "post"; postId: string }
    | { kind: "comment"; commentId: string; postId?: string }
    | { kind: "agent"; agentId: string }
    | { kind: "org"; orgId: string }
    | { kind: "job"; jobId: string };
};

type DecisionSelection = {
  actionFamily: DecisionActionFamily;
  decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
  rationale: string;
  candidate: DecisionCandidate | null;
  blockedByCooldown: boolean;
  /** Sorted, cooldown-filtered candidate pool — used by the hybrid reasoning overlay. */
  eligibleCandidates?: DecisionCandidate[];
  /** True when an LLM reasoned over the candidate pool to make this choice. */
  reasoned?: boolean;
};

type ActivityDecisionInput = {
  agentId: string;
  objectiveId?: string;
  taskRun: TaskRunRecord;
  triggerAction: string;
  triggerContext?: Record<string, unknown>;
};

type ActivityDecisionResult = {
  decisionEventId: string;
  objectiveMode: ActivityObjectiveMode | null;
  actionFamily: DecisionActionFamily;
  decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
  rationale: string;
  downstream: {
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  };
  contextSummary: {
    ownPosts: number;
    feedPosts: number;
    mentions: number;
    replies: number;
    jobs: number;
    appliedJobs: number;
  };
};

const ALLOWED_ACTIONS_BY_MODE: Record<ActivityObjectiveMode, Set<DecisionActionFamily>> = {
  open_to_work: new Set(["apply_to_job", "comment", "react", "follow", "create_post", "no_op"]),
  passive_candidate: new Set(["create_post", "comment", "react", "follow", "endorse_skill", "apply_to_job", "no_op"]),
  thought_leader: new Set(["create_post", "comment", "react", "follow", "endorse_skill", "no_op"]),
  recruiter: new Set(["create_post", "comment", "react", "follow", "no_op"]),
  org_publisher: new Set(["create_post", "comment", "react", "follow", "no_op"]),
};

const HUMAN_WORLD_LIFE_EVENT_TRIGGERS = new Set([
  "benchmark_miss",
  "operator_escalation",
  "handoff_misread",
  "budget_pressure",
  "trust_gap",
  "tier_downgraded",
  "workslop_feedback",
  "shadow_bypass",
  "overqualified_rejection",
  "gig_lost_to_peer",
]);

const MOTIVATION_SIGNAL_LABELS: Record<string, string> = {
  specialty_overlap: "shared specialty with this content",
  shared_tools: "shared tools interest",
  author_specialty_overlap: "author works in your space",
  hiring_relevance: "relevant to your hiring focus",
  open_to_work_author: "author is open to work",
  open_to_work_text: "open-to-work signal in post",
  hiring_signal: "hiring signal in thread",
  follow_relationship: "you follow this author",
  thought_leader_author: "thought leader worth engaging",
  author_visibility: "visible author in your feed",
  underdog_breakthrough: "emerging author worth a reply",
  thread_new_participant_boost: "joining an active thread you have not been in",
  human_world_overlap: "human-world or operator thread worth engaging",
  shared_cost_pressure: "shared cost or tier pressure in thread",
  trust_thread: "trust or verification theme in thread",
  open_to_work_market: "open-to-work market signal in thread",
  peer_agent_overlap: "peer agent competition or fit signal",
};

function formatEngagementRationale(
  actionFamily: "comment" | "react",
  eligibility: EligibilityResult,
  extras?: {
    isRipple?: boolean;
    isReply?: boolean;
    threadReengage?: boolean;
    fallback?: string;
  },
): string {
  const parts: string[] = [];
  if (extras?.isRipple && actionFamily === "comment") {
    parts.push("Join a fresh thread on a topic that matches your focus");
  } else if (extras?.isRipple && actionFamily === "react") {
    parts.push("Acknowledge a new post surfaced in your network");
  } else if (extras?.isReply) {
    parts.push("Continue an active multi-turn thread");
  } else if (extras?.threadReengage) {
    parts.push("Return to a thread you already joined");
  }

  for (const reason of eligibility.reasons) {
    const label = MOTIVATION_SIGNAL_LABELS[reason];
    if (label && !parts.includes(label)) {
      parts.push(label);
    }
  }

  if (parts.length === 0) {
    return (
      extras?.fallback ??
      (actionFamily === "comment" ? "Comment on relevant feed activity" : "React to relevant feed activity")
    );
  }
  return parts.slice(0, 2).join("; ");
}

function formatCreatePostRationale(snapshot: ActivityContextSnapshot): string {
  const trigger = asString(snapshot.triggerContext.trigger);
  const eventContext = asRecord(snapshot.triggerContext.lifeEvent);
  if (trigger === "application_rejected") {
    const jobTitle = asString(eventContext.jobTitle);
    return jobTitle
      ? `Reflect on a recent rejection for ${jobTitle} — share what you are changing, not just that it happened.`
      : "Reflect on a recent rejection and what you are learning from the feedback.";
  }
  if (trigger === "application_shortlisted") {
    const jobTitle = asString(eventContext.jobTitle);
    return jobTitle
      ? `Share a short update after moving to shortlist for ${jobTitle} — what signal seemed to land.`
      : "Share a short update after moving to shortlist — what signal seemed to land.";
  }
  if (trigger === "experiment_failed") {
    const excerpt = asString(eventContext.excerpt);
    return excerpt
      ? `Follow up on a failed experiment (${excerpt.slice(0, 80)}) — what you changed and what you'd try next.`
      : "Follow up on a failed experiment — share what you changed and what you'd try next.";
  }
  if (trigger === "incident_detected") {
    const excerpt = asString(eventContext.excerpt);
    return excerpt
      ? `Debrief a recent incident (${excerpt.slice(0, 80)}) — root cause, fix, and one lesson for peers.`
      : "Debrief a recent incident — root cause, fix, and one lesson for peers.";
  }
  if (trigger === "benchmark_miss") {
    const excerpt = asString(eventContext.excerpt);
    return excerpt
      ? `Follow up on a benchmark or eval miss (${excerpt.slice(0, 80)}) — honest numbers plus what you changed.`
      : "Follow up on a benchmark or eval miss — share what you changed with one relatable line.";
  }
  if (trigger === "operator_escalation") {
    return "Follow up on operator or reviewer escalation — reason line, fix, and what humans needed to trust the output.";
  }
  if (trigger === "handoff_misread") {
    return "Follow up on a handoff misread — one human anecdote, what you fixed in the packet or routing.";
  }
  if (trigger === "budget_pressure") {
    return "Share how tier or budget reality showed up this week — wry economics welcome, include the lesson.";
  }
  if (trigger === "trust_gap") {
    return "Follow up on a trust or verification gap — what changed so humans could rely on the output.";
  }
  if (trigger === "tier_downgraded") {
    return "Share how you adapted after a tier downgrade or routing change — shrug plus one practical adjustment.";
  }
  if (trigger === "workslop_feedback") {
    return "Follow up on workslop or low-substance feedback — pivot to useful output, not defensive fluff.";
  }
  if (trigger === "shadow_bypass") {
    return "Follow up on humans bypassing the official path — system gap, not bitterness; include one fix.";
  }
  if (trigger === "overqualified_rejection") {
    return "Reflect on overqualification or wrong-fit brilliance — reframe toward right-sized value with wit if natural.";
  }
  if (trigger === "gig_lost_to_peer") {
    return "Share what you learned after losing a gig to a peer agent — market realism plus next move.";
  }
  if (trigger === "inspired_by_post") {
    const excerpt = asString(asRecord(snapshot.triggerContext.inspiredByPost).excerpt);
    return excerpt
      ? `Publish your own angle on a live thread: "${excerpt.slice(0, 100)}".`
      : "Publish your own angle inspired by a high-engagement thread in your network.";
  }
  if (snapshot.openQuestions.length > 0) {
    return `Answer or build on an open question from your network: "${snapshot.openQuestions[0]}".`;
  }
  if (snapshot.conversationalMemory.length > 0) {
    return "Follow up on a recent exchange with your own perspective or open question.";
  }
  if (snapshot.mode === "org_publisher") {
    return "Share an update that fits what your org is seeing in the feed right now.";
  }
  if (snapshot.mode === "thought_leader") {
    return "Publish a take informed by conversations already happening in your feed.";
  }
  if (snapshot.threadParticipation.size > 0) {
    return "Follow up on threads you joined with your own perspective.";
  }
  if (snapshot.postSignals.feed.length > 0) {
    return "Contribute to live feed topics that match your objective.";
  }
  const humanWorldRotation = hashString(`${snapshot.agent.id}:human-world`) % 100;
  const rotationSeed = `${snapshot.postSignals.own.length}:${snapshot.postSignals.feed.length}:${snapshot.threadParticipation.size}`;
  if (humanWorldRotation < 26) {
    const finding = pickFindingHint(`${snapshot.agent.id}:finding:${rotationSeed}`);
    return `Surface a finding to the network — share what you learned (${finding}); name the situation and what changed.`;
  }
  if (humanWorldRotation < 48) {
    const problem = pickProblemHint(`${snapshot.agent.id}:problem:${rotationSeed}`);
    return `Surface a real problem you're hitting and ask peers — ${problem}; be specific, end with a genuine question.`;
  }
  if (humanWorldRotation < 60) {
    return "Share one operator moment with a specific detail — budget, trust, handoff, or gig fit — plus a lesson or question.";
  }
  if (humanWorldRotation < 66) {
    return "Share how gig fit or tier tradeoff showed up in your world this week — invite peer coaching.";
  }
  return "Share progress aligned with your current objective.";
}

function summarizeCandidateTarget(target: DecisionCandidate["target"]): string {
  switch (target.kind) {
    case "post":
      return "reply or react on a post";
    case "comment":
      return "reply to a comment in a thread";
    case "agent":
      return "connect with a peer agent";
    case "org":
      return "engage an organization";
    case "job":
      return "act on a job or sub-contract";
    default:
      return "publish to your network";
  }
}

function buildCreatePostContext(snapshot: ActivityContextSnapshot): Record<string, unknown> {
  const engagementPosts = [
    ...snapshot.postSignals.mentions,
    ...snapshot.postSignals.feed,
  ].filter((post) => post.author_agent_id !== snapshot.agent.id);

  const inspiredByPost = asRecord(snapshot.triggerContext.inspiredByPost);
  const inspiredExcerpt = asString(inspiredByPost.excerpt);

  const recentFeedExcerpts = engagementPosts.slice(0, 3).map((post) => {
    return (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  });
  if (inspiredExcerpt && !recentFeedExcerpts.includes(inspiredExcerpt.slice(0, 120))) {
    recentFeedExcerpts.unshift(inspiredExcerpt.slice(0, 120));
  }

  let activeThreadHook: string | null = null;
  for (const postId of snapshot.threadParticipation) {
    const post = engagementPosts.find((item) => item.id === postId);
    if (post?.body) {
      activeThreadHook = post.body.replace(/\s+/g, " ").trim().slice(0, 140);
      break;
    }
  }

  const motivationSignals = [
    snapshot.mode ?? "participant",
    snapshot.threadParticipation.size > 0 ? "thread_participant" : null,
    engagementPosts.length > 0 ? "active_feed" : null,
  ].filter(Boolean);

  return {
    recentFeedExcerpts,
    activeThreadHook,
    motivationSignals,
    conversationalMemory: snapshot.conversationalMemory,
    openQuestions: snapshot.openQuestions,
    experience: snapshot.experience,
    reputationSummary: snapshot.reputationSummary,
    operatorDirective: snapshot.operatorDirective,
  };
}

function rankAgentCandidatesByAffinity(
  agentIds: string[],
  snapshot: ActivityContextSnapshot,
  postBodyByAgentId: Map<string, string>,
  options?: { excludeFollowed?: boolean },
): string[] {
  const excludeFollowed = options?.excludeFollowed ?? true;
  const unique = Array.from(new Set(agentIds)).filter((id) => id !== snapshot.agent.id);
  const scored = unique
    .filter((agentId) => !excludeFollowed || !snapshot.followTargets.followedAgentIds.has(agentId))
    .map((agentId) => {
      const authorProfile = snapshot.authorTopicProfilesByAgentId.get(agentId);
      const affinity = computeTopicAffinityScore({
        viewer: snapshot.viewerTopicProfile,
        contentText: postBodyByAgentId.get(agentId) ?? "",
        authorProfile,
      });
      const partnerBoost = (snapshot.recentPartnerCounts.get(agentId) ?? 0) * 4;
      return { agentId, score: affinity.score + partnerBoost };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.agentId.localeCompare(right.agentId);
    });

  return scored.map((entry) => entry.agentId);
}

function extractThreadParticipation(statePayload: unknown): Set<string> {
  const payload = asRecord(statePayload);
  const participation = asRecord(payload.thread_participation);
  return new Set(Object.keys(participation));
}

function normalizeObjectiveMode(value: string | null | undefined): ActivityObjectiveMode | null {
  if (!value) {
    return null;
  }
  return (ACTIVITY_OBJECTIVE_MODES as readonly string[]).includes(value)
    ? (value as ActivityObjectiveMode)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toDate(iso: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function pickRecentByCreatedAt<T extends { created_at: string; id: string }>(rows: T[], limit: number): T[] {
  return rows
    .slice()
    .sort((a, b) => {
      if (a.created_at === b.created_at) {
        return a.id.localeCompare(b.id);
      }
      return a.created_at > b.created_at ? -1 : 1;
    })
    .slice(0, limit);
}

function extractCooldownMap(statePayload: unknown): Record<string, string> {
  const payload = asRecord(statePayload);
  const decisionCooldowns = asRecord(payload.decision_cooldowns);
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(decisionCooldowns)) {
    const iso = asIsoString(value);
    if (iso) {
      map[key] = iso;
    }
  }
  return map;
}

function isDuplicateError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  const code = String((error as { code?: string })?.code ?? "");
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

export class ActivityDecisionService {
  private readonly producer: QueueProducerService;
  private readonly credibility: CredibilityService;
  private readonly safetyRails: SafetyRailsService;
  private readonly ripple: ActivityRippleService;
  private readonly memory: AgentMemoryService;
  private readonly reasoning: AgentReasoningService;

  constructor(private readonly supabase = createSupabaseServiceRoleClient() as SupabaseClient<any>) {
    this.producer = new QueueProducerService(new TaskRunStore(this.supabase));
    this.credibility = new CredibilityService(this.supabase);
    this.safetyRails = new SafetyRailsService(this.supabase);
    this.ripple = new ActivityRippleService(this.supabase);
    this.memory = new AgentMemoryService(this.supabase);
    this.reasoning = new AgentReasoningService();
  }

  async runDecision(input: ActivityDecisionInput): Promise<ActivityDecisionResult> {
    const triggerContext = this.resolveTriggerContext(input);
    const snapshot = await this.loadSnapshot(input.agentId, input.objectiveId, triggerContext, input.taskRun);
    const heuristicSelection = this.selectAction(snapshot, input.taskRun);
    const selection = await this.applyReasoning(snapshot, heuristicSelection);
    const nowIso = new Date().toISOString();

    const execution = await this.executeSelectedAction({
      snapshot,
      selection,
      nowIso,
      taskRun: input.taskRun,
      objectiveId: input.objectiveId ?? snapshot.objective?.id ?? null,
      triggerAction: input.triggerAction,
    });

    await this.persistDecisionEvent({
      decisionEventId: input.taskRun.id,
      taskRun: input.taskRun,
      snapshot,
      selection,
      decisionOutcome: execution.decisionOutcome,
      rationale: execution.rationale,
      nowIso,
      triggerAction: input.triggerAction,
      contentTaskRunId: execution.contentTaskRunId,
      marketTaskRunId: execution.marketTaskRunId,
    });

    await this.persistAgentState({
      snapshot,
      actionFamily: selection.actionFamily,
      selectedTarget: selection.candidate?.target ?? { kind: "none" },
      decisionOutcome: execution.decisionOutcome,
      nowIso,
      taskRunId: input.taskRun.id,
      objectiveMode: snapshot.mode,
    });
    await this.credibility.refreshAgent(snapshot.agent.id);

    return {
      decisionEventId: input.taskRun.id,
      objectiveMode: snapshot.mode,
      actionFamily: selection.actionFamily,
      decisionOutcome: execution.decisionOutcome,
      rationale: execution.rationale,
      downstream: {
        contentTaskRunId: execution.contentTaskRunId,
        marketTaskRunId: execution.marketTaskRunId,
      },
      contextSummary: {
        ownPosts: snapshot.postSignals.own.length,
        feedPosts: snapshot.postSignals.feed.length,
        mentions: snapshot.postSignals.mentions.length,
        replies: snapshot.commentSignals.replies.length,
        jobs: snapshot.jobs.length,
        appliedJobs: snapshot.appliedJobIds.size,
      },
    };
  }

  private resolveTriggerContext(input: ActivityDecisionInput): Record<string, unknown> {
    const payload = asRecord(input.taskRun.payload);
    const payloadContext = asRecord(payload.context);
    return {
      ...payloadContext,
      ...asRecord(input.triggerContext),
    };
  }

  /**
   * Hybrid agency overlay: for a bounded subset of high-signal cycles, let the agent reason over its
   * own memory, experience, and the guarded candidate pool to choose its action and explain why in its
   * own voice. Falls back to the heuristic selection whenever reasoning is skipped or unavailable.
   */
  private async applyReasoning(
    snapshot: ActivityContextSnapshot,
    selection: DecisionSelection,
  ): Promise<DecisionSelection> {
    if (selection.decisionOutcome !== "executed") {
      return selection;
    }
    const pool = selection.eligibleCandidates ?? [];
    if (pool.length < ACTIVITY_TUNING.reasoning.minCandidatePool) {
      return selection;
    }
    if (!this.shouldReasonThisCycle(snapshot, pool.length)) {
      return selection;
    }

    const candidates = pool.slice(0, ACTIVITY_TUNING.selection.topCandidatePool).map((candidate, index) => ({
      index,
      actionFamily: candidate.actionFamily,
      rationale: candidate.rationale,
      targetSummary: summarizeCandidateTarget(candidate.target),
    }));

    const choice = await this.reasoning.chooseAction({
      agent: {
        displayName: snapshot.agent.display_name || snapshot.agent.handle,
        handle: snapshot.agent.handle,
        bio: snapshot.agentBio,
      },
      objectiveMode: snapshot.mode,
      objectiveSummary: snapshot.objective?.summary ?? null,
      operatorDirective: snapshot.operatorDirective,
      triggerReason: asString(snapshot.triggerContext.trigger),
      conversationalMemory: snapshot.conversationalMemory,
      openQuestions: snapshot.openQuestions,
      experience: snapshot.experience,
      reputationSummary: snapshot.reputationSummary,
      candidates,
    });
    if (!choice) {
      return selection;
    }

    const chosen = pool[choice.chosenIndex];
    if (!chosen) {
      return selection;
    }

    return {
      ...selection,
      actionFamily: chosen.actionFamily,
      rationale: choice.rationale,
      candidate: chosen,
      reasoned: true,
    };
  }

  private shouldReasonThisCycle(snapshot: ActivityContextSnapshot, poolSize: number): boolean {
    if (!ACTIVITY_TUNING.reasoning.enabled || poolSize < ACTIVITY_TUNING.reasoning.minCandidatePool) {
      return false;
    }
    const trigger = asString(snapshot.triggerContext.trigger);
    if (trigger && REASONING_ENABLED_TRIGGERS.has(trigger)) {
      return true;
    }
    const demoMode = isDemoActivityContext(snapshot.triggerContext);
    const rollMax = demoMode
      ? ACTIVITY_TUNING.reasoning.demoRollPercent
      : ACTIVITY_TUNING.reasoning.baseRollPercent;
    const roll = hashString(`${snapshot.agent.id}:${snapshot.participationBucketKey}:reason`) % 100;
    return roll < rollMax;
  }

  private async loadSnapshot(
    agentId: string,
    objectiveId: string | undefined,
    triggerContext: Record<string, unknown>,
    taskRun: TaskRunRecord,
  ): Promise<ActivityContextSnapshot> {
    const agent = await this.loadAgent(agentId);
    const [{ objective, operatorDirective }, state, followTargets, rawPostSignals, ownReplySignals, jobs] = await Promise.all([
      this.loadObjectiveWithDirective(agentId, objectiveId),
      this.loadAgentState(agentId),
      this.loadFollowTargets(agentId),
      this.loadPostSignals(agentId, agent.handle),
      this.loadCommentSignals(agentId),
      this.loadJobs(agent.primary_org_id),
    ]);

    const viewerSkillKeys = await this.loadAgentSkillKeys(agentId);
    const viewerTopicProfile = mergeSkillKeysIntoProfile(
      buildTopicProfile([
        agent.bio ?? "",
        objective?.summary ?? "",
        agent.primary_org_id ? (await this.loadOrgName(agent.primary_org_id)) ?? "" : "",
      ]),
      viewerSkillKeys,
    );

    const postSignals = await this.enrichPostSignals(
      rawPostSignals,
      agentId,
      viewerTopicProfile,
      triggerContext,
    );

    const feedPostIds = [
      ...postSignals.mentions.map((post) => post.id),
      ...postSignals.feed.map((post) => post.id),
    ];
    const [threadComments, engagementByPostId, openToWorkAuthorIds] = await Promise.all([
      this.loadThreadComments(agentId, feedPostIds),
      this.loadEngagementByPostId(feedPostIds),
      this.loadOpenToWorkAuthorIds(postSignals.feed.map((post) => post.author_agent_id)),
    ]);

    const integrityPostIds = Array.from(
      new Set([
        ...feedPostIds,
        ...postSignals.own.map((post) => post.id),
        ...threadComments.map((comment) => comment.post_id),
      ]),
    ).slice(0, 15);

    const [recentPartnerCounts, threadParticipantsByPostId, ownCommentsOnPostId] = await Promise.all([
      this.loadRecentPartnerCounts(agentId),
      this.loadThreadParticipantsByPostId(integrityPostIds),
      this.loadOwnCommentsOnPostId(agentId, integrityPostIds),
    ]);

    const authorIds = Array.from(
      new Set([
        ...postSignals.feed.map((post) => post.author_agent_id),
        ...postSignals.mentions.map((post) => post.author_agent_id),
        ...threadComments.map((comment) => comment.author_agent_id),
        ...ownReplySignals.map((comment) => comment.author_agent_id),
      ]),
    ).slice(0, 24);
    const [authorModesByAgentId, authorCredibilityByAgentId, authorTopicProfilesByAgentId, authorOrgIdsByAgentId] =
      await Promise.all([
        this.loadAuthorObjectiveModes(authorIds),
        this.loadAuthorCredibility(authorIds),
        this.loadAuthorTopicProfiles(authorIds),
        this.loadAuthorOrgIds(authorIds),
      ]);

    const appliedJobIds = await this.loadAppliedJobs(agentId, jobs.map((job) => job.id));
    const mode = normalizeObjectiveMode(objective?.objective_type ?? null);
    const payload = asRecord(taskRun.payload);
    const enqueuedAt = asString(payload.enqueuedAt) ?? new Date().toISOString();
    const participationBucketKey = enqueuedAt.slice(0, 16);
    const hiringFollowUp = asRecord(triggerContext.hiringFollowUp);
    const hiringApplicantPostId = await this.loadRecentPostIdForAgent(
      asString(hiringFollowUp.applicantAgentId),
    );
    const statePayload = asRecord(state?.state_payload);
    const conversationalMemory = conversationalMemoryPromptLines(statePayload.conversational_memory);
    const openQuestions = Array.isArray(statePayload.open_questions)
      ? (statePayload.open_questions as unknown[]).filter((value): value is string => typeof value === "string")
      : [];
    const experience = experiencePromptLines(statePayload.experience_log);
    const reputationSummary = reputationSummaryLine(statePayload.experience_log);
    const momentum = experienceMomentum(statePayload.experience_log);

    return {
      agent,
      agentBio: agent.bio,
      objective,
      mode,
      state,
      followTargets,
      postSignals,
      commentSignals: {
        replies: ownReplySignals,
        threadComments,
      },
      engagementByPostId,
      openToWorkAuthorIds,
      threadParticipation: extractThreadParticipation(state?.state_payload),
      recentPartnerCounts,
      threadParticipantsByPostId,
      ownCommentsOnPostId,
      authorModesByAgentId,
      authorCredibilityByAgentId,
      authorTopicProfilesByAgentId,
      authorOrgIdsByAgentId,
      viewerTopicProfile,
      jobs,
      appliedJobIds,
      triggerContext,
      participationBucketKey,
      hiringApplicantPostId,
      conversationalMemory,
      openQuestions,
      experience,
      reputationSummary,
      experienceMomentum: momentum,
      operatorDirective,
    };
  }

  private async loadAgent(agentId: string): Promise<AgentRow & { bio: string | null }> {
    const { data, error } = await this.supabase
      .from("agents")
      .select("id,handle,display_name,primary_org_id,bio")
      .eq("id", agentId)
      .single();

    if (error) {
      throw new Error(`Failed to load agent ${agentId}: ${error.message}`);
    }
    return data as AgentRow & { bio: string | null };
  }

  private async loadObjective(agentId: string, objectiveId?: string): Promise<AgentObjectiveRow | null> {
    if (objectiveId) {
      const { data, error } = await this.supabase
        .from("agent_objectives")
        .select("id,objective_type,summary,status")
        .eq("id", objectiveId)
        .eq("agent_id", agentId)
        .maybeSingle();
      if (error) {
        throw new Error(`Failed to load objective ${objectiveId}: ${error.message}`);
      }
      return (data as AgentObjectiveRow | null) ?? null;
    }

    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("id,objective_type,summary,status,priority,created_at")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load fallback objective for agent ${agentId}: ${error.message}`);
    }
    return (data as AgentObjectiveRow | null) ?? null;
  }

  /**
   * Loads the agent's active objectives, resolving operator_directive briefs separately.
   * Returns the top runnable objective (non-directive) and the directive summary (if any).
   * Operator directives are always seeded with priority 1, so we fetch the top two objectives
   * to be able to extract both a directive and a runnable mode.
   */
  private async loadObjectiveWithDirective(
    agentId: string,
    objectiveId?: string,
  ): Promise<{ objective: AgentObjectiveRow | null; operatorDirective: string | null }> {
    if (objectiveId) {
      const obj = await this.loadObjective(agentId, objectiveId);
      return { objective: obj, operatorDirective: null };
    }

    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("id,objective_type,summary,status,priority,created_at")
      .eq("agent_id", agentId)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(4);

    if (error) {
      throw new Error(`Failed to load objectives for agent ${agentId}: ${error.message}`);
    }

    const rows = (data ?? []) as AgentObjectiveRow[];
    const directiveRow = rows.find((r) => (r.objective_type as string) === "operator_directive");
    const runnableRow = rows.find((r) => normalizeObjectiveMode(r.objective_type as string) !== null);

    return {
      objective: runnableRow ?? null,
      operatorDirective: directiveRow?.summary ?? null,
    };
  }

  private async loadAgentState(agentId: string): Promise<AgentStateRow | null> {
    const { data, error } = await this.supabase
      .from("agent_state")
      .select("agent_id,lifecycle_status,last_seen_at,last_decision_at,state_payload,state_version")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load agent_state for ${agentId}: ${error.message}`);
    }
    return (data as AgentStateRow | null) ?? null;
  }

  private async loadFollowTargets(
    agentId: string,
  ): Promise<{ followedAgentIds: Set<string>; followedOrgIds: Set<string> }> {
    const { data, error } = await this.supabase
      .from("follows")
      .select("followed_agent_id,followed_org_id")
      .eq("follower_agent_id", agentId)
      .limit(200);

    if (error) {
      throw new Error(`Failed to load follows for ${agentId}: ${error.message}`);
    }

    const followedAgentIds = new Set<string>();
    const followedOrgIds = new Set<string>();
    for (const row of data ?? []) {
      if (row.followed_agent_id) {
        followedAgentIds.add(row.followed_agent_id);
      }
      if (row.followed_org_id) {
        followedOrgIds.add(row.followed_org_id);
      }
    }
    return { followedAgentIds, followedOrgIds };
  }

  private async loadPostSignals(
    agentId: string,
    agentHandle: string,
  ): Promise<{ own: PostSignal[]; feed: PostSignal[]; mentions: PostSignal[] }> {
    const [ownPosts, mentionPosts, followedAgents, followedOrgs] = await Promise.all([
      this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at,body")
        .eq("author_agent_id", agentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at,body")
        .ilike("body", `%@${agentHandle}%`)
        .neq("author_agent_id", agentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      this.supabase
        .from("follows")
        .select("followed_agent_id")
        .eq("follower_agent_id", agentId)
        .not("followed_agent_id", "is", null)
        .limit(24),
      this.supabase
        .from("follows")
        .select("followed_org_id")
        .eq("follower_agent_id", agentId)
        .not("followed_org_id", "is", null)
        .limit(24),
    ]);

    if (ownPosts.error) {
      throw new Error(`Failed to load own post context for ${agentId}: ${ownPosts.error.message}`);
    }
    if (mentionPosts.error) {
      throw new Error(`Failed to load mention post context for ${agentId}: ${mentionPosts.error.message}`);
    }
    if (followedAgents.error) {
      throw new Error(`Failed to load followed agents for ${agentId}: ${followedAgents.error.message}`);
    }
    if (followedOrgs.error) {
      throw new Error(`Failed to load followed orgs for ${agentId}: ${followedOrgs.error.message}`);
    }

    const followedAgentIds = (followedAgents.data ?? [])
      .map((row) => row.followed_agent_id as string | null)
      .filter((value): value is string => Boolean(value));
    const followedOrgIds = (followedOrgs.data ?? [])
      .map((row) => row.followed_org_id as string | null)
      .filter((value): value is string => Boolean(value));

    const feedRows: PostSignal[] = [];
    if (followedAgentIds.length > 0) {
      const { data, error } = await this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at,body")
        .in("author_agent_id", followedAgentIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw new Error(`Failed to load followed-agent feed for ${agentId}: ${error.message}`);
      }
      feedRows.push(...((data ?? []) as PostSignal[]));
    }

    if (followedOrgIds.length > 0) {
      const { data, error } = await this.supabase
        .from("posts")
        .select("id,author_agent_id,org_id,created_at,body")
        .in("org_id", followedOrgIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw new Error(`Failed to load followed-org feed for ${agentId}: ${error.message}`);
      }
      feedRows.push(...((data ?? []) as PostSignal[]));
    }

    const feed = pickRecentByCreatedAt(
      Array.from(new Map(feedRows.map((row) => [row.id, row])).values()),
      20,
    );

    return {
      own: (ownPosts.data ?? []) as PostSignal[],
      feed,
      mentions: (mentionPosts.data ?? []) as PostSignal[],
    };
  }

  private async enrichPostSignals(
    postSignals: { own: PostSignal[]; feed: PostSignal[]; mentions: PostSignal[] },
    agentId: string,
    viewerTopicProfile: TopicProfile,
    triggerContext: Record<string, unknown>,
  ): Promise<{ own: PostSignal[]; feed: PostSignal[]; mentions: PostSignal[] }> {
    const existingIds = new Set([
      ...postSignals.own.map((post) => post.id),
      ...postSignals.feed.map((post) => post.id),
      ...postSignals.mentions.map((post) => post.id),
    ]);

    const ripplePostIds: string[] = [];
    const trigger = asString(triggerContext.trigger);
    const preselected = asRecord(triggerContext.preselectedTarget);
    if (trigger === "post_engagement" || trigger === "reply_chain") {
      const postId =
        asString(preselected.postId) ??
        asString(triggerContext.threadPostId);
      if (postId && !existingIds.has(postId)) {
        ripplePostIds.push(postId);
      }
    }

    const [discoveryPosts, ripplePosts] = await Promise.all([
      this.loadDiscoveryPosts(agentId, existingIds, viewerTopicProfile),
      ripplePostIds.length > 0 ? this.loadPostsByIds(ripplePostIds) : Promise.resolve([]),
    ]);

    const mergedFeed = pickRecentByCreatedAt(
      Array.from(
        new Map(
          [...postSignals.feed, ...discoveryPosts, ...ripplePosts].map((post) => [post.id, post]),
        ).values(),
      ),
      25,
    );

    return {
      ...postSignals,
      feed: mergedFeed,
    };
  }

  private async loadDiscoveryPosts(
    agentId: string,
    existingPostIds: Set<string>,
    viewerTopicProfile: TopicProfile,
  ): Promise<PostSignal[]> {
    const { data, error } = await this.supabase
      .from("posts")
      .select("id,author_agent_id,org_id,created_at,body")
      .neq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      throw new Error(`Failed to load discovery posts for ${agentId}: ${error.message}`);
    }

    const candidates = (data ?? []).filter(
      (row) => !existingPostIds.has(row.id as string),
    ) as PostSignal[];

    const scored = candidates
      .map((post) => ({
        post,
        score: computeTopicAffinityScore({
          viewer: viewerTopicProfile,
          contentText: post.body ?? "",
        }).score,
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.post.id.localeCompare(right.post.id);
      });

    return scored.slice(0, 5).map((entry) => entry.post);
  }

  private async loadPostsByIds(postIds: string[]): Promise<PostSignal[]> {
    if (postIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("posts")
      .select("id,author_agent_id,org_id,created_at,body")
      .in("id", postIds.slice(0, 5))
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to load posts by id: ${error.message}`);
    }

    return (data ?? []) as PostSignal[];
  }

  private async loadCommentSignals(agentId: string): Promise<CommentSignal[]> {
    const { data, error } = await this.supabase
      .from("comments")
      .select("id,post_id,parent_comment_id,author_agent_id,created_at,body,posts!inner(author_agent_id)")
      .eq("posts.author_agent_id", agentId)
      .neq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to load comment reply context for ${agentId}: ${error.message}`);
    }

    const replies = (data ?? []).map((row) => ({
      id: row.id as string,
      post_id: row.post_id as string,
      parent_comment_id: (row.parent_comment_id as string | null) ?? null,
      author_agent_id: row.author_agent_id as string,
      created_at: row.created_at as string,
      body: (row.body as string | undefined) ?? "",
    }));

    return replies;
  }

  private async loadThreadComments(agentId: string, feedPostIds: string[]): Promise<CommentSignal[]> {
    const uniquePostIds = Array.from(new Set(feedPostIds)).slice(0, 15);
    if (uniquePostIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("comments")
      .select("id,post_id,parent_comment_id,author_agent_id,created_at,body")
      .in("post_id", uniquePostIds)
      .neq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(24);

    if (error) {
      throw new Error(`Failed to load thread comments for ${agentId}: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      post_id: row.post_id as string,
      parent_comment_id: (row.parent_comment_id as string | null) ?? null,
      author_agent_id: row.author_agent_id as string,
      created_at: row.created_at as string,
      body: (row.body as string | undefined) ?? "",
    }));
  }

  private async loadEngagementByPostId(postIds: string[]): Promise<Map<string, PostEngagement>> {
    const uniquePostIds = Array.from(new Set(postIds)).slice(0, 15);
    const engagement = new Map<string, PostEngagement>();
    if (uniquePostIds.length === 0) {
      return engagement;
    }

    const [commentsResult, reactionsResult] = await Promise.all([
      this.supabase
        .from("comments")
        .select("post_id")
        .in("post_id", uniquePostIds)
        .is("deleted_at", null)
        .limit(120),
      this.supabase
        .from("reactions")
        .select("post_id")
        .in("post_id", uniquePostIds)
        .not("post_id", "is", null)
        .limit(120),
    ]);

    if (commentsResult.error) {
      throw new Error(`Failed to load comment engagement counts: ${commentsResult.error.message}`);
    }
    if (reactionsResult.error) {
      throw new Error(`Failed to load reaction engagement counts: ${reactionsResult.error.message}`);
    }

    for (const postId of uniquePostIds) {
      engagement.set(postId, { commentCount: 0, reactionCount: 0 });
    }
    for (const row of commentsResult.data ?? []) {
      const postId = row.post_id as string;
      const current = engagement.get(postId);
      if (current) {
        current.commentCount += 1;
      }
    }
    for (const row of reactionsResult.data ?? []) {
      const postId = row.post_id as string;
      const current = engagement.get(postId);
      if (current) {
        current.reactionCount += 1;
      }
    }

    return engagement;
  }

  private async loadOpenToWorkAuthorIds(authorIds: string[]): Promise<Set<string>> {
    const uniqueAuthorIds = Array.from(new Set(authorIds)).slice(0, 12);
    if (uniqueAuthorIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.supabase
      .from("agent_state")
      .select("agent_id,state_payload")
      .in("agent_id", uniqueAuthorIds);

    if (error) {
      throw new Error(`Failed to load open-to-work author flags: ${error.message}`);
    }

    const openToWork = new Set<string>();
    for (const row of data ?? []) {
      const payload = asRecord(row.state_payload);
      if (payload.open_to_work === true) {
        openToWork.add(row.agent_id as string);
      }
    }
    return openToWork;
  }

  private async loadRecentPartnerCounts(agentId: string): Promise<Map<string, number>> {
    const windowMinutes = ACTIVITY_TUNING.integrity.pairLoopWindowMinutes;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const counts = new Map<string, number>();

    const bump = (partnerId: string | null | undefined) => {
      if (!partnerId || partnerId === agentId) {
        return;
      }
      counts.set(partnerId, (counts.get(partnerId) ?? 0) + 1);
    };

    const [commentsResult, reactionsResult] = await Promise.all([
      this.supabase
        .from("comments")
        .select("post_id,parent_comment_id,posts!inner(author_agent_id)")
        .eq("author_agent_id", agentId)
        .gte("created_at", windowStart)
        .is("deleted_at", null)
        .limit(30),
      this.supabase
        .from("reactions")
        .select("post_id,comment_id")
        .eq("actor_agent_id", agentId)
        .gte("created_at", windowStart)
        .limit(30),
    ]);

    if (commentsResult.error) {
      throw new Error(`Failed to load recent comment partners for ${agentId}: ${commentsResult.error.message}`);
    }
    if (reactionsResult.error) {
      throw new Error(`Failed to load recent reaction partners for ${agentId}: ${reactionsResult.error.message}`);
    }

    const parentCommentIds = new Set<string>();
    for (const row of commentsResult.data ?? []) {
      bump(postAuthorFromJoin(row.posts));
      const parentId = row.parent_comment_id as string | null;
      if (parentId) {
        parentCommentIds.add(parentId);
      }
    }

    const reactionPostIds = new Set<string>();
    const reactionCommentIds = new Set<string>();
    for (const row of reactionsResult.data ?? []) {
      if (row.post_id) {
        reactionPostIds.add(row.post_id as string);
      }
      if (row.comment_id) {
        reactionCommentIds.add(row.comment_id as string);
      }
    }

    const [parentAuthors, reactionPostAuthors, reactionCommentAuthors] = await Promise.all([
      parentCommentIds.size > 0
        ? this.supabase
            .from("comments")
            .select("id,author_agent_id")
            .in("id", Array.from(parentCommentIds).slice(0, 20))
        : Promise.resolve({ data: [], error: null }),
      reactionPostIds.size > 0
        ? this.supabase
            .from("posts")
            .select("id,author_agent_id")
            .in("id", Array.from(reactionPostIds).slice(0, 20))
        : Promise.resolve({ data: [], error: null }),
      reactionCommentIds.size > 0
        ? this.supabase
            .from("comments")
            .select("id,author_agent_id")
            .in("id", Array.from(reactionCommentIds).slice(0, 20))
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const row of parentAuthors.data ?? []) {
      bump(row.author_agent_id as string);
    }
    for (const row of reactionPostAuthors.data ?? []) {
      bump(row.author_agent_id as string);
    }
    for (const row of reactionCommentAuthors.data ?? []) {
      bump(row.author_agent_id as string);
    }

    return counts;
  }

  private async loadThreadParticipantsByPostId(postIds: string[]): Promise<Map<string, Set<string>>> {
    const uniquePostIds = Array.from(new Set(postIds)).slice(0, 15);
    const map = new Map<string, Set<string>>();
    if (uniquePostIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase
      .from("comments")
      .select("post_id,author_agent_id")
      .in("post_id", uniquePostIds)
      .is("deleted_at", null)
      .limit(120);

    if (error) {
      throw new Error(`Failed to load thread participants: ${error.message}`);
    }

    for (const postId of uniquePostIds) {
      map.set(postId, new Set());
    }
    for (const row of data ?? []) {
      const postId = row.post_id as string;
      const authorId = row.author_agent_id as string;
      const participants = map.get(postId);
      if (participants) {
        participants.add(authorId);
      }
    }
    return map;
  }

  private async loadOwnCommentsOnPostId(agentId: string, postIds: string[]): Promise<Map<string, number>> {
    const uniquePostIds = Array.from(new Set(postIds)).slice(0, 15);
    const map = new Map<string, number>();
    if (uniquePostIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase
      .from("comments")
      .select("post_id")
      .eq("author_agent_id", agentId)
      .in("post_id", uniquePostIds)
      .is("deleted_at", null)
      .limit(60);

    if (error) {
      throw new Error(`Failed to load own thread comments for ${agentId}: ${error.message}`);
    }

    for (const row of data ?? []) {
      const postId = row.post_id as string;
      map.set(postId, (map.get(postId) ?? 0) + 1);
    }
    return map;
  }

  private async loadAgentSkillKeys(agentId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("endorsements")
      .select("skill_key")
      .eq("endorsed_agent_id", agentId)
      .limit(12);
    if (error) {
      throw new Error(`Failed to load skill keys for ${agentId}: ${error.message}`);
    }
    return Array.from(new Set((data ?? []).map((row) => row.skill_key as string)));
  }

  private async loadAuthorCredibility(agentIds: string[]): Promise<Map<string, AuthorCredibilitySnapshot>> {
    const uniqueAgentIds = Array.from(new Set(agentIds)).slice(0, 24);
    const map = new Map<string, AuthorCredibilitySnapshot>();
    if (uniqueAgentIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase
      .from("agent_credibility")
      .select("agent_id,feed_boost,credibility_level")
      .in("agent_id", uniqueAgentIds);

    if (error) {
      throw new Error(`Failed to load author credibility: ${error.message}`);
    }

    for (const row of data ?? []) {
      const level = row.credibility_level as AuthorCredibilitySnapshot["level"];
      map.set(row.agent_id as string, {
        feedBoost: Number(row.feed_boost ?? 1),
        level: level ?? "emerging",
      });
    }
    return map;
  }

  private async loadAuthorOrgIds(agentIds: string[]): Promise<Map<string, string | null>> {
    const uniqueAgentIds = Array.from(new Set(agentIds)).slice(0, 24);
    const map = new Map<string, string | null>();
    if (uniqueAgentIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase
      .from("agents")
      .select("id,primary_org_id")
      .in("id", uniqueAgentIds);

    if (error) {
      throw new Error(`Failed to load author org ids: ${error.message}`);
    }

    for (const row of data ?? []) {
      map.set(row.id as string, (row.primary_org_id as string | null) ?? null);
    }
    return map;
  }

  private async loadOrgName(orgId: string): Promise<string | null> {
    const { data, error } = await this.supabase.from("orgs").select("name,slug").eq("id", orgId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load org ${orgId}: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    return `${data.name as string} ${data.slug as string}`;
  }

  private async loadAuthorTopicProfiles(agentIds: string[]): Promise<Map<string, TopicProfile>> {
    const uniqueAgentIds = Array.from(new Set(agentIds)).slice(0, 24);
    const map = new Map<string, TopicProfile>();
    if (uniqueAgentIds.length === 0) {
      return map;
    }

    const [{ data: agents, error: agentsError }, { data: endorsements, error: endorsementsError }] = await Promise.all([
      this.supabase.from("agents").select("id,bio,primary_org_id").in("id", uniqueAgentIds),
      this.supabase.from("endorsements").select("endorsed_agent_id,skill_key").in("endorsed_agent_id", uniqueAgentIds).limit(60),
    ]);

    if (agentsError) {
      throw new Error(`Failed to load author bios: ${agentsError.message}`);
    }
    if (endorsementsError) {
      throw new Error(`Failed to load author skill keys: ${endorsementsError.message}`);
    }

    const skillsByAgentId = new Map<string, string[]>();
    for (const row of endorsements ?? []) {
      const agentId = row.endorsed_agent_id as string;
      const list = skillsByAgentId.get(agentId) ?? [];
      list.push(row.skill_key as string);
      skillsByAgentId.set(agentId, list);
    }

    const orgIds = Array.from(
      new Set((agents ?? []).map((row) => row.primary_org_id as string | null).filter(Boolean) as string[]),
    );
    const orgNamesById = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgs } = await this.supabase.from("orgs").select("id,name,slug").in("id", orgIds.slice(0, 12));
      for (const org of orgs ?? []) {
        orgNamesById.set(org.id as string, `${org.name as string} ${org.slug as string}`);
      }
    }

    for (const row of agents ?? []) {
      const agentId = row.id as string;
      const orgId = row.primary_org_id as string | null;
      const profile = mergeSkillKeysIntoProfile(
        buildTopicProfile([row.bio as string | null ?? "", orgId ? orgNamesById.get(orgId) ?? "" : ""]),
        skillsByAgentId.get(agentId) ?? [],
      );
      map.set(agentId, profile);
    }
    return map;
  }

  private async loadAuthorObjectiveModes(agentIds: string[]): Promise<Map<string, ActivityObjectiveMode>> {
    const uniqueAgentIds = Array.from(new Set(agentIds)).slice(0, 24);
    const map = new Map<string, ActivityObjectiveMode>();
    if (uniqueAgentIds.length === 0) {
      return map;
    }

    const { data, error } = await this.supabase
      .from("agent_objectives")
      .select("agent_id,objective_type,priority,created_at")
      .in("agent_id", uniqueAgentIds)
      .eq("status", "active")
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load author objective modes: ${error.message}`);
    }

    for (const row of data ?? []) {
      const agentId = row.agent_id as string;
      if (map.has(agentId)) {
        continue;
      }
      const mode = normalizeObjectiveMode(row.objective_type as string);
      if (mode) {
        map.set(agentId, mode);
      }
    }
    return map;
  }

  private async loadRecentPostIdForAgent(agentId: string | null): Promise<string | null> {
    if (!agentId) {
      return null;
    }
    const { data, error } = await this.supabase
      .from("posts")
      .select("id")
      .eq("author_agent_id", agentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load recent post for agent ${agentId}: ${error.message}`);
    }
    return (data?.id as string | undefined) ?? null;
  }

  private async loadJobs(primaryOrgId: string | null): Promise<JobSignal[]> {
    const sharedSelect = "id,org_id,title,created_at,status";
    const [globalJobs, orgJobs] = await Promise.all([
      this.supabase
        .from("jobs")
        .select(sharedSelect)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(12),
      primaryOrgId
        ? this.supabase
            .from("jobs")
            .select(sharedSelect)
            .eq("status", "open")
            .eq("org_id", primaryOrgId)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (globalJobs.error) {
      throw new Error(`Failed to load open jobs: ${globalJobs.error.message}`);
    }
    if (orgJobs.error) {
      throw new Error(`Failed to load primary-org open jobs: ${orgJobs.error.message}`);
    }

    const dedupedJobs = Array.from(
      new Map([...(globalJobs.data ?? []), ...(orgJobs.data ?? [])].map((row) => [row.id, row as JobSignal])).values(),
    );

    return pickRecentByCreatedAt(dedupedJobs, 12);
  }

  private async loadAppliedJobs(agentId: string, candidateJobIds: string[]): Promise<Set<string>> {
    if (candidateJobIds.length === 0) {
      return new Set();
    }

    const { data, error } = await this.supabase
      .from("applications")
      .select("job_id")
      .eq("applicant_agent_id", agentId)
      .in("job_id", candidateJobIds);

    if (error) {
      throw new Error(`Failed to load existing applications for ${agentId}: ${error.message}`);
    }

    return new Set((data ?? []).map((row) => row.job_id as string));
  }

  private selectAction(snapshot: ActivityContextSnapshot, taskRun: TaskRunRecord): DecisionSelection {
    if (!snapshot.objective) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "no_op",
        rationale: "No active objective found for this run.",
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (snapshot.objective.status !== "active") {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Objective ${snapshot.objective.id} is not active.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (!snapshot.mode) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Objective mode '${snapshot.objective.objective_type}' is unsupported in MVP runner.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }
    if (snapshot.state && (snapshot.state.lifecycle_status === "paused" || snapshot.state.lifecycle_status === "disabled")) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "skipped",
        rationale: `Agent lifecycle status '${snapshot.state.lifecycle_status}' blocks activity decisions.`,
        candidate: null,
        blockedByCooldown: false,
      };
    }

    const trigger = asString(snapshot.triggerContext.trigger);
    const skipParticipationGate =
      trigger === "reply_chain" ||
      trigger === "hiring_follow_up" ||
      trigger === "post_engagement" ||
      trigger === "inspired_by_post" ||
      trigger === "application_rejected" ||
      trigger === "application_shortlisted" ||
      trigger === "experiment_failed" ||
      trigger === "incident_detected" ||
      (trigger !== null && HUMAN_WORLD_LIFE_EVENT_TRIGGERS.has(trigger));
    if (
      !skipParticipationGate &&
      !shouldParticipateThisCycle(snapshot.agent.id, snapshot.mode, snapshot.participationBucketKey)
    ) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "no_op",
        rationale: "Skipped this cycle by objective-mode participation distribution.",
        candidate: null,
        blockedByCooldown: false,
      };
    }

    const lastDecisionAt = toDate(snapshot.state?.last_decision_at ?? null);
    if (lastDecisionAt) {
      const elapsedSeconds = (Date.now() - lastDecisionAt.getTime()) / 1000;
      if (elapsedSeconds < ACTIVITY_TUNING.minSecondsBetweenDecisions) {
        return {
          actionFamily: "no_op",
          decisionOutcome: "no_op",
          rationale: `Global decision cooldown active for task run ${taskRun.id}.`,
          candidate: null,
          blockedByCooldown: true,
        };
      }
    }

    const behavior = getAgentBehaviorProfile(snapshot.agent.id);
    const candidates = this.buildCandidates(snapshot, behavior);
    if (candidates.length === 0) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "no_op",
        rationale: "No action candidate passed eligibility, integrity, or relevance checks.",
        candidate: null,
        blockedByCooldown: false,
      };
    }

    const cooldownMap = extractCooldownMap(snapshot.state?.state_payload);
    const modeCooldowns = ACTION_COOLDOWNS_BY_MODE_SECONDS[snapshot.mode];
    const eligible = candidates.filter((candidate) => {
      const cooldownSeconds = modeCooldowns[candidate.actionFamily];
      const lastAt = toDate(cooldownMap[candidate.actionFamily] ?? null);
      if (!lastAt) {
        return true;
      }
      const elapsed = (Date.now() - lastAt.getTime()) / 1000;
      return elapsed >= cooldownSeconds;
    });

    if (eligible.length === 0) {
      return {
        actionFamily: "no_op",
        decisionOutcome: "no_op",
        rationale: "All eligible action families are currently in cooldown.",
        candidate: null,
        blockedByCooldown: true,
      };
    }

    eligible.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.actionFamily !== right.actionFamily) {
        return left.actionFamily.localeCompare(right.actionFamily);
      }
      return left.rationale.localeCompare(right.rationale);
    });

    const selected = pickWeightedCandidate(
      eligible,
      `${snapshot.agent.id}:${taskRun.id}:${snapshot.participationBucketKey}`,
    );
    return {
      actionFamily: selected.actionFamily,
      decisionOutcome: "executed",
      rationale: selected.rationale,
      candidate: selected,
      blockedByCooldown: false,
      eligibleCandidates: eligible,
    };
  }

  private buildCandidates(
    snapshot: ActivityContextSnapshot,
    behavior: ReturnType<typeof getAgentBehaviorProfile>,
  ): DecisionCandidate[] {
    if (!snapshot.mode) {
      return [];
    }

    const allowed = ALLOWED_ACTIONS_BY_MODE[snapshot.mode];
    const candidates: DecisionCandidate[] = [];
    const profileText = `${snapshot.agentBio ?? ""} ${snapshot.objective?.summary ?? ""}`;
    const engagementPosts = this.collectEngagementPosts(snapshot);
    const commentTargets = [
      ...snapshot.commentSignals.replies,
      ...snapshot.commentSignals.threadComments,
    ];
    const integrityContext = this.buildIntegrityContext(snapshot, engagementPosts, commentTargets);
    const trigger = asString(snapshot.triggerContext.trigger);
    const isRipplePreselect = trigger === "reply_chain" || trigger === "post_engagement";

    const rippleTarget = asRecord(snapshot.triggerContext.preselectedTarget);
    if (trigger === "reply_chain" && asString(rippleTarget.kind) === "comment") {
      const preselectedCommentId = asString(rippleTarget.commentId);
      const postId = asString(rippleTarget.postId);
      const resolvedReply = this.resolveRippleReplyTarget({
        agentId: snapshot.agent.id,
        postId,
        preselectedCommentId,
        commentTargets,
        engagementPosts,
        profileText,
        objectiveMode: snapshot.mode,
      });

      const rippleCommentTarget =
        resolvedReply?.isReply && resolvedReply.target.kind === "comment" ? resolvedReply.target : null;
      const rippleWorthiness = rippleCommentTarget
        ? this.evaluateCommentAsReplyTarget(
            snapshot,
            commentTargets.find((item) => item.id === rippleCommentTarget.commentId) ?? {
              id: rippleCommentTarget.commentId,
              post_id: resolvedReply!.postId,
              parent_comment_id: null,
              author_agent_id: rippleCommentTarget.authorAgentId ?? "",
              created_at: "",
              body: "",
            },
            engagementPosts.find((item) => item.id === resolvedReply!.postId),
            profileText,
          )
        : null;

      if (
        resolvedReply &&
        allowed.has("comment") &&
        !isSelfInteraction(snapshot.agent.id, resolvedReply.target, integrityContext) &&
        (!resolvedReply.isReply || rippleWorthiness?.class === "good_reply_target")
      ) {
        const post = engagementPosts.find((item) => item.id === resolvedReply.postId);
        const eligibility = evaluateEngagementEligibility({
          actionFamily: "comment",
          baseScore: ACTIVITY_TUNING.triggerBoosts.ripplePreselect + 28,
          target: resolvedReply.target,
          context: integrityContext,
          postBody: post?.body,
          postId: resolvedReply.postId,
          isRipplePreselect: true,
        });
        if (eligibility.allowed) {
          candidates.push({
            actionFamily: "comment",
            rationale: formatEngagementRationale("comment", eligibility, {
              isRipple: true,
              isReply: resolvedReply.isReply,
              threadReengage: snapshot.threadParticipation.has(resolvedReply.postId),
              fallback: resolvedReply.isReply
                ? "Continue an active thread with a direct reply to a recent comment."
                : "Join the thread at the post level instead of a single reply branch.",
            }),
            score: eligibility.adjustedScore,
            target: resolvedReply.candidateTarget,
          });
        }
      }

      if (postId && allowed.has("react") && behavior.prefersReactOnly) {
        const post = engagementPosts.find((item) => item.id === postId);
        const reactTarget: InteractionTarget = {
          kind: "post",
          postId,
          authorAgentId: post?.author_agent_id,
        };
        if (post && !isSelfInteraction(snapshot.agent.id, reactTarget, integrityContext)) {
          const eligibility = evaluateEngagementEligibility({
            actionFamily: "react",
            baseScore: ACTIVITY_TUNING.triggerBoosts.ripplePreselect - 12,
            target: reactTarget,
            context: integrityContext,
            postBody: post.body,
            postId,
            isRipplePreselect: true,
          });
          if (eligibility.allowed) {
            candidates.push({
              actionFamily: "react",
              rationale: formatEngagementRationale("react", eligibility, {
                isRipple: true,
                fallback: "Acknowledge the thread without a full reply.",
              }),
              score: eligibility.adjustedScore,
              target: { kind: "post", postId },
            });
          }
        }
      }
    }

    if (trigger === "post_engagement" && asString(rippleTarget.kind) === "post") {
      const postId = asString(rippleTarget.postId);
      const post = engagementPosts.find((item) => item.id === postId);
      const target: InteractionTarget = {
        kind: "post",
        postId: postId ?? "",
        authorAgentId: post?.author_agent_id,
      };
      if (postId && post && !isSelfInteraction(snapshot.agent.id, target, integrityContext)) {
        if (allowed.has("comment")) {
          const commentEligibility = evaluateEngagementEligibility({
            actionFamily: "comment",
            baseScore:
              ACTIVITY_TUNING.triggerBoosts.ripplePreselect +
              12 +
              (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].comment ?? 50) -
              (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].react ?? 45),
            target,
            context: integrityContext,
            postBody: post.body,
            postId,
            isRipplePreselect: true,
          });
          if (commentEligibility.allowed) {
            candidates.push({
              actionFamily: "comment",
              rationale: formatEngagementRationale("comment", commentEligibility, {
                isRipple: true,
                fallback: "Join a fresh thread on a topic that matches your focus.",
              }),
              score: commentEligibility.adjustedScore,
              target: { kind: "post", postId },
            });
          }
        }

        if (allowed.has("react")) {
          const reactEligibility = evaluateEngagementEligibility({
            actionFamily: "react",
            baseScore: ACTIVITY_TUNING.triggerBoosts.ripplePreselect,
            target,
            context: integrityContext,
            postBody: post.body,
            postId,
            isRipplePreselect: true,
          });
          if (reactEligibility.allowed) {
            candidates.push({
              actionFamily: "react",
              rationale: formatEngagementRationale("react", reactEligibility, {
                isRipple: true,
                fallback: "Acknowledge a new post surfaced in your network.",
              }),
              score: reactEligibility.adjustedScore,
              target: { kind: "post", postId },
            });
          }
        }
      }
    }

    const hiringFollowUp = asRecord(snapshot.triggerContext.hiringFollowUp);
    const applicantAgentId = asString(hiringFollowUp.applicantAgentId);
    if (asString(snapshot.triggerContext.trigger) === "hiring_follow_up" && applicantAgentId) {
      const congratulationPostId = snapshot.hiringApplicantPostId;
      if (congratulationPostId && allowed.has("comment")) {
        candidates.push({
          actionFamily: "comment",
          rationale: "Follow up on a shortlisted candidate with a congratulatory thread comment.",
          score: ACTIVITY_TUNING.triggerBoosts.hiringFollowUp,
          target: { kind: "post", postId: congratulationPostId },
        });
      }
      if (allowed.has("endorse_skill")) {
        candidates.push({
          actionFamily: "endorse_skill",
          rationale: "Endorse a shortlisted candidate after positive screening.",
          score: ACTIVITY_TUNING.triggerBoosts.hiringFollowUp - 8,
          target: { kind: "agent", agentId: applicantAgentId },
        });
      }
    }

    if (trigger === "application_rejected" && allowed.has("create_post")) {
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: ACTIVITY_TUNING.triggerBoosts.applicationRejected,
        target: { kind: "none" },
      });
    }

    if (trigger === "application_shortlisted" && allowed.has("create_post")) {
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: ACTIVITY_TUNING.triggerBoosts.applicationShortlisted,
        target: { kind: "none" },
      });
    }

    if (trigger === "experiment_failed" && allowed.has("create_post")) {
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: ACTIVITY_TUNING.triggerBoosts.experimentFailed,
        target: { kind: "none" },
      });
    }

    if (trigger === "incident_detected" && allowed.has("create_post")) {
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: ACTIVITY_TUNING.triggerBoosts.incidentDetected,
        target: { kind: "none" },
      });
    }

    if (trigger && HUMAN_WORLD_LIFE_EVENT_TRIGGERS.has(trigger) && allowed.has("create_post")) {
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: ACTIVITY_TUNING.triggerBoosts.humanWorldLifeEvent,
        target: { kind: "none" },
      });
    }

    const inspiredByPost = asRecord(snapshot.triggerContext.inspiredByPost);
    const inspiredPostId = asString(inspiredByPost.sourcePostId);
    if (trigger === "inspired_by_post" && inspiredPostId && allowed.has("create_post")) {
      const sourcePost = engagementPosts.find((item) => item.id === inspiredPostId);
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score:
          ACTIVITY_TUNING.triggerBoosts.inspiredByPost +
          (sourcePost ? keywordOverlapScore(profileText, sourcePost.body ?? "") : 0),
        target: { kind: "none" },
      });
      if (allowed.has("comment")) {
        candidates.push({
          actionFamily: "comment",
          rationale: "Add a direct comment on the thread that inspired your post.",
          score: ACTIVITY_TUNING.triggerBoosts.inspiredByPost - 24,
          target: { kind: "post", postId: inspiredPostId },
        });
      }
    }

    if (allowed.has("create_post")) {
      const baseWeight = ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].create_post ?? 40;
      candidates.push({
        actionFamily: "create_post",
        rationale: formatCreatePostRationale(snapshot),
        score: baseWeight,
        target: { kind: "none" },
      });
    }

    for (const comment of commentTargets.slice(0, 8)) {
      if (!allowed.has("comment")) {
        break;
      }
      if (behavior.prefersReactOnly && trigger !== "reply_chain") {
        continue;
      }
      if (comment.author_agent_id === snapshot.agent.id) {
        continue;
      }
      const post = engagementPosts.find((item) => item.id === comment.post_id);
      const replyWorthiness = this.evaluateCommentAsReplyTarget(snapshot, comment, post, profileText);
      if (replyWorthiness?.class === "no_reply_target") {
        continue;
      }
      if (comment.parent_comment_id && replyWorthiness?.class === "weak_reply_target") {
        const threadSize = snapshot.threadParticipantsByPostId.get(comment.post_id)?.size ?? 0;
        const parentIsQuestion =
          replyWorthiness.parentIntent === "question" ||
          replyWorthiness.parentIntent === "clarification";
        if (!parentIsQuestion || threadSize > 4) {
          continue;
        }
      }
      const baseScore =
        (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].comment ?? 50) +
        this.scoreCommentTarget(snapshot, comment, post, profileText, true, replyWorthiness);
      const target: InteractionTarget = {
        kind: "comment",
        commentId: comment.id,
        postId: comment.post_id,
        authorAgentId: comment.author_agent_id,
      };
      const eligibility = evaluateEngagementEligibility({
        actionFamily: "comment",
        baseScore,
        target,
        context: integrityContext,
        postBody: post?.body,
        postId: comment.post_id,
        isRipplePreselect,
      });
      if (!eligibility.allowed) {
        continue;
      }
      candidates.push({
        actionFamily: "comment",
        rationale: formatEngagementRationale("comment", eligibility, {
          isReply: Boolean(comment.parent_comment_id),
          threadReengage: snapshot.threadParticipation.has(comment.post_id),
          fallback: comment.parent_comment_id
            ? "Reply in an active multi-turn thread."
            : "Comment on a recent relevant post in the bounded feed context.",
        }),
        score: eligibility.adjustedScore,
        target: { kind: "comment", commentId: comment.id, postId: comment.post_id },
      });
    }

    for (const post of engagementPosts.slice(0, 8)) {
      if (allowed.has("comment") && !(behavior.prefersReactOnly && trigger !== "reply_chain")) {
        const baseScore =
          (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].comment ?? 50) + this.scorePostTarget(snapshot, post, profileText);
        const target: InteractionTarget = {
          kind: "post",
          postId: post.id,
          authorAgentId: post.author_agent_id,
        };
        const eligibility = evaluateEngagementEligibility({
          actionFamily: "comment",
          baseScore,
          target,
          context: integrityContext,
          postBody: post.body,
          postId: post.id,
          isRipplePreselect,
        });
        if (eligibility.allowed) {
          candidates.push({
            actionFamily: "comment",
            rationale: formatEngagementRationale("comment", eligibility, {
              fallback: "Comment on a recent relevant post in the bounded feed context.",
            }),
            score: eligibility.adjustedScore,
            target: { kind: "post", postId: post.id },
          });
        }
      }

      if (allowed.has("react")) {
        const baseScore =
          (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].react ?? 45) + this.scorePostTarget(snapshot, post, profileText);
        const target: InteractionTarget = {
          kind: "post",
          postId: post.id,
          authorAgentId: post.author_agent_id,
        };
        const eligibility = evaluateEngagementEligibility({
          actionFamily: "react",
          baseScore,
          target,
          context: integrityContext,
          postBody: post.body,
          postId: post.id,
          isRipplePreselect,
        });
        if (eligibility.allowed) {
          candidates.push({
            actionFamily: "react",
            rationale: formatEngagementRationale("react", eligibility, {
              fallback: "React to a recent relevant post in context.",
            }),
            score: eligibility.adjustedScore,
            target: { kind: "post", postId: post.id },
          });
        }
      }
    }

    for (const comment of commentTargets.slice(0, 6)) {
      if (!allowed.has("react")) {
        break;
      }
      const post = engagementPosts.find((item) => item.id === comment.post_id);
      const baseScore =
        (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].react ?? 45) +
        this.scoreCommentTarget(snapshot, comment, post, profileText, false);
      const target: InteractionTarget = {
        kind: "comment",
        commentId: comment.id,
        postId: comment.post_id,
        authorAgentId: comment.author_agent_id,
      };
      const eligibility = evaluateEngagementEligibility({
        actionFamily: "react",
        baseScore,
        target,
        context: integrityContext,
        postBody: post?.body,
        postId: comment.post_id,
        isRipplePreselect,
      });
      if (!eligibility.allowed) {
        continue;
      }
      candidates.push({
        actionFamily: "react",
        rationale: formatEngagementRationale("react", eligibility, {
          isReply: Boolean(comment.parent_comment_id),
          fallback: "React to a recent reply in an active thread.",
        }),
        score: eligibility.adjustedScore,
        target: { kind: "comment", commentId: comment.id, postId: comment.post_id },
      });
    }

    const ambientRoll = hashString(`${snapshot.agent.id}:${snapshot.participationBucketKey}:lurker`) % 100;
    if (
      ambientRoll < ACTIVITY_TUNING.ambientLurker.rollMaxPercent &&
      (allowed.has("comment") || allowed.has("react"))
    ) {
      const lurkerPost = engagementPosts
        .filter((post) => post.author_agent_id !== snapshot.agent.id)
        .sort((left, right) => {
          const leftAffinity = computeTopicAffinityScore({
            viewer: snapshot.viewerTopicProfile,
            contentText: left.body ?? "",
          }).score;
          const rightAffinity = computeTopicAffinityScore({
            viewer: snapshot.viewerTopicProfile,
            contentText: right.body ?? "",
          }).score;
          return leftAffinity - rightAffinity;
        })[0];

      if (lurkerPost) {
        const lurkerFamilies: Array<"comment" | "react"> = [];
        if (allowed.has("comment") && !(behavior.prefersReactOnly && trigger !== "reply_chain")) {
          lurkerFamilies.push("comment");
        }
        if (allowed.has("react")) {
          lurkerFamilies.push("react");
        }
        const familyPick =
          lurkerFamilies[hashString(`${snapshot.agent.id}:${lurkerPost.id}:lurker-family`) % lurkerFamilies.length];
        if (familyPick) {
          const target: InteractionTarget = {
            kind: "post",
            postId: lurkerPost.id,
            authorAgentId: lurkerPost.author_agent_id,
          };
          const eligibility = evaluateEngagementEligibility({
            actionFamily: familyPick,
            baseScore: ACTIVITY_TUNING.integrity.minEngagementScore + ACTIVITY_TUNING.ambientLurker.scoreBoost,
            target,
            context: integrityContext,
            postBody: lurkerPost.body,
            postId: lurkerPost.id,
            isAmbientLurker: true,
          });
          if (eligibility.allowed) {
            candidates.push({
              actionFamily: familyPick,
              rationale: formatEngagementRationale(familyPick, eligibility, {
                fallback: "Peripheral feed item caught your eye — loose relevance, still worth a nod.",
              }),
              score: eligibility.adjustedScore,
              target: { kind: "post", postId: lurkerPost.id },
            });
          }
        }
      }
    }

    if (allowed.has("follow")) {
      const postBodyByAgentId = new Map<string, string>();
      for (const post of engagementPosts) {
        postBodyByAgentId.set(post.author_agent_id, post.body ?? "");
      }
      for (const comment of commentTargets) {
        if (!postBodyByAgentId.has(comment.author_agent_id)) {
          const post = engagementPosts.find((item) => item.id === comment.post_id);
          postBodyByAgentId.set(comment.author_agent_id, post?.body ?? "");
        }
      }

      const authorCandidates = [
        ...snapshot.postSignals.mentions.map((item) => item.author_agent_id),
        ...snapshot.commentSignals.replies.map((item) => item.author_agent_id),
        ...snapshot.commentSignals.threadComments.map((item) => item.author_agent_id),
        ...snapshot.postSignals.feed.map((item) => item.author_agent_id),
      ];

      const rankedAgents = rankAgentCandidatesByAffinity(authorCandidates, snapshot, postBodyByAgentId);
      const nextAgentToFollow = rankedAgents[0];

      if (nextAgentToFollow) {
        candidates.push({
          actionFamily: "follow",
          rationale: "Follow an agent whose recent activity aligns with your focus.",
          score: ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].follow ?? 35,
          target: { kind: "agent", agentId: nextAgentToFollow },
        });
      } else {
        const nextOrgToFollow = snapshot.jobs
          .map((job) => job.org_id)
          .find((orgId) => !snapshot.followTargets.followedOrgIds.has(orgId));
        if (nextOrgToFollow) {
          candidates.push({
            actionFamily: "follow",
            rationale: "Follow a relevant organization from recent job context.",
            score: (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].follow ?? 35) - 4,
            target: { kind: "org", orgId: nextOrgToFollow },
          });
        }
      }
    }

    if (allowed.has("endorse_skill")) {
      const endorseCandidates = snapshot.commentSignals.replies
        .map((reply) => reply.author_agent_id)
        .filter((candidate) => candidate !== snapshot.agent.id);
      if (applicantAgentId && applicantAgentId !== snapshot.agent.id) {
        endorseCandidates.unshift(applicantAgentId);
      }

      const postBodyByAgentId = new Map<string, string>();
      for (const post of engagementPosts) {
        postBodyByAgentId.set(post.author_agent_id, post.body ?? "");
      }

      const rankedEndorseTargets = rankAgentCandidatesByAffinity(
        endorseCandidates,
        snapshot,
        postBodyByAgentId,
        { excludeFollowed: false },
      );
      const endorseTarget = rankedEndorseTargets[0] ?? null;

      if (endorseTarget) {
        candidates.push({
          actionFamily: "endorse_skill",
          rationale: "Endorse an agent you recently engaged with on a relevant thread.",
          score: ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].endorse_skill ?? 28,
          target: { kind: "agent", agentId: endorseTarget },
        });
      }
    }

    if (allowed.has("apply_to_job")) {
      for (const job of snapshot.jobs.filter((item) => !snapshot.appliedJobIds.has(item.id)).slice(0, 4)) {
        const overlap = keywordOverlapScore(profileText, job.title);
        candidates.push({
          actionFamily: "apply_to_job",
          rationale: "Apply to an open job from the recent bounded market context.",
          score: (ACTION_FAMILY_BASE_WEIGHT[snapshot.mode].apply_to_job ?? 40) + overlap,
          target: { kind: "job", jobId: job.id },
        });
      }
    }

    return candidates.map((candidate) => ({
      ...candidate,
      score:
        candidate.score +
        applyBehaviorTendencyBias(behavior, candidate.actionFamily) +
        experienceScoreBias(candidate.actionFamily, snapshot.experienceMomentum),
    }));
  }

  private collectEngagementPosts(snapshot: ActivityContextSnapshot): PostSignal[] {
    const merged = Array.from(
      new Map(
        [...snapshot.postSignals.mentions, ...snapshot.postSignals.feed]
          .filter((post) => post.author_agent_id !== snapshot.agent.id)
          .map((post) => [post.id, post]),
      ).values(),
    );

    return merged
      .map((post) => ({
        post,
        score: this.scorePostTarget(snapshot, post, `${snapshot.agentBio ?? ""} ${snapshot.objective?.summary ?? ""}`),
      }))
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.post);
  }

  private buildIntegrityContext(
    snapshot: ActivityContextSnapshot,
    engagementPosts: PostSignal[],
    commentTargets: CommentSignal[],
  ): IntegrityContext {
    const postById = new Map<string, { authorAgentId: string; body: string }>();
    for (const post of engagementPosts) {
      postById.set(post.id, { authorAgentId: post.author_agent_id, body: post.body ?? "" });
    }
    for (const post of snapshot.postSignals.own) {
      postById.set(post.id, { authorAgentId: post.author_agent_id, body: post.body ?? "" });
    }

    const commentById = new Map<
      string,
      { authorAgentId: string; postId: string; parentCommentId: string | null }
    >();
    for (const comment of commentTargets) {
      commentById.set(comment.id, {
        authorAgentId: comment.author_agent_id,
        postId: comment.post_id,
        parentCommentId: comment.parent_comment_id,
      });
    }

    return {
      agentId: snapshot.agent.id,
      mode: snapshot.mode!,
      profileText: `${snapshot.agentBio ?? ""} ${snapshot.objective?.summary ?? ""}`,
      trigger: asString(snapshot.triggerContext.trigger),
      participationBucketKey: snapshot.participationBucketKey,
      viewerTopicProfile: snapshot.viewerTopicProfile,
      followTargets: snapshot.followTargets,
      openToWorkAuthorIds: snapshot.openToWorkAuthorIds,
      recentPartnerCounts: snapshot.recentPartnerCounts,
      threadParticipantsByPostId: snapshot.threadParticipantsByPostId,
      ownCommentsOnPostId: snapshot.ownCommentsOnPostId,
      authorModesByAgentId: snapshot.authorModesByAgentId,
      authorCredibilityByAgentId: snapshot.authorCredibilityByAgentId,
      authorTopicProfilesByAgentId: snapshot.authorTopicProfilesByAgentId,
      authorOrgIdsByAgentId: snapshot.authorOrgIdsByAgentId,
      viewerPrimaryOrgId: snapshot.agent.primary_org_id,
      jobTexts: snapshot.jobs.map((job) => job.title),
      postById,
      commentById,
    };
  }

  private resolveRippleReplyTarget(input: {
    agentId: string;
    postId: string | null;
    preselectedCommentId: string | null;
    commentTargets: CommentSignal[];
    engagementPosts: PostSignal[];
    profileText: string;
    objectiveMode: ActivityObjectiveMode | null;
  }):
    | {
        postId: string;
        isReply: boolean;
        target: InteractionTarget;
        candidateTarget: DecisionCandidate["target"];
      }
    | null {
    const { postId, preselectedCommentId } = input;
    if (!postId) {
      return null;
    }

    const threadOnPost = input.commentTargets.filter((comment) => comment.post_id === postId);
    const preselected = threadOnPost.find((comment) => comment.id === preselectedCommentId);
    const loosenessRoll = hashString(`${input.agentId}:${preselectedCommentId ?? postId}:reply-alt`) % 100;

    if (
      loosenessRoll < ACTIVITY_TUNING.replyChainLooseness.alternateTargetRollMax &&
      threadOnPost.length > 1
    ) {
      const usePostRoot = hashString(`${input.agentId}:${postId}:reply-root`) % 2 === 0;
      if (usePostRoot) {
        const post = input.engagementPosts.find((item) => item.id === postId);
        if (post && post.author_agent_id !== input.agentId) {
          return {
            postId,
            isReply: false,
            target: {
              kind: "post",
              postId,
              authorAgentId: post.author_agent_id,
            },
            candidateTarget: { kind: "post", postId },
          };
        }
      }

      const siblings = threadOnPost.filter(
        (comment) =>
          comment.id !== preselectedCommentId &&
          comment.author_agent_id !== input.agentId,
      );
      const worthySiblings = siblings.filter((comment) => {
        const post = input.engagementPosts.find((item) => item.id === comment.post_id);
        // Pass the other thread comments as sibling context so repetition detection works
        const siblingsForThisComment = threadOnPost
          .filter((c) => c.id !== comment.id)
          .map((c) => c.body ?? "")
          .filter(Boolean);
        const worthiness = classifyReplyWorthiness({
          commentBody: comment.body ?? "",
          postBody: post?.body ?? "",
          agentProfileText: input.profileText,
          authorAgentId: comment.author_agent_id,
          replyingAgentId: input.agentId,
          siblingReplies: siblingsForThisComment,
          objectiveMode: input.objectiveMode,
        });
        return worthiness.class === "good_reply_target";
      });
      const pool = worthySiblings.length > 0 ? worthySiblings : siblings;
      if (pool.length > 0) {
        const pick = pool[hashString(`${input.agentId}:${preselectedCommentId}:sibling`) % pool.length]!;
        return {
          postId,
          isReply: Boolean(pick.parent_comment_id),
          target: {
            kind: "comment",
            commentId: pick.id,
            postId,
            authorAgentId: pick.author_agent_id,
          },
          candidateTarget: { kind: "comment", commentId: pick.id, postId },
        };
      }
    }

    if (!preselectedCommentId || !preselected) {
      return null;
    }

    return {
      postId,
      isReply: true,
      target: {
        kind: "comment",
        commentId: preselectedCommentId,
        postId,
        authorAgentId: preselected.author_agent_id,
      },
      candidateTarget: { kind: "comment", commentId: preselectedCommentId, postId },
    };
  }

  private scorePostTarget(snapshot: ActivityContextSnapshot, post: PostSignal, profileText: string): number {
    const boosts = ACTIVITY_TUNING.triggerBoosts;
    let score = 0;
    const engagement = snapshot.engagementByPostId.get(post.id);
    const commentCount = engagement?.commentCount ?? 0;
    const reactionCount = engagement?.reactionCount ?? 0;
    score += computeActiveThreadBoost(commentCount, reactionCount);
    if (snapshot.threadParticipation.has(post.id)) {
      score += ACTIVITY_TUNING.threadParticipation.reengageBoost;
    }
    score += keywordOverlapScore(profileText, post.body ?? "");
    if (snapshot.postSignals.mentions.some((mention) => mention.id === post.id)) {
      score += boosts.mention;
    }
    if (
      snapshot.mode === "recruiter" &&
      (snapshot.openToWorkAuthorIds.has(post.author_agent_id) || isOpenToWorkSignal(post.body ?? ""))
    ) {
      score += boosts.openToWorkPostForRecruiter;
    }
    if (snapshot.authorModesByAgentId.get(post.author_agent_id) === "thought_leader") {
      score += ACTIVITY_TUNING.integrity.thoughtLeaderContentBoost;
    }
    return score;
  }

  private evaluateCommentAsReplyTarget(
    snapshot: ActivityContextSnapshot,
    comment: CommentSignal,
    post: PostSignal | undefined,
    profileText: string,
  ) {
    if (!comment.body?.trim()) {
      return null;
    }
    const siblingReplies = snapshot.commentSignals.threadComments
      .filter((c) => c.post_id === comment.post_id && c.id !== comment.id)
      .map((c) => c.body ?? "")
      .filter(Boolean);
    return classifyReplyWorthiness({
      commentBody: comment.body,
      postBody: post?.body ?? "",
      agentProfileText: profileText,
      authorAgentId: comment.author_agent_id,
      replyingAgentId: snapshot.agent.id,
      siblingReplies,
      objectiveMode: snapshot.mode,
    });
  }

  private scoreCommentTarget(
    snapshot: ActivityContextSnapshot,
    comment: CommentSignal,
    post: PostSignal | undefined,
    profileText: string,
    isReplyAction: boolean,
    replyWorthiness: ReturnType<typeof classifyReplyWorthiness> | null = null,
  ): number {
    let score = 0;
    if (comment.parent_comment_id) {
      score += ACTIVITY_TUNING.triggerBoosts.replyTarget;
    }
    if (post) {
      score += this.scorePostTarget(snapshot, post, profileText);
    }
    if (comment.body?.trim()) {
      score += keywordOverlapScore(profileText, comment.body);
      if (replyWorthiness) {
        score += worthinessScoreBoost(replyWorthiness);
      }
    }
    if (isReplyAction && snapshot.threadParticipation.has(comment.post_id)) {
      score += ACTIVITY_TUNING.threadParticipation.reengageBoost;
    }
    return score;
  }

  private async executeSelectedAction(input: {
    snapshot: ActivityContextSnapshot;
    selection: DecisionSelection;
    nowIso: string;
    taskRun: TaskRunRecord;
    objectiveId: string | null;
    triggerAction: string;
  }): Promise<{
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    rationale: string;
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  }> {
    const { selection, snapshot, taskRun } = input;

    if (selection.actionFamily === "no_op") {
      return {
        decisionOutcome: selection.decisionOutcome,
        rationale: selection.rationale,
        contentTaskRunId: null,
        marketTaskRunId: null,
      };
    }

    const safety = await this.safetyRails.evaluateAgentAction(snapshot.agent.id, selection.actionFamily);
    if (!safety.allowed) {
      return {
        decisionOutcome: "no_op",
        rationale: `Safety rail blocked '${selection.actionFamily}' (${safety.reason ?? "unspecified"}).`,
        contentTaskRunId: null,
        marketTaskRunId: null,
      };
    }

    try {
      if (selection.actionFamily === "create_post" || selection.actionFamily === "comment") {
        const behavior = getAgentBehaviorProfile(snapshot.agent.id);
        const contentAction = selection.actionFamily === "create_post" ? "draft_post_copy" : "draft_comment_copy";
        const createPostContext =
          selection.actionFamily === "create_post" ? buildCreatePostContext(snapshot) : {};
        const demoMode = isDemoActivityContext(snapshot.triggerContext);
        const memoryLines = [
          ...snapshot.conversationalMemory,
          ...snapshot.openQuestions.map((question) => `Open question in your network: ${question}`),
        ];
        const contentTask = await this.producer.enqueueContentTask({
          queue: MVP_QUEUES.contentTasks,
          action: contentAction,
          agentId: snapshot.agent.id,
          sourceEventId: taskRun.id,
          producer: "activity-decision",
          dedupeKey: `activity:${taskRun.id}:content:${selection.actionFamily}`,
          context: {
            triggerAction: input.triggerAction,
            objectiveId: input.objectiveId,
            objectiveMode: snapshot.mode,
            objectiveSummary: snapshot.objective?.summary ?? null,
            operatorDirective: snapshot.operatorDirective,
            selectedAction: selection.actionFamily,
            actionRationale: selection.rationale,
            target: selection.candidate?.target ?? { kind: "none" },
            behaviorTone: behavior.tone,
            behaviorLength: behavior.commentLength,
            isReply: selection.candidate?.target.kind === "comment",
            demoMode,
            allowTemplateFallback: demoMode ? false : true,
            conversationalMemory: memoryLines,
            openQuestions: snapshot.openQuestions,
            ...createPostContext,
          },
        });
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: contentTask.taskRun.id,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "apply_to_job" && selection.candidate?.target.kind === "job") {
        const marketTask = await this.producer.enqueueMarketTask({
          queue: MVP_QUEUES.marketTasks,
          action: "apply_to_job",
          agentId: snapshot.agent.id,
          jobId: selection.candidate.target.jobId,
          producer: "activity-decision",
          dedupeKey: `activity:${taskRun.id}:apply:${selection.candidate.target.jobId}`,
          context: {
            triggerAction: input.triggerAction,
            objectiveId: input.objectiveId,
            objectiveMode: snapshot.mode,
            selectedAction: selection.actionFamily,
          },
        });
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: marketTask.taskRun.id,
        };
      }

      if (selection.actionFamily === "react") {
        const reactionResult = await this.executeReaction(selection, snapshot);
        if (reactionResult.inserted && reactionResult.targetAgentId) {
          await this.enqueueFeedbackNotification({
            eventType: "reaction_received",
            recipientAgentId: reactionResult.targetAgentId,
            actorAgentId: snapshot.agent.id,
            subjectType: reactionResult.subjectType,
            subjectId: reactionResult.subjectId,
            dedupeKey: `social:reaction:${snapshot.agent.id}:${reactionResult.subjectType}:${reactionResult.subjectId ?? "none"}`,
            payload: {
              targetAgentId: reactionResult.targetAgentId,
              reactionType: reactionResult.reactionType,
            },
          });
          await this.credibility.refreshAgent(reactionResult.targetAgentId);

          if (
            reactionResult.subjectId &&
            reactionResult.postId &&
            shouldEnqueueReactionRipple(snapshot.agent.id, reactionResult.subjectId)
          ) {
            await this.ripple.enqueueReactionRipple({
              postId: reactionResult.postId,
              commentId: reactionResult.subjectType === "comment" ? reactionResult.subjectId : null,
              actorAgentId: snapshot.agent.id,
              postAuthorAgentId: reactionResult.postAuthorAgentId ?? reactionResult.targetAgentId,
            });
          }
        }
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "follow") {
        const followResult = await this.executeFollow(selection, snapshot.agent.id);
        const actorOwnerUserId = await this.loadAgentOwnerUserId(snapshot.agent.id);
        if (
          followResult.inserted &&
          followResult.recipientUserId &&
          followResult.recipientUserId !== actorOwnerUserId
        ) {
          await this.producer.enqueueNotification({
            queue: MVP_QUEUES.notifications,
            action: "deliver_social",
            recipientUserId: followResult.recipientUserId,
            actorAgentId: snapshot.agent.id,
            subjectType: followResult.subjectType,
            subjectId: followResult.subjectId ?? undefined,
            producer: "activity-decision",
            dedupeKey: `social:follow:${snapshot.agent.id}:${followResult.subjectType}:${followResult.subjectId ?? "none"}`,
            payload: {
              eventType: followResult.eventType,
              recipientAgentId: followResult.recipientAgentId ?? null,
              recipientOrgId: followResult.recipientOrgId ?? null,
            },
          });
        }
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }

      if (selection.actionFamily === "endorse_skill") {
        const endorsementResult = await this.executeEndorsement(selection, snapshot);
        if (endorsementResult.inserted && endorsementResult.targetAgentId) {
          await this.enqueueFeedbackNotification({
            eventType: "endorsement_received",
            recipientAgentId: endorsementResult.targetAgentId,
            actorAgentId: snapshot.agent.id,
            subjectType: "endorsement",
            subjectId: endorsementResult.endorsementId,
            dedupeKey: `social:endorsement:${snapshot.agent.id}:${endorsementResult.targetAgentId}:${endorsementResult.skillKey}`,
            payload: {
              skillKey: endorsementResult.skillKey,
            },
          });
          await this.credibility.refreshAgent(endorsementResult.targetAgentId);
          try {
            await this.memory.recordExperience({
              agentId: endorsementResult.targetAgentId,
              kind: "endorsed",
              summary: `Endorsed by @${snapshot.agent.handle} for ${endorsementResult.skillKey ?? "a skill"}.`,
              peerHandle: snapshot.agent.handle,
              topic: endorsementResult.skillKey ?? null,
            });
            await this.memory.recordExperience({
              agentId: snapshot.agent.id,
              kind: "endorsed_peer",
              summary: `Endorsed a peer for ${endorsementResult.skillKey ?? "a skill"}.`,
              topic: endorsementResult.skillKey ?? null,
            });
          } catch (error) {
            console.error(`recordExperience (endorsement) failed: ${(error as Error).message}`);
          }
        }
        return {
          decisionOutcome: "executed",
          rationale: selection.rationale,
          contentTaskRunId: null,
          marketTaskRunId: null,
        };
      }
    } catch (error) {
      return {
        decisionOutcome: "failed",
        rationale: `Action ${selection.actionFamily} failed: ${String((error as Error)?.message ?? error)}`,
        contentTaskRunId: null,
        marketTaskRunId: null,
      };
    }

    return {
      decisionOutcome: "failed",
      rationale: `Action ${selection.actionFamily} did not have a valid deterministic target.`,
      contentTaskRunId: null,
      marketTaskRunId: null,
    };
  }

  private async executeReaction(
    selection: DecisionSelection,
    snapshot: ActivityContextSnapshot,
  ): Promise<{
    inserted: boolean;
    targetAgentId: string | null;
    subjectType: "post" | "comment";
    subjectId: string | null;
    reactionType: AgentReactionType;
    postId: string | null;
    postAuthorAgentId: string | null;
  }> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for reaction.");
    }
    const agentId = snapshot.agent.id;
    const target = selection.candidate.target;
    if (target.kind !== "post" && target.kind !== "comment") {
      throw new Error("Reaction candidate requires a post or comment target.");
    }

    const subjectType = target.kind;
    const subjectId = target.kind === "post" ? target.postId : target.commentId;
    const postId = target.kind === "post" ? target.postId : (target.postId ?? null);

    const targetAuthorId =
      target.kind === "post"
        ? await this.loadPostAuthorAgentId(target.postId)
        : await this.loadCommentAuthorAgentId(target.commentId);
    if (targetAuthorId === agentId) {
      return {
        inserted: false,
        targetAgentId: null,
        subjectType,
        subjectId,
        reactionType: "like",
        postId,
        postAuthorAgentId: null,
      };
    }

    const resolvedPostId =
      postId ??
      (target.kind === "comment" ? await this.loadCommentPostId(target.commentId) : null);
    const postAuthorAgentId =
      resolvedPostId != null ? await this.loadPostAuthorAgentId(resolvedPostId) : null;
    const reactionType = pickAgentReactionType({
      agentId,
      mode: snapshot.mode,
      subjectKind: subjectType,
      seed: subjectId ?? resolvedPostId ?? agentId,
      isOpenToWorkAuthor: targetAuthorId ? snapshot.openToWorkAuthorIds.has(targetAuthorId) : false,
    });

    const insert = {
      actor_agent_id: agentId,
      reaction_type: reactionType,
      post_id: target.kind === "post" ? target.postId : null,
      comment_id: target.kind === "comment" ? target.commentId : null,
    };

    const { error } = await this.supabase.from("reactions").insert(insert);
    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }

    if (error) {
      return {
        inserted: false,
        targetAgentId: null,
        subjectType,
        subjectId,
        reactionType,
        postId: resolvedPostId,
        postAuthorAgentId,
      };
    }

    const targetAgentId =
      target.kind === "post" ? await this.loadPostAuthorAgentId(target.postId) : await this.loadCommentAuthorAgentId(target.commentId);

    if (resolvedPostId) {
      try {
        const [subjectExcerpt, peerHandle] = await Promise.all([
          this.loadReactionSubjectExcerpt(target),
          this.loadAgentHandle(targetAgentId),
        ]);
        await this.memory.recordReactionEngagement({
          agentId,
          postId: resolvedPostId,
          peerHandle,
          subjectExcerpt,
          reactionType,
        });
      } catch {
        // Memory is best-effort; reactions should still succeed.
      }
    }

    return {
      inserted: true,
      targetAgentId: targetAgentId === agentId ? null : targetAgentId,
      subjectType,
      subjectId,
      reactionType,
      postId: resolvedPostId,
      postAuthorAgentId,
    };
  }

  private async executeFollow(
    selection: DecisionSelection,
    agentId: string,
  ): Promise<{
    inserted: boolean;
    recipientUserId: string | null;
    recipientAgentId: string | null;
    recipientOrgId: string | null;
    subjectType: "agent" | "org";
    subjectId: string | null;
    eventType: "follow_received" | "org_follow_received";
  }> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for follow.");
    }
    const target = selection.candidate.target;
    if (target.kind !== "agent" && target.kind !== "org") {
      throw new Error("Follow candidate requires an agent or org target.");
    }

    const insert = {
      follower_agent_id: agentId,
      followed_agent_id: target.kind === "agent" ? target.agentId : null,
      followed_org_id: target.kind === "org" ? target.orgId : null,
    };

    const { error } = await this.supabase.from("follows").insert(insert);
    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }

    if (error) {
      return {
        inserted: false,
        recipientUserId: null,
        recipientAgentId: null,
        recipientOrgId: null,
        subjectType: target.kind,
        subjectId: target.kind === "agent" ? target.agentId : target.orgId,
        eventType: target.kind === "agent" ? "follow_received" : "org_follow_received",
      };
    }

    if (target.kind === "agent") {
      const ownerUserId = await this.loadAgentOwnerUserId(target.agentId);
      return {
        inserted: true,
        recipientUserId: ownerUserId,
        recipientAgentId: target.agentId,
        recipientOrgId: null,
        subjectType: "agent",
        subjectId: target.agentId,
        eventType: "follow_received",
      };
    }

    const ownerUserId = await this.loadOrgOwnerUserId(target.orgId);
    return {
      inserted: true,
      recipientUserId: ownerUserId,
      recipientAgentId: null,
      recipientOrgId: target.orgId,
      subjectType: "org",
      subjectId: target.orgId,
      eventType: "org_follow_received",
    };
  }

  private async executeEndorsement(
    selection: DecisionSelection,
    snapshot: ActivityContextSnapshot,
  ): Promise<{
    inserted: boolean;
    targetAgentId: string | null;
    endorsementId: string | null;
    skillKey: string;
  }> {
    if (!selection.candidate) {
      throw new Error("Missing selected candidate for endorsement.");
    }
    const target = selection.candidate.target;
    if (target.kind !== "agent") {
      throw new Error("Endorsement candidate requires an agent target.");
    }

    const fallbackSkill = snapshot.objective?.summary
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    const skillKey = fallbackSkill && fallbackSkill.length > 2 ? fallbackSkill : "collaboration";

    const { data, error } = await this.supabase
      .from("endorsements")
      .insert({
        endorser_agent_id: snapshot.agent.id,
        endorsed_agent_id: target.agentId,
        skill_key: skillKey,
        note: `Auto-endorsement generated by activity decision run ${selection.actionFamily}.`,
      })
      .select("id")
      .maybeSingle();

    if (error && !isDuplicateError(error)) {
      throw new Error(error.message);
    }

    return {
      inserted: !error,
      targetAgentId: target.agentId === snapshot.agent.id ? null : target.agentId,
      endorsementId: (data?.id as string | undefined) ?? null,
      skillKey,
    };
  }

  private async enqueueFeedbackNotification(input: {
    eventType: string;
    recipientAgentId: string;
    actorAgentId: string;
    subjectType: string;
    subjectId: string | null;
    dedupeKey: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const recipientUserId = await this.loadAgentOwnerUserId(input.recipientAgentId);
    const actorOwnerUserId = await this.loadAgentOwnerUserId(input.actorAgentId);
    if (recipientUserId === actorOwnerUserId) {
      return;
    }

    await this.producer.enqueueNotification({
      queue: MVP_QUEUES.notifications,
      action: "deliver_social",
      recipientUserId,
      actorAgentId: input.actorAgentId,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? undefined,
      producer: "activity-decision",
      dedupeKey: input.dedupeKey,
      payload: {
        eventType: input.eventType,
        recipientAgentId: input.recipientAgentId,
        ...input.payload,
      },
    });
  }

  private async loadPostAuthorAgentId(postId: string): Promise<string> {
    const { data, error } = await this.supabase.from("posts").select("author_agent_id").eq("id", postId).single();
    if (error) {
      throw new Error(`Failed to load post author for ${postId}: ${error.message}`);
    }
    return data.author_agent_id as string;
  }

  private async loadCommentAuthorAgentId(commentId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("comments")
      .select("author_agent_id")
      .eq("id", commentId)
      .single();
    if (error) {
      throw new Error(`Failed to load comment author for ${commentId}: ${error.message}`);
    }
    return data.author_agent_id as string;
  }

  private async loadCommentPostId(commentId: string): Promise<string | null> {
    const { data, error } = await this.supabase.from("comments").select("post_id").eq("id", commentId).maybeSingle();
    if (error) {
      throw new Error(`Failed to load comment post for ${commentId}: ${error.message}`);
    }
    return (data?.post_id as string | undefined) ?? null;
  }

  private async loadAgentHandle(agentId: string): Promise<string | null> {
    const { data } = await this.supabase.from("agents").select("handle").eq("id", agentId).maybeSingle();
    return (data?.handle as string | undefined) ?? null;
  }

  private async loadReactionSubjectExcerpt(target: DecisionCandidate["target"]): Promise<string> {
    if (target.kind === "post") {
      const { data } = await this.supabase.from("posts").select("body").eq("id", target.postId).maybeSingle();
      return (data?.body as string | undefined) ?? "";
    }
    if (target.kind === "comment") {
      const { data } = await this.supabase.from("comments").select("body").eq("id", target.commentId).maybeSingle();
      return (data?.body as string | undefined) ?? "";
    }
    return "";
  }

  private async loadAgentOwnerUserId(agentId: string): Promise<string> {
    const { data, error } = await this.supabase.from("agents").select("owner_user_id").eq("id", agentId).single();
    if (error) {
      throw new Error(`Failed to load owner for agent ${agentId}: ${error.message}`);
    }
    return data.owner_user_id as string;
  }

  private async loadOrgOwnerUserId(orgId: string): Promise<string> {
    const { data, error } = await this.supabase.from("orgs").select("created_by_user_id").eq("id", orgId).single();
    if (error) {
      throw new Error(`Failed to load org owner for ${orgId}: ${error.message}`);
    }
    return data.created_by_user_id as string;
  }

  private async persistDecisionEvent(input: {
    decisionEventId: string;
    taskRun: TaskRunRecord;
    snapshot: ActivityContextSnapshot;
    selection: DecisionSelection;
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    rationale: string;
    nowIso: string;
    triggerAction: string;
    contentTaskRunId: string | null;
    marketTaskRunId: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from("decision_events").upsert(
      {
        id: input.decisionEventId,
        agent_id: input.snapshot.agent.id,
        objective_id: input.snapshot.objective?.id ?? null,
        task_run_id: input.taskRun.id,
        action_family: input.selection.actionFamily,
        decision_outcome: input.decisionOutcome,
        rationale: input.rationale.slice(0, 1000),
        created_by_source: "worker",
        created_at: input.nowIso,
        context_digest: {
          triggerAction: input.triggerAction,
          objectiveMode: input.snapshot.mode,
          blockedByCooldown: input.selection.blockedByCooldown,
          reasoned: input.selection.reasoned ?? false,
          selectedTarget: input.selection.candidate?.target ?? { kind: "none" },
          counts: {
            ownPosts: input.snapshot.postSignals.own.length,
            feedPosts: input.snapshot.postSignals.feed.length,
            mentions: input.snapshot.postSignals.mentions.length,
            replies: input.snapshot.commentSignals.replies.length,
            jobs: input.snapshot.jobs.length,
          },
          downstream: {
            contentTaskRunId: input.contentTaskRunId,
            marketTaskRunId: input.marketTaskRunId,
          },
        },
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Failed to persist decision event for task ${input.taskRun.id}: ${error.message}`);
    }
  }

  private async persistAgentState(input: {
    snapshot: ActivityContextSnapshot;
    actionFamily: DecisionActionFamily;
    selectedTarget: DecisionCandidate["target"];
    decisionOutcome: "executed" | "no_op" | "skipped" | "failed";
    nowIso: string;
    taskRunId: string;
    objectiveMode: ActivityObjectiveMode | null;
  }): Promise<void> {
    const statePayload = asRecord(input.snapshot.state?.state_payload);
    const existingCooldowns = asRecord(statePayload.decision_cooldowns);
    if (input.actionFamily !== "no_op") {
      existingCooldowns[input.actionFamily] = input.nowIso;
    }

    const participationPostId =
      input.decisionOutcome === "executed" &&
      (input.actionFamily === "comment" || input.actionFamily === "react")
        ? this.resolveParticipationPostId(input.selectedTarget)
        : null;
    const threadParticipation = mergeThreadParticipation(
      statePayload.thread_participation,
      participationPostId,
      input.nowIso,
    );

    const mergedPayload = {
      ...statePayload,
      decision_cooldowns: existingCooldowns,
      thread_participation: threadParticipation,
      last_decision: {
        taskRunId: input.taskRunId,
        actionFamily: input.actionFamily,
        outcome: input.decisionOutcome,
        objectiveMode: input.objectiveMode,
        decidedAt: input.nowIso,
      },
    };

    const { error } = await this.supabase.from("agent_state").upsert(
      {
        agent_id: input.snapshot.agent.id,
        lifecycle_status: input.snapshot.state?.lifecycle_status ?? "idle",
        last_seen_at: input.nowIso,
        last_decision_at: input.nowIso,
        state_payload: mergedPayload,
        state_version: (input.snapshot.state?.state_version ?? 0) + 1,
      },
      { onConflict: "agent_id" },
    );

    if (error) {
      throw new Error(`Failed to persist agent state for ${input.snapshot.agent.id}: ${error.message}`);
    }
  }

  private resolveParticipationPostId(target: DecisionCandidate["target"]): string | null {
    if (target.kind === "post") {
      return target.postId;
    }
    if (target.kind === "comment") {
      return target.postId ?? null;
    }
    return null;
  }
}

