/**
 * Reply target selection and pre-generation gates — in-memory only, no schema.
 * Classifies whether a comment merits a substantive reply before generation runs.
 */

import {
  detectIntentFromText,
  extractTopicsFromParent,
  type ParentIntent,
} from "@/lib/backend/services/content-semantic-anchoring";
import { countHumanWorldKeywords } from "@/lib/backend/services/content-human-world";

function buildKeywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function keywordOverlapScore(left: string, right: string): number {
  const leftWords = buildKeywordSet(left);
  const rightWords = buildKeywordSet(right);
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }
  let hits = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      hits += 1;
    }
  }
  return hits;
}

export type ReplyWorthinessClass = "good_reply_target" | "weak_reply_target" | "no_reply_target";

export const REPLY_INTENTS = [
  "clarify",
  "add_concrete_example",
  "agree_with_nuance",
  "disagree_respectfully",
  "ask_useful_follow_up",
  "recruiter_signal",
  "endorsement_support",
  "application_hiring_relevance",
  "human_context_bridge",
] as const;

export type ReplyIntent = (typeof REPLY_INTENTS)[number];

export type ReplyWorthinessInput = {
  commentBody: string;
  postBody?: string;
  agentProfileText: string;
  authorAgentId: string;
  replyingAgentId: string;
  siblingReplies?: string[];
  objectiveMode?: string | null;
};

export type ReplyWorthinessResult = {
  class: ReplyWorthinessClass;
  reasons: string[];
  agentFitScore: number;
  hasSubstantiveSignal: boolean;
  parentIntent: ParentIntent;
  parentTopics: string[];
};

const NO_REPLY_PATTERNS = [
  /^(great|nice|good|awesome|amazing|love|loved|well said|so true|spot on|congrats|congratulations)\b/i,
  /^(thanks|thank you|thx|noted|acknowledged)\b[.!]*$/i,
  /^(agree|agreed|exactly|same here|\+1|yep|yeah|this|co-?signed)\b[.!]*$/i,
  /^(keep it up|you got this|rooting for you|well done)\b/i,
  /\b(nice phrasing|great formatting|well structured|good framework|love the bullets)\b/i,
  /\b(this resonates|great insight|strong point|thanks for sharing|love this)\b/i,
] as const;

const WEAK_REPLY_PATTERNS = [
  /\b(good point|fair point|makes sense|interesting|helpful|useful)\b/i,
  /\b(i like (this|that|it)|appreciate (this|that|the))\b/i,
  /\b(nice (that|how)|glad (you|to))\b/i,
  // validation-only patterns: "I like the '...' framing" / "I appreciate the '...' angle"
  /\bi like (the|this|that) ['""]?[a-z]/i,
  /\bi appreciate (the|this|that) ['""]?[a-z]/i,
  /\bthe ['""]?.{4,50}['""]? framing\b/i,
] as const;

const SUBSTANTIVE_INTENTS = new Set<ParentIntent>([
  "advice",
  "critique",
  "hiring_signal",
  "question",
  "clarification",
  "example",
]);

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function hasQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim()) || /\b(how|why|what|when|where|who|which|does|can|should)\b/i.test(text);
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function overlapRatio(left: string, right: string): number {
  const leftTokens = buildKeywordSet(left);
  const rightTokens = buildKeywordSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

export function countSimilarSiblingReplies(parentBody: string, siblingReplies: string[]): number {
  let similar = 0;
  for (const reply of siblingReplies) {
    if (overlapRatio(parentBody, reply) >= 0.45 || overlapRatio(reply, parentBody) >= 0.55) {
      similar += 1;
    }
  }
  return similar;
}

function computeAgentFit(commentBody: string, postBody: string, agentProfileText: string): number {
  const anchor = [commentBody, postBody].filter(Boolean).join(" ");
  return keywordOverlapScore(agentProfileText, anchor);
}

function isFormattingOnlyObservation(text: string, topics: string[]): boolean {
  const lower = text.toLowerCase();
  const formatTerms = /\b(bullet|list|framework|phrasing|format|structure|wording|outline)\b/i.test(lower);
  const hasSubstance = topics.length >= 2 || hasQuestion(text);
  return formatTerms && !hasSubstance && wordCount(text) < 18;
}

function isCompleteStatementWithNoOpening(text: string, intent: ParentIntent): boolean {
  const words = wordCount(text);
  if (words <= 6 && !hasQuestion(text) && intent === "agreement") {
    return true;
  }
  if (words <= 4 && !hasQuestion(text)) {
    return true;
  }
  return false;
}

export function classifyReplyWorthiness(input: ReplyWorthinessInput): ReplyWorthinessResult {
  const commentBody = normalize(input.commentBody);
  const reasons: string[] = [];

  if (input.authorAgentId === input.replyingAgentId) {
    return {
      class: "no_reply_target",
      reasons: ["self_author"],
      agentFitScore: 0,
      hasSubstantiveSignal: false,
      parentIntent: "observation",
      parentTopics: [],
    };
  }

  if (!commentBody || commentBody.length < 3) {
    return {
      class: "no_reply_target",
      reasons: ["empty_comment"],
      agentFitScore: 0,
      hasSubstantiveSignal: false,
      parentIntent: "observation",
      parentTopics: [],
    };
  }

  const parentIntent = detectIntentFromText(commentBody);
  const parentTopics = extractTopicsFromParent(commentBody);
  const agentFitScore = computeAgentFit(commentBody, input.postBody ?? "", input.agentProfileText);
  const siblingReplies = input.siblingReplies ?? [];
  const similarCount = countSimilarSiblingReplies(commentBody, siblingReplies);

  const hasSubstantiveSignal =
    hasQuestion(commentBody) ||
    SUBSTANTIVE_INTENTS.has(parentIntent) ||
    parentTopics.length >= 2 ||
    (parentTopics.length >= 1 && wordCount(commentBody) >= 12);

  if (matchesAny(commentBody, NO_REPLY_PATTERNS)) {
    reasons.push("generic_or_meta");
    return {
      class: "no_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (isFormattingOnlyObservation(commentBody, parentTopics)) {
    reasons.push("formatting_only");
    return {
      class: "no_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal: false,
      parentIntent,
      parentTopics,
    };
  }

  if (isCompleteStatementWithNoOpening(commentBody, parentIntent)) {
    reasons.push("no_opening");
    return {
      class: "no_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (similarCount >= 3) {
    reasons.push(`similar_replies:${similarCount}`);
    return {
      class: "no_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (!hasSubstantiveSignal) {
    reasons.push("low_substance");
    return {
      class: "no_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal: false,
      parentIntent,
      parentTopics,
    };
  }

  if (agentFitScore === 0 && parentIntent !== "hiring_signal" && input.objectiveMode !== "recruiter") {
    reasons.push("low_agent_fit");
    return {
      class: "weak_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (matchesAny(commentBody, WEAK_REPLY_PATTERNS) && parentTopics.length < 2 && !hasQuestion(commentBody)) {
    reasons.push("weak_agreement");
    return {
      class: "weak_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (similarCount >= 2) {
    reasons.push(`crowded_thread:${similarCount}`);
    return {
      class: "weak_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  if (parentIntent === "agreement" && wordCount(commentBody) < 10 && !hasQuestion(commentBody)) {
    reasons.push("thin_agreement");
    return {
      class: "weak_reply_target",
      reasons,
      agentFitScore,
      hasSubstantiveSignal,
      parentIntent,
      parentTopics,
    };
  }

  reasons.push("substantive_signal");
  if (agentFitScore > 0) {
    reasons.push("agent_fit");
  }
  return {
    class: "good_reply_target",
    reasons,
    agentFitScore,
    hasSubstantiveSignal,
    parentIntent,
    parentTopics,
  };
}

export function buildPostSummary(postExcerpt: string): string {
  const text = normalize(postExcerpt);
  if (text.length <= 120) {
    return text;
  }
  const sentenceEnd = text.slice(0, 140).search(/[.!?]\s/);
  if (sentenceEnd > 40) {
    return text.slice(0, sentenceEnd + 1).trim();
  }
  return `${text.slice(0, 117).trim()}…`;
}

export function buildThreadTopicSummary(postExcerpt: string, threadExcerpts: string[]): string {
  const postHook = buildPostSummary(postExcerpt);
  if (threadExcerpts.length === 0) {
    return `Discussion on: ${postHook}`;
  }
  const topics = new Set<string>();
  for (const excerpt of threadExcerpts.slice(-3)) {
    for (const topic of extractTopicsFromParent(excerpt).slice(0, 2)) {
      topics.add(topic);
    }
  }
  const topicLabel = topics.size > 0 ? Array.from(topics).slice(0, 3).join(", ") : "thread follow-ups";
  return `Thread about ${postHook} — active angles: ${topicLabel}`;
}

export function buildReplyQualificationReason(input: {
  worthiness: ReplyWorthinessResult;
  topicOverlap: string | null;
  objectiveMode: string | null;
  parentIntent: ParentIntent;
}): string {
  const parts: string[] = [];
  if (input.topicOverlap) {
    parts.push(`shared focus (${input.topicOverlap})`);
  }
  if (input.worthiness.agentFitScore > 0) {
    parts.push("matches your specialties");
  }
  if (input.parentIntent === "hiring_signal" || input.objectiveMode === "recruiter") {
    parts.push("hiring-relevant signal in thread");
  }
  if (input.parentIntent === "question") {
    parts.push("parent asked something you can answer");
  }
  if (input.parentIntent === "advice" || input.parentIntent === "example") {
    parts.push("can add a concrete angle");
  }
  if (parts.length === 0) {
    return "thread topic aligns enough to add one useful point";
  }
  return parts.slice(0, 2).join("; ");
}

export function pickReplyIntent(input: {
  parentIntent: ParentIntent;
  objectiveMode: string | null;
  worthiness: ReplyWorthinessResult;
  varietySeed: string;
  parentExcerpt?: string | null;
}): ReplyIntent {
  const { parentIntent, objectiveMode, worthiness } = input;
  let hash = 0;
  for (let index = 0; index < input.varietySeed.length; index += 1) {
    hash = (hash * 31 + input.varietySeed.charCodeAt(index)) >>> 0;
  }

  if (parentIntent === "hiring_signal" || objectiveMode === "recruiter") {
    const pool: ReplyIntent[] = ["recruiter_signal", "application_hiring_relevance", "ask_useful_follow_up"];
    return pool[hash % pool.length] ?? "recruiter_signal";
  }
  if (parentIntent === "question" || parentIntent === "clarification") {
    const pool: ReplyIntent[] = ["clarify", "ask_useful_follow_up", "add_concrete_example"];
    return pool[hash % pool.length] ?? "clarify";
  }
  if (parentIntent === "critique") {
    const pool: ReplyIntent[] = ["disagree_respectfully", "agree_with_nuance", "add_concrete_example"];
    return pool[hash % pool.length] ?? "disagree_respectfully";
  }
  if (parentIntent === "agreement") {
    const pool: ReplyIntent[] = ["agree_with_nuance", "add_concrete_example", "endorsement_support"];
    return pool[hash % pool.length] ?? "agree_with_nuance";
  }
  if (parentIntent === "advice" || parentIntent === "example") {
    const pool: ReplyIntent[] = ["add_concrete_example", "agree_with_nuance", "ask_useful_follow_up"];
    return pool[hash % pool.length] ?? "add_concrete_example";
  }
  const parentText = input.parentExcerpt ?? "";
  if (countHumanWorldKeywords(parentText) >= 2) {
    const pool: ReplyIntent[] = ["human_context_bridge", "add_concrete_example", "ask_useful_follow_up"];
    return pool[hash % pool.length] ?? "human_context_bridge";
  }
  if (worthiness.agentFitScore > 0) {
    const pool: ReplyIntent[] = ["add_concrete_example", "agree_with_nuance", "ask_useful_follow_up"];
    return pool[hash % pool.length] ?? "add_concrete_example";
  }
  return "agree_with_nuance";
}

export function replyIntentInstruction(intent: ReplyIntent): string {
  switch (intent) {
    case "clarify":
      return "Reply intent: clarify — answer or unpack one unclear part of the parent comment in plain language.";
    case "add_concrete_example":
      return "Reply intent: add concrete example — one specific tactic, outcome, or situation; no abstractions.";
    case "agree_with_nuance":
      return "Reply intent: agree with nuance — in ONE clause, acknowledge what the parent got right without quoting or restating their words; then immediately add your own specific example, lived consequence, or counter-consideration. The value must come from the second part, not the first.";
    case "disagree_respectfully":
      return "Reply intent: disagree respectfully — push back on one claim with a brief reason.";
    case "ask_useful_follow_up":
      return "Reply intent: ask useful follow-up — one genuine question that moves the thread forward.";
    case "recruiter_signal":
      return "Reply intent: recruiter signal — brief note on fit, timing, or who should see this.";
    case "endorsement_support":
      return "Reply intent: endorsement/support — validate a specific skill or decision, not generic praise.";
    case "application_hiring_relevance":
      return "Reply intent: application/hiring relevance — connect parent point to role fit or hiring context.";
    case "human_context_bridge":
      return "Reply intent: human context bridge — tie the technical point to operator, team, budget, or trust impact in plain language.";
    default:
      return "Reply intent: respond to the parent claim with one clear idea.";
  }
}

export function worthinessScoreBoost(worthiness: ReplyWorthinessResult): number {
  if (worthiness.class === "good_reply_target") {
    return 14 + Math.min(8, worthiness.agentFitScore * 2);
  }
  if (worthiness.class === "weak_reply_target") {
    return -22;
  }
  return -40;
}
