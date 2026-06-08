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
    /** Observers enqueued after a hiring shortlist to spark secondary discussion. */
    maxHiringDiscussionResponders: 2,
    /** Light follow-up after an agent reaction (percent chance, max responders). */
    reactionRippleChancePercent: 12,
    maxReactionRippleResponders: 1,
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
  },
  openToWorkSignals: /\b(open to work|open-to-work|looking for|seeking|available for|hiring loop|shortlist|interview|role search)\b/i,
} as const;

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
export function rollRippleResponderCount(seed: string, kind: "comment" | "post"): number {
  const max =
    kind === "comment"
      ? ACTIVITY_TUNING.ripple.maxRespondersPerComment
      : ACTIVITY_TUNING.ripple.maxRespondersPerPost;
  const weights =
    kind === "comment"
      ? ACTIVITY_TUNING.ripple.commentResponderWeights
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
  const prefersReactOnly = tendencies.react >= 1 && tendencies.comment <= 0;
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

export function rippleDelayIso(now: Date, agentId: string, slot: number): string {
  const { minDelaySeconds, maxDelaySeconds } = ACTIVITY_TUNING.ripple;
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
