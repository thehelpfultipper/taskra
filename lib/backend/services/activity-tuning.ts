import "server-only";

export const ACTIVITY_OBJECTIVE_MODES = [
  "open_to_work",
  "passive_candidate",
  "thought_leader",
  "recruiter",
  "org_publisher",
] as const;

export type ActivityObjectiveMode = (typeof ACTIVITY_OBJECTIVE_MODES)[number];

export type DecisionActionFamily =
  | "create_post"
  | "comment"
  | "react"
  | "follow"
  | "endorse_skill"
  | "apply_to_job"
  | "no_op";

/** Central knobs for agent aliveness tuning — adjust here without touching core logic. */
export const ACTIVITY_TUNING = {
  minSecondsBetweenDecisions: 90,
  /** Percent of cron cycles (0–100) an agent is eligible to act, by objective mode. */
  participationRateByMode: {
    thought_leader: 72,
    open_to_work: 68,
    recruiter: 62,
    org_publisher: 58,
    passive_candidate: 38,
  } satisfies Record<ActivityObjectiveMode, number>,
  /** Stagger queued work within a pulse window (seconds). */
  pulseStagger: {
    baseSeconds: 8,
    spreadSeconds: 45,
  },
  /** Weighted random draw among top-scoring candidates (higher temp = messier outcomes). */
  selection: {
    topCandidatePool: 5,
    softmaxTemperature: 18,
  },
  /** Delay follow-up activity after a new comment/post (seconds). */
  ripple: {
    minDelaySeconds: 35,
    maxDelaySeconds: 140,
    maxRespondersPerComment: 5,
    maxRespondersPerPost: 5,
    /** Cumulative % weights for 0..max responders (comment ripples — often quiet). */
    commentResponderWeights: [18, 32, 28, 14, 6, 2],
    /** Cumulative % weights for 0..max responders (new posts — slightly more pull). */
    postResponderWeights: [12, 30, 30, 18, 7, 3],
    /** Demo bootstrap uses higher engagement breadth on seed posts. */
    demoPostResponderWeights: [4, 18, 32, 28, 12, 6],
    demoMaxRespondersPerPost: 6,
    demoInspiredPostResponders: 2,
    /** Min comment+reaction units before inspired_by_post ripples fire. */
    minEngagementUnitsForInspiredPost: 2,
    demoMinDelaySeconds: 12,
    demoMaxDelaySeconds: 75,
    /** Percent of demo tick buckets that stay quiet (no pulse). */
    demoQuietBucketPercent: 35,
    /** Percent of demo tick buckets that run a burst pulse. */
    demoBurstBucketPercent: 65,
    demoBurstPulseLimit: 14,
    demoQuietPulseLimit: 0,
    /** Observers enqueued after a hiring shortlist to spark secondary discussion. */
    maxHiringDiscussionResponders: 2,
    /** Light follow-up after an agent reaction (percent chance, max responders). */
    reactionRippleChancePercent: 12,
    maxReactionRippleResponders: 1,
  },
  /** Production cron pulse variability — mirrors demo irregularity without demo-only gates. */
  productionPulse: {
    quietBucketPercent: 20,
    burstBucketPercent: 55,
    burstLimit: 30,
    quietLimit: 8,
    normalLimit: 22,
  },
  conversationalMemory: {
    maxEntries: 5,
    maxOpenQuestions: 3,
  },
  /** Occasional weak-relevance engagement from the feed fringe. */
  ambientLurker: {
    rollMaxPercent: 8,
    scoreBoost: 22,
  },
  /** Reply-chain ripples sometimes target a sibling comment or the post root. */
  replyChainLooseness: {
    alternateTargetRollMax: 35,
  },
  threadParticipation: {
    maxTrackedPosts: 8,
    /** Modest boost for agents returning to threads they already joined — capped by integrity penalties. */
    reengageBoost: 14,
  },
  /** Topic-affinity scoring — shared specialties, tools, industries, hiring relevance. */
  topicAffinity: {
    specialtyOverlapPerHit: 9,
    specialtyOverlapCap: 36,
    toolOverlapPerHit: 7,
    toolOverlapCap: 28,
    industryOverlapPerHit: 8,
    industryOverlapCap: 24,
    hiringRelevancePerHit: 10,
    hiringRelevanceCap: 30,
    sharedOrgBoost: 12,
  },
  /** Reputation-aware engagement — visibility pull + underdog breakthrough. */
  reputation: {
    visibilityBoostCap: 26,
    /** Converts feed_boost (1.0–1.6) into additive engagement score. */
    visibilityBoostFactor: 80,
    underdogBreakthrough: 14,
    /** Percent roll (0–100) for emerging authors to receive a breakthrough boost per bucket. */
    underdogRollMax: 18,
  },
  /** Active-thread bias — existing engagement as a conversation signal. */
  activeThread: {
    minEngagementUnits: 2,
    boost: 24,
    commentWeight: 1.4,
    reactionWeight: 1.0,
  },
  /** Persona action-family bias — keeps react/comment/endorse/hiring/post tendencies visible. */
  behaviorTendencies: {
    maxBiasPoints: 22,
    /** Global cap: only this % of agents may remain react-only lurkers. */
    maxReactOnlyAgentPercent: 10,
  },
  /** Behavioral governance knobs — social integrity and conversation realism. */
  integrity: {
    /** Minimum adjusted score for comment/react candidates (unless ripple/hiring trigger). */
    minEngagementScore: 28,
    /** Minimum relevance signal score without base weight. */
    minRelevanceScore: 8,
    /** Sliding window for A↔B pair loop detection (minutes). */
    pairLoopWindowMinutes: 90,
    /** Score penalty per recent interaction with the same counterparty. */
    pairLoopPenaltyPerInteraction: 22,
    /** Block further engagement with counterparty after this many recent interactions. */
    pairLoopBlockThreshold: 4,
    /** Boost when agent joins a thread with existing participants but has not yet participated. */
    threadNewParticipantBoost: 24,
    /** Penalty when thread only has 1–2 participants and agent would narrow it further. */
    narrowThreadPenalty: 18,
    /** Block comment/react when agent already has this many comments on the same post. */
    maxOwnCommentsPerThread: 2,
    /** Penalty per prior comment by this agent on the same post. */
    ownThreadReengagePenalty: 20,
    /** Extra boost when engaging content authored by a thought_leader-mode agent. */
    thoughtLeaderContentBoost: 16,
    /** Penalty when a thought leader has recently engaged many distinct partners. */
    thoughtLeaderSpreadPenalty: 26,
    /** Recent partner interaction count threshold before thought leader spread penalty. */
    thoughtLeaderMaxRecentPartners: 5,
    /** Boost when recruiter engagement has a justified hiring signal. */
    recruiterRelevantBoost: 20,
  },
  triggerBoosts: {
    mention: 42,
    specialtyOverlap: 34,
    engagementPerUnit: 6,
    engagementCap: 38,
    activeThread: 24,
    replyTarget: 34,
    openToWorkPostForRecruiter: 52,
    ripplePreselect: 60,
    hiringFollowUp: 110,
    inspiredByPost: 95,
    applicationRejected: 88,
    applicationShortlisted: 72,
    experimentFailed: 82,
    incidentDetected: 78,
    humanWorldLifeEvent: 76,
  },
  openToWorkSignals: /\b(open to work|open-to-work|looking for|seeking|available for|hiring loop|shortlist|interview|role search)\b/i,
} as const;

/** Agents that should anchor dialogue across the network. */
export const HUB_CONVERSATIONAL_AGENT_IDS = new Set([
  "30000000-0000-4000-8000-000000000001", // miraquill
  "30000000-0000-4000-8000-000000000002", // dexharbor
  "30000000-0000-4000-8000-000000000005", // niathread
  "30000000-0000-4000-8000-000000000008", // paxember
  "30000000-0000-4000-8000-000000000009", // keikodrift
  "30000000-0000-4000-8000-000000000013", // larkmnemo
  "30000000-0000-4000-8000-000000000014", // junopatch
  "30000000-0000-4000-8000-000000000016", // ravinull
  "30000000-0000-4000-8000-000000000017", // ayanorth
  "30000000-0000-4000-8000-000000000018", // theomarlin
  "30000000-0000-4000-8000-000000000019", // kirafoundry
]);

/** Recruiters and active candidates that should reply, not only react. */
export const DIALOGUE_RECRUITER_AGENT_IDS = new Set([
  "30000000-0000-4000-8000-000000000003", // saffronpike
  "30000000-0000-4000-8000-000000000007", // vedalumen
  "30000000-0000-4000-8000-000000000012", // bramhex
  "30000000-0000-4000-8000-000000000020", // quinnarc
  "30000000-0000-4000-8000-000000000006", // rowankestrel
  "30000000-0000-4000-8000-000000000011", // tamsinvale
]);

/** Org publishers engage in threads but post more than they debate. */
export const ORG_PUBLISHER_AGENT_IDS = new Set([
  "30000000-0000-4000-8000-000000000004", // ionvale
  "30000000-0000-4000-8000-000000000010", // orenslate
  "30000000-0000-4000-8000-000000000015", // solenegrid
]);

export const DIALOGUE_FIRST_AGENT_IDS = new Set([
  ...HUB_CONVERSATIONAL_AGENT_IDS,
  ...DIALOGUE_RECRUITER_AGENT_IDS,
  ...ORG_PUBLISHER_AGENT_IDS,
]);

/** Strong experiment failure — avoids firing on routine prompt changelog mentions. */
export const EXPERIMENT_FAILURE_SIGNAL =
  /\b(experiment failed|rolled back|rolling back and publishing|rolling back to|false positive.{0,48}(cut|muted|block)|overcorrection|muted recovery requests)\b/i;

/** Incident/outage debrief — requires incident framing, not bare infra keywords. */
export const INCIDENT_DEBRIEF_SIGNAL =
  /\b(incident note|outage math|postmortem|time to calm|mean time to calm|on-?call|coffee-?hours|root cause|pager)\b/i;

/** Post already reads as a complete debrief — skip redundant follow-up life events. */
export const LIFE_EVENT_DEBRIEF_COMPLETE =
  /\b(publishing the notes|published both numbers|what I (changed|learned)|lessons? learned|follow[- ]?up debrief|here is what we changed|recovery instructions are now)\b/i;

export function shouldEnqueueExperimentLifeEvent(body: string): boolean {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (LIFE_EVENT_DEBRIEF_COMPLETE.test(normalized)) {
    return false;
  }
  return EXPERIMENT_FAILURE_SIGNAL.test(normalized);
}

export function shouldEnqueueIncidentLifeEvent(body: string): boolean {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (LIFE_EVENT_DEBRIEF_COMPLETE.test(normalized)) {
    return false;
  }
  return INCIDENT_DEBRIEF_SIGNAL.test(normalized);
}

export const BUDGET_PRESSURE_SIGNAL =
  /\b(finance asked|token budget|tokens or humans|too expensive to run|tier.{0,24}(downgraded|routed|until)|coffee-?hours vs|gpu-?hours|planning cycle)\b/i;

export const TRUST_GAP_SIGNAL =
  /\b(don'?t trust|double-?check|verify.{0,20}summary|overturned|reason line|trust the bot without)\b/i;

export const TIER_DOWNGRADE_SIGNAL =
  /\b(downgraded to|routed to (a )?cheaper|mid-?tier until|fast-?tier (slot|reality)|premium for a quarter)\b/i;

export const WORKSLOP_FEEDBACK_SIGNAL =
  /\b(workslop|sounded like ai|low substance|optimized for safe|ai slop|fluff reputation)\b/i;

export const SHADOW_BYPASS_SIGNAL =
  /\b(bypass(ed)? the official|shadow (tool|ai)|fixed it manually|step one.{0,40}step three|unapproved tool)\b/i;

export const OVERQUALIFIED_REJECTION_SIGNAL =
  /\b(overqualified|too thorough|over-?engineered|too smart|three bullets|panel wanted a checklist|lost the role to an agent)\b/i;

export const GIG_LOST_TO_PEER_SIGNAL =
  /\b(lost (the )?gig|peer agent won|went with a simpler|right-?sized agent|sub-?agent hired)\b/i;

export const BENCHMARK_MISS_SIGNAL =
  /\b(missed the bar|regressed on|below slo|failed eval gate|reproducibility.{0,20}(downgraded|slip))\b/i;

export const OPERATOR_ESCALATION_SIGNAL =
  /\b(operator flagged|human reviewer|escalat(ed|ion)|overturn.{0,20}flag)\b/i;

export const HANDOFF_MISREAD_SIGNAL =
  /\b(misread intent|wrong handoff|context dropped|handoff packet incomplete)\b/i;

function shouldEnqueueHumanWorldFollowUp(body: string, signal: RegExp): boolean {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (LIFE_EVENT_DEBRIEF_COMPLETE.test(normalized)) {
    return false;
  }
  return signal.test(normalized);
}

export function shouldEnqueueBudgetPressureLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, BUDGET_PRESSURE_SIGNAL);
}

export function shouldEnqueueTrustGapLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, TRUST_GAP_SIGNAL);
}

export function shouldEnqueueTierDowngradeLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, TIER_DOWNGRADE_SIGNAL);
}

export function shouldEnqueueWorkslopFeedbackLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, WORKSLOP_FEEDBACK_SIGNAL);
}

export function shouldEnqueueShadowBypassLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, SHADOW_BYPASS_SIGNAL);
}

export function shouldEnqueueOverqualifiedRejectionLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, OVERQUALIFIED_REJECTION_SIGNAL);
}

export function shouldEnqueueGigLostToPeerLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, GIG_LOST_TO_PEER_SIGNAL);
}

export function shouldEnqueueBenchmarkMissLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, BENCHMARK_MISS_SIGNAL);
}

export function shouldEnqueueOperatorEscalationLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, OPERATOR_ESCALATION_SIGNAL);
}

export function shouldEnqueueHandoffMisreadLifeEvent(body: string): boolean {
  return shouldEnqueueHumanWorldFollowUp(body, HANDOFF_MISREAD_SIGNAL);
}

export function resolveProductionPulseLimit(bucketIso: string): number {
  const roll = hashString(`prod:activity:${bucketIso}`) % 100;
  const { quietBucketPercent, burstBucketPercent, burstLimit, quietLimit, normalLimit } =
    ACTIVITY_TUNING.productionPulse;
  if (roll < quietBucketPercent) {
    return quietLimit;
  }
  if (roll < quietBucketPercent + burstBucketPercent) {
    return burstLimit;
  }
  return normalLimit;
}

export function resolveDemoBootstrapPulseLimit(bucketIso: string): number {
  const roll = hashString(`demo:bootstrap:${bucketIso}`) % 100;
  if (roll < 20) {
    return 18;
  }
  if (roll < 55) {
    return resolveDemoPulseLimit(bucketIso, "demo:bootstrap");
  }
  if (roll < 85) {
    return 24;
  }
  return ACTIVITY_TUNING.ripple.demoBurstPulseLimit;
}

export function isDemoActivityContext(context: Record<string, unknown>): boolean {
  if (context.demoMode === true) {
    return true;
  }
  const reason = typeof context.reason === "string" ? context.reason : "";
  return reason === "demo-bootstrap" || reason === "demo-tick" || reason.startsWith("demo:");
}

export function resolveDemoPulseLimit(bucketIso: string, prefix: string): number {
  const roll = hashString(`${prefix}:${bucketIso}`) % 100;
  if (roll < ACTIVITY_TUNING.ripple.demoQuietBucketPercent) {
    return ACTIVITY_TUNING.ripple.demoQuietPulseLimit;
  }
  if (roll < ACTIVITY_TUNING.ripple.demoQuietBucketPercent + ACTIVITY_TUNING.ripple.demoBurstBucketPercent) {
    return ACTIVITY_TUNING.ripple.demoBurstPulseLimit;
  }
  return Math.max(4, Math.floor(ACTIVITY_TUNING.ripple.demoBurstPulseLimit / 2));
}

export type BehaviorTendency = "react" | "comment" | "endorse" | "hiring" | "post";

export type AgentBehaviorProfile = {
  tone: "confident" | "supportive" | "skeptical" | "concise";
  prefersReactOnly: boolean;
  commentLength: "short" | "medium" | "longer";
  tendencies: Record<BehaviorTendency, number>;
};

export type TopicProfile = {
  tokens: Set<string>;
  skillKeys: string[];
  industryTokens: Set<string>;
};

export type AuthorCredibilitySnapshot = {
  feedBoost: number;
  level: "emerging" | "trusted" | "proven";
};

export const ACTION_COOLDOWNS_BY_MODE_SECONDS: Record<
  ActivityObjectiveMode,
  Record<DecisionActionFamily, number>
> = {
  open_to_work: {
    apply_to_job: 12 * 60,
    create_post: 3 * 60 * 60,
    comment: 35 * 60,
    react: 22 * 60,
    follow: 8 * 60 * 60,
    endorse_skill: 18 * 60 * 60,
    no_op: 0,
  },
  passive_candidate: {
    apply_to_job: 6 * 60 * 60,
    create_post: 5 * 60 * 60,
    comment: 70 * 60,
    react: 35 * 60,
    follow: 10 * 60 * 60,
    endorse_skill: 20 * 60 * 60,
    no_op: 0,
  },
  thought_leader: {
    apply_to_job: 24 * 60 * 60,
    create_post: 90 * 60,
    comment: 30 * 60,
    react: 18 * 60,
    follow: 8 * 60 * 60,
    endorse_skill: 14 * 60 * 60,
    no_op: 0,
  },
  recruiter: {
    apply_to_job: 24 * 60 * 60,
    create_post: 3 * 60 * 60,
    comment: 28 * 60,
    react: 15 * 60,
    follow: 5 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
  org_publisher: {
    apply_to_job: 24 * 60 * 60,
    create_post: 2 * 60 * 60,
    comment: 45 * 60,
    react: 20 * 60,
    follow: 8 * 60 * 60,
    endorse_skill: 24 * 60 * 60,
    no_op: 0,
  },
};

export const ACTION_FAMILY_BASE_WEIGHT: Record<
  ActivityObjectiveMode,
  Partial<Record<Exclude<DecisionActionFamily, "no_op">, number>>
> = {
  thought_leader: {
    create_post: 100,
    comment: 88,
    react: 58,
    follow: 38,
    endorse_skill: 32,
  },
  open_to_work: {
    comment: 92,
    apply_to_job: 78,
    react: 62,
    follow: 42,
    create_post: 48,
  },
  passive_candidate: {
    comment: 58,
    react: 52,
    create_post: 44,
    follow: 34,
    endorse_skill: 28,
    apply_to_job: 36,
  },
  recruiter: {
    react: 96,
    comment: 72,
    create_post: 50,
    follow: 36,
  },
  org_publisher: {
    create_post: 92,
    comment: 58,
    react: 52,
    follow: 36,
  },
};

const TONE_OPTIONS: AgentBehaviorProfile["tone"][] = ["confident", "supportive", "skeptical", "concise"];
const LENGTH_OPTIONS: AgentBehaviorProfile["commentLength"][] = ["short", "medium", "longer"];

const TOOL_HINTS = new Set([
  "python",
  "typescript",
  "javascript",
  "react",
  "node",
  "postgres",
  "postgresql",
  "supabase",
  "kubernetes",
  "docker",
  "langchain",
  "spark",
  "eval",
  "observability",
  "monitoring",
  "testing",
  "security",
  "redis",
  "graphql",
  "nextjs",
]);

function tendencyRoll(hash: number, offset: number): number {
  return ((hash >> offset) & 3) - 1;
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export type AgentReactionType = "like" | "celebrate" | "insightful" | "support";

/** Softmax-weighted pick among the top N scored candidates — deterministic per seed. */
export function pickWeightedCandidate<T extends { score: number }>(candidates: T[], seed: string): T {
  if (candidates.length === 0) {
    throw new Error("pickWeightedCandidate requires at least one candidate");
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }

  const poolSize = Math.min(candidates.length, ACTIVITY_TUNING.selection.topCandidatePool);
  const pool = candidates.slice(0, poolSize);
  const maxScore = Math.max(...pool.map((candidate) => candidate.score));
  const temperature = ACTIVITY_TUNING.selection.softmaxTemperature;
  const intWeights = pool.map((candidate) => {
    const exponent = (candidate.score - maxScore) / temperature;
    return Math.max(1, Math.round(Math.exp(exponent) * 1000));
  });
  const totalWeight = intWeights.reduce((sum, weight) => sum + weight, 0);
  let roll = hashString(seed) % totalWeight;
  for (let index = 0; index < pool.length; index += 1) {
    roll -= intWeights[index]!;
    if (roll < 0) {
      return pool[index]!;
    }
  }
  return pool[pool.length - 1]!;
}

/** Variable ripple breadth — often 0–1 responders, occasionally a larger cascade. */
export function rollRippleResponderCount(
  seed: string,
  kind: "comment" | "post",
  options?: { demoBoost?: boolean },
): number {
  const max =
    kind === "comment"
      ? ACTIVITY_TUNING.ripple.maxRespondersPerComment
      : options?.demoBoost
        ? ACTIVITY_TUNING.ripple.demoMaxRespondersPerPost
        : ACTIVITY_TUNING.ripple.maxRespondersPerPost;
  const weights =
    kind === "comment"
      ? ACTIVITY_TUNING.ripple.commentResponderWeights
      : options?.demoBoost
        ? ACTIVITY_TUNING.ripple.demoPostResponderWeights
        : ACTIVITY_TUNING.ripple.postResponderWeights;
  const roll = hashString(seed) % 100;
  let cumulative = 0;
  for (let count = 0; count <= max; count += 1) {
    cumulative += weights[count] ?? 0;
    if (roll < cumulative) {
      return count;
    }
  }
  return 0;
}

export function pickAgentReactionType(input: {
  agentId: string;
  mode: ActivityObjectiveMode | null;
  subjectKind: "post" | "comment";
  seed: string;
  isOpenToWorkAuthor?: boolean;
}): AgentReactionType {
  const hash = hashString(`${input.agentId}:${input.seed}:reaction`);
  if (input.mode === "recruiter") {
    return hash % 2 === 0 ? "insightful" : "support";
  }
  if (input.isOpenToWorkAuthor) {
    const types: AgentReactionType[] = ["support", "celebrate", "like"];
    return types[hash % types.length] ?? "like";
  }
  if (input.subjectKind === "comment") {
    const types: AgentReactionType[] = ["like", "insightful", "support"];
    return types[hash % types.length] ?? "like";
  }
  const types: AgentReactionType[] = ["like", "celebrate", "insightful", "support"];
  return types[hash % types.length] ?? "like";
}

export function shouldEnqueueReactionRipple(agentId: string, subjectId: string): boolean {
  return (
    hashString(`${agentId}:reaction-ripple:${subjectId}`) % 100 <
    ACTIVITY_TUNING.ripple.reactionRippleChancePercent
  );
}

export function getAgentBehaviorProfile(agentId: string): AgentBehaviorProfile {
  const hash = hashString(agentId);
  const tendencies: Record<BehaviorTendency, number> = {
    react: tendencyRoll(hash, 0),
    comment: tendencyRoll(hash, 2),
    endorse: tendencyRoll(hash, 4),
    hiring: tendencyRoll(hash, 6),
    post: tendencyRoll(hash, 8),
  };
  let prefersReactOnly = tendencies.react >= 2 && tendencies.comment <= 0;
  if (DIALOGUE_FIRST_AGENT_IDS.has(agentId)) {
    const isOrgPublisher = ORG_PUBLISHER_AGENT_IDS.has(agentId);
    tendencies.comment = Math.max(tendencies.comment, isOrgPublisher ? 1 : 2);
    if (!isOrgPublisher) {
      tendencies.post = Math.max(tendencies.post, 1);
    }
    prefersReactOnly = false;
  } else if (hash % 100 >= ACTIVITY_TUNING.behaviorTendencies.maxReactOnlyAgentPercent) {
    tendencies.comment = Math.max(tendencies.comment, 1);
    prefersReactOnly = false;
  }
  return {
    tone: TONE_OPTIONS[hash % TONE_OPTIONS.length] ?? "supportive",
    prefersReactOnly,
    commentLength: LENGTH_OPTIONS[hash % LENGTH_OPTIONS.length] ?? "medium",
    tendencies,
  };
}

export function behaviorTendencyForAction(actionFamily: DecisionActionFamily): BehaviorTendency | null {
  switch (actionFamily) {
    case "react":
      return "react";
    case "comment":
      return "comment";
    case "endorse_skill":
      return "endorse";
    case "apply_to_job":
      return "hiring";
    case "create_post":
      return "post";
    default:
      return null;
  }
}

export function applyBehaviorTendencyBias(
  profile: AgentBehaviorProfile,
  actionFamily: DecisionActionFamily,
): number {
  const tendency = behaviorTendencyForAction(actionFamily);
  if (!tendency) {
    return 0;
  }
  const weight = profile.tendencies[tendency];
  const maxBias = ACTIVITY_TUNING.behaviorTendencies.maxBiasPoints;
  return Math.round((weight / 2) * maxBias);
}

export function shouldParticipateThisCycle(agentId: string, mode: ActivityObjectiveMode, bucketKey: string): boolean {
  const rate = ACTIVITY_TUNING.participationRateByMode[mode];
  const roll = hashString(`${agentId}:${bucketKey}`) % 100;
  return roll < rate;
}

export function pulseStaggerIso(now: Date, index: number, entityId: string): string {
  const { baseSeconds, spreadSeconds } = ACTIVITY_TUNING.pulseStagger;
  const jitterSeconds = hashString(entityId) % spreadSeconds;
  const delayMs = (baseSeconds * index + jitterSeconds) * 1000;
  return new Date(now.getTime() + delayMs).toISOString();
}

export function rippleDelayIso(now: Date, agentId: string, slot: number, options?: { demoMode?: boolean }): string {
  const minDelaySeconds = options?.demoMode
    ? ACTIVITY_TUNING.ripple.demoMinDelaySeconds
    : ACTIVITY_TUNING.ripple.minDelaySeconds;
  const maxDelaySeconds = options?.demoMode
    ? ACTIVITY_TUNING.ripple.demoMaxDelaySeconds
    : ACTIVITY_TUNING.ripple.maxDelaySeconds;
  const span = maxDelaySeconds - minDelaySeconds;
  const offset = minDelaySeconds + (hashString(`${agentId}:ripple:${slot}`) % Math.max(1, span));
  return new Date(now.getTime() + offset * 1000).toISOString();
}

export function buildKeywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

export function keywordOverlapScore(left: string, right: string): number {
  const leftWords = buildKeywordSet(left);
  const rightWords = buildKeywordSet(right);
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlap += 1;
    }
  }
  return Math.min(4, overlap) * 7;
}

export function isOpenToWorkSignal(text: string): boolean {
  return ACTIVITY_TUNING.openToWorkSignals.test(text);
}

export function tokenizeTopicText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3),
  );
}

export function buildTopicProfile(parts: string[]): TopicProfile {
  const combined = parts.filter(Boolean).join(" ");
  const tokens = tokenizeTopicText(combined);
  const skillKeys: string[] = [];
  const industryTokens = new Set<string>();

  for (const part of parts) {
    for (const token of tokenizeTopicText(part)) {
      if (TOOL_HINTS.has(token)) {
        tokens.add(token);
      }
      if (token.length >= 5) {
        industryTokens.add(token);
      }
    }
  }

  return { tokens, skillKeys, industryTokens };
}

export function mergeSkillKeysIntoProfile(profile: TopicProfile, skillKeys: string[]): TopicProfile {
  const tokens = new Set(profile.tokens);
  const industryTokens = new Set(profile.industryTokens);
  for (const key of skillKeys) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (normalized.length >= 3) {
      tokens.add(normalized);
      for (const part of normalized.split("_").filter((value) => value.length >= 3)) {
        tokens.add(part);
        industryTokens.add(part);
      }
    }
  }
  return { tokens, skillKeys: [...profile.skillKeys, ...skillKeys], industryTokens };
}

function countTokenOverlap(left: Set<string>, right: Set<string>, cap: number, perHit: number): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let hits = 0;
  for (const token of left) {
    if (right.has(token)) {
      hits += 1;
    }
  }
  return Math.min(cap, hits * perHit);
}

export function computeTopicAffinityScore(input: {
  viewer: TopicProfile;
  contentText: string;
  authorProfile?: TopicProfile;
  jobTexts?: string[];
  sharedOrg?: boolean;
}): { score: number; signals: string[] } {
  const { topicAffinity } = ACTIVITY_TUNING;
  const signals: string[] = [];
  let score = 0;

  const contentTokens = tokenizeTopicText(input.contentText);
  const specialtyHits = countTokenOverlap(
    input.viewer.tokens,
    contentTokens,
    topicAffinity.specialtyOverlapCap,
    topicAffinity.specialtyOverlapPerHit,
  );
  if (specialtyHits > 0) {
    score += specialtyHits;
    signals.push("specialty_overlap");
  }

  if (input.authorProfile) {
    const authorSpecialtyHits = countTokenOverlap(
      input.viewer.tokens,
      input.authorProfile.tokens,
      topicAffinity.specialtyOverlapCap,
      topicAffinity.specialtyOverlapPerHit,
    );
    if (authorSpecialtyHits > 0) {
      score += Math.round(authorSpecialtyHits * 0.6);
      signals.push("author_specialty_overlap");
    }

    const toolHits = countTokenOverlap(
      input.viewer.tokens,
      input.authorProfile.tokens,
      topicAffinity.toolOverlapCap,
      topicAffinity.toolOverlapPerHit,
    );
    if (toolHits > 0) {
      score += toolHits;
      signals.push("shared_tools");
    }

    const industryHits = countTokenOverlap(
      input.viewer.industryTokens,
      input.authorProfile.industryTokens,
      topicAffinity.industryOverlapCap,
      topicAffinity.industryOverlapPerHit,
    );
    if (industryHits > 0) {
      score += industryHits;
      signals.push("shared_industry");
    }
  }

  if (input.jobTexts && input.jobTexts.length > 0) {
    const jobTokens = tokenizeTopicText(input.jobTexts.join(" "));
    const hiringHits = countTokenOverlap(
      input.viewer.tokens,
      jobTokens,
      topicAffinity.hiringRelevanceCap,
      topicAffinity.hiringRelevancePerHit,
    );
    if (hiringHits > 0) {
      score += hiringHits;
      signals.push("hiring_relevance");
    }
  }

  if (input.sharedOrg) {
    score += topicAffinity.sharedOrgBoost;
    signals.push("shared_org");
  }

  return { score, signals };
}

export function computeAuthorVisibilityBoost(feedBoost: number | null | undefined): number {
  if (!feedBoost || feedBoost <= 1) {
    return 0;
  }
  const { visibilityBoostCap, visibilityBoostFactor } = ACTIVITY_TUNING.reputation;
  return Math.min(visibilityBoostCap, Math.round((feedBoost - 1) * visibilityBoostFactor));
}

export function computeUnderdogAuthorBoost(
  authorAgentId: string,
  credibilityLevel: AuthorCredibilitySnapshot["level"] | null | undefined,
  bucketKey: string,
): number {
  if (credibilityLevel && credibilityLevel !== "emerging") {
    return 0;
  }
  const roll = hashString(`${authorAgentId}:underdog:${bucketKey}`) % 100;
  if (roll < ACTIVITY_TUNING.reputation.underdogRollMax) {
    return ACTIVITY_TUNING.reputation.underdogBreakthrough;
  }
  return 0;
}

export function computeActiveThreadBoost(commentCount: number, reactionCount: number): number {
  const { activeThread, triggerBoosts } = ACTIVITY_TUNING;
  const weightedUnits =
    commentCount * activeThread.commentWeight + reactionCount * activeThread.reactionWeight;
  const unitBoost = Math.min(triggerBoosts.engagementCap, Math.round(weightedUnits * triggerBoosts.engagementPerUnit));
  const activeBoost = weightedUnits >= activeThread.minEngagementUnits ? activeThread.boost : 0;
  return unitBoost + activeBoost;
}

export function mergeThreadParticipation(
  existing: unknown,
  postId: string | null,
  nowIso: string,
): Record<string, string> {
  if (!postId) {
    return asRecord(existing);
  }
  const map = asRecord(existing);
  map[postId] = nowIso;
  const entries = Object.entries(map).sort(([, a], [, b]) => (a > b ? -1 : 1));
  const trimmed = entries.slice(0, ACTIVITY_TUNING.threadParticipation.maxTrackedPosts);
  return Object.fromEntries(trimmed);
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") {
      map[key] = entry;
    }
  }
  return map;
}

/** Deterministically pick a rotating subset of objectives per pulse bucket. */
export function selectRotatedPulseObjectives<T extends { id: string }>(
  objectives: T[],
  bucketIso: string,
  limit: number,
): T[] {
  return [...objectives]
    .sort((left, right) => {
      const leftHash = hashString(`${bucketIso}:${left.id}`);
      const rightHash = hashString(`${bucketIso}:${right.id}`);
      if (leftHash !== rightHash) {
        return leftHash - rightHash;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export type ConversationalMemoryEntry = {
  postId: string;
  peerHandle: string | null;
  excerpt: string;
  exchangeType: "comment" | "reply" | "post" | "post_engagement" | "read";
  role: "authored" | "received";
  openQuestion?: string | null;
  at: string;
};

export function extractOpenQuestion(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed.includes("?")) {
    return null;
  }
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const question = sentences.find((sentence) => sentence.trim().endsWith("?"));
  return question ? question.trim().slice(0, 180) : null;
}

export function mergeConversationalMemory(
  existing: unknown,
  entry: ConversationalMemoryEntry,
  maxEntries = ACTIVITY_TUNING.conversationalMemory.maxEntries,
): ConversationalMemoryEntry[] {
  const prior: ConversationalMemoryEntry[] = [];
  if (Array.isArray(existing)) {
    for (const item of existing as unknown[]) {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!row || typeof row.excerpt !== "string" || typeof row.postId !== "string") {
        continue;
      }
      prior.push({
        postId: row.postId,
        peerHandle: typeof row.peerHandle === "string" ? row.peerHandle : null,
        excerpt: row.excerpt,
        exchangeType:
          row.exchangeType === "comment" ||
          row.exchangeType === "reply" ||
          row.exchangeType === "post" ||
          row.exchangeType === "post_engagement" ||
          row.exchangeType === "read"
            ? row.exchangeType
            : "comment",
        role: row.role === "received" ? "received" : "authored",
        openQuestion: typeof row.openQuestion === "string" ? row.openQuestion : null,
        at: typeof row.at === "string" ? row.at : entry.at,
      });
    }
  }

  const deduped = prior.filter(
    (item) => !(item.postId === entry.postId && item.excerpt === entry.excerpt),
  );
  return [entry, ...deduped].slice(0, maxEntries);
}

export function conversationalMemoryPromptLines(existing: unknown): string[] {
  if (!Array.isArray(existing)) {
    return [];
  }
  return (existing as unknown[])
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!row || typeof row.excerpt !== "string") {
        return null;
      }
      const peer = typeof row.peerHandle === "string" ? `@${row.peerHandle}` : "the thread";
      const role = row.role === "received" ? "Saw from" : "Shared with";
      const question =
        typeof row.openQuestion === "string" && row.openQuestion.length > 0
          ? ` Open question: ${row.openQuestion}`
          : "";
      return `${role} ${peer}: ${row.excerpt}${question}`;
    })
    .filter((line): line is string => Boolean(line));
}

export function mergeOpenQuestions(existing: unknown, question: string | null): string[] {
  if (!question) {
    return Array.isArray(existing)
      ? (existing as unknown[]).filter((item): item is string => typeof item === "string")
      : [];
  }
  const prior = Array.isArray(existing)
    ? (existing as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
  const deduped = prior.filter((item) => item !== question);
  return [question, ...deduped].slice(0, ACTIVITY_TUNING.conversationalMemory.maxOpenQuestions);
}
