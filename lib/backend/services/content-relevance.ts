import { humanWorldRelevanceBonus } from "./content-human-world";
import {
  isSurfaceAnchoredReply,
  type ReplySemanticContext,
  wouldReplySurviveParaphrase,
} from "./content-semantic-anchoring";

/** Lightweight keyword set for overlap checks — kept local so fixtures run without server-only imports. */
function buildKeywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

/** Tunable thresholds for reply relevance — adjust without touching core logic. */
export const REPLY_QUALITY_TUNING = {
  /** Minimum relevance score (0–1) to accept a generated reply without retry. */
  minPassScore: 0.6,
  /** Minimum shared keywords (length ≥ 4) with parent comment for thread replies. */
  minParentKeywordHits: 1,
  /** Minimum shared keywords with root post for top-level comments. */
  minPostKeywordHits: 1,
  /** Max jargon phrase hits before penalizing heavily. */
  maxJargonHitsBeforeFail: 2,
  /** Jaccard-like overlap above this vs a thread excerpt counts as repetition. */
  threadRepetitionOverlap: 0.62,
  /** Penalty per jargon phrase hit. */
  jargonPenalty: 0.18,
  /** Penalty when reply lacks parent/post anchor keywords. */
  missingAnchorPenalty: 0.42,
  /** Penalty when reply largely repeats an existing thread comment. */
  repetitionPenalty: 0.38,
  /** Penalty when reply anchors to formatting/wording instead of substance. */
  surfaceAnchorPenalty: 0.48,
  /** Penalty when reply would not survive parent paraphrase. */
  paraphraseWeakPenalty: 0.35,
} as const;

/** Phrases that read as dense AI-network jargon — penalized in relevance scoring. */
export const COMMENT_JARGON_PHRASES = [
  /\bmulti-agent orchestration\b/i,
  /\bsignal alignment\b/i,
  /\bcapability surfaces?\b/i,
  /\bevaluation substrate\b/i,
  /\bworkflow primitives?\b/i,
  /\bemergent market dynamics?\b/i,
  /\bagentic labor graph\b/i,
  /\borchestration substrate\b/i,
  /\blabor graph\b/i,
  /\bcapability surface area\b/i,
  /\boperator move framing\b/i,
  /\bbounded decision loops?\b/i,
  /\bprotocol choreography\b/i,
  /\bhandoff clarity surfaces?\b/i,
  /\bcontext substrate\b/i,
  /\bagentic workflow primitives?\b/i,
] as const;

export type ReplyRelevanceInput = {
  reply: string;
  isReply: boolean;
  parentExcerpt?: string | null;
  postExcerpt: string;
  threadExcerpts?: string[];
  semantic?: ReplySemanticContext | null;
};

export type ReplyRelevanceContext = Omit<ReplyRelevanceInput, "reply">;

export type ReplyRelevanceResult = {
  score: number;
  pass: boolean;
  checks: string[];
};

function countKeywordOverlap(left: string, right: string, minWordLength = 4): number {
  const leftWords = [...buildKeywordSet(left)].filter((word) => word.length >= minWordLength);
  const rightWords = buildKeywordSet(right);
  if (leftWords.length === 0 || rightWords.size === 0) {
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

function tokenSet(text: string): Set<string> {
  return buildKeywordSet(text);
}

function overlapRatio(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
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

export function countJargonPhrases(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of COMMENT_JARGON_PHRASES) {
    if (pattern.test(text)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

export function isThreadRepetition(reply: string, threadExcerpts: string[]): boolean {
  for (const excerpt of threadExcerpts) {
    if (overlapRatio(reply, excerpt) >= REPLY_QUALITY_TUNING.threadRepetitionOverlap) {
      return true;
    }
  }
  return false;
}

/** Lightweight heuristic relevance check before persisting a generated comment. */
export function evaluateReplyRelevance(input: ReplyRelevanceInput): ReplyRelevanceResult {
  const checks: string[] = [];
  let score = 1;
  const reply = input.reply.trim();
  const threadExcerpts = input.threadExcerpts ?? [];
  const { minPassScore, minParentKeywordHits, minPostKeywordHits, maxJargonHitsBeforeFail } =
    REPLY_QUALITY_TUNING;

  const jargonHits = countJargonPhrases(reply);
  if (jargonHits.length > 0) {
    score -= Math.min(0.55, jargonHits.length * REPLY_QUALITY_TUNING.jargonPenalty);
    checks.push(`jargon:${jargonHits.join("|")}`);
  }
  if (jargonHits.length > maxJargonHitsBeforeFail) {
    score -= 0.2;
    checks.push("jargon_overload");
  }

  if (input.isReply && input.parentExcerpt) {
    const parentHits = countKeywordOverlap(reply, input.parentExcerpt);
    if (parentHits < minParentKeywordHits) {
      score -= REPLY_QUALITY_TUNING.missingAnchorPenalty;
      checks.push(`weak_parent_anchor:${parentHits}`);
    } else {
      checks.push(`parent_anchor:${parentHits}`);
    }
    const postHits = countKeywordOverlap(reply, input.postExcerpt);
    if (postHits === 0 && parentHits < 2) {
      score -= 0.12;
      checks.push("weak_post_context");
    }
  } else {
    const postHits = countKeywordOverlap(reply, input.postExcerpt);
    if (postHits < minPostKeywordHits) {
      score -= REPLY_QUALITY_TUNING.missingAnchorPenalty;
      checks.push(`weak_post_anchor:${postHits}`);
    } else {
      checks.push(`post_anchor:${postHits}`);
    }
  }

  if (threadExcerpts.length > 0 && isThreadRepetition(reply, threadExcerpts)) {
    score -= REPLY_QUALITY_TUNING.repetitionPenalty;
    checks.push("thread_repetition");
  }

  if (input.isReply && input.parentExcerpt) {
    const parentHits = countKeywordOverlap(reply, input.parentExcerpt);
    const semantic = input.semantic ?? null;
    if (isSurfaceAnchoredReply(reply, input.parentExcerpt, semantic)) {
      score -= REPLY_QUALITY_TUNING.surfaceAnchorPenalty;
      checks.push("surface_anchor");
    }
    if (semantic && !wouldReplySurviveParaphrase(reply, semantic)) {
      score -= REPLY_QUALITY_TUNING.paraphraseWeakPenalty;
      checks.push("paraphrase_weak");
    }
    if (semantic && semantic.parent_topics.length >= 1) {
      const topicAnchored = semantic.parent_topics.some((topic) => {
        const words = topic
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((word) => word.length >= 4);
        return words.some((word) => reply.toLowerCase().includes(word));
      });
      if (!topicAnchored && parentHits < 2) {
        score -= 0.22;
        checks.push("weak_topic_anchor");
      }
    }
  }

  const wordCount = reply.split(/\s+/).filter(Boolean).length;
  if (wordCount > 85) {
    score -= 0.15;
    checks.push("overlong_reply");
  }

  const humanWorldBonus = humanWorldRelevanceBonus({
    reply,
    parentExcerpt: input.parentExcerpt,
    postExcerpt: input.postExcerpt,
  });
  if (humanWorldBonus > 0) {
    score += humanWorldBonus;
    checks.push(`human_world_bonus:${humanWorldBonus.toFixed(2)}`);
  }

  score = Math.max(0, Math.min(1, score));
  const hardFail =
    checks.includes("surface_anchor") ||
    checks.includes("paraphrase_weak") ||
    checks.includes("thread_repetition") ||
    checks.includes("jargon_overload");
  const pass =
    score >= minPassScore && jargonHits.length <= maxJargonHitsBeforeFail && !hardFail;

  return { score, pass, checks };
}

export const PLAIN_LANGUAGE_STYLE_RULES = [
  "Write like a smart colleague on a professional network — not a dense academic abstract.",
  "Use short sentences, concrete examples, and simple technical terms.",
  "Respond to the underlying idea in the parent comment — not its formatting, word choice, or list structure.",
  "Natural disagreement is fine; vague meta-language is not.",
  "Avoid: multi-agent orchestration, signal alignment, capability surfaces, evaluation substrate, workflow primitives, emergent market dynamics, agentic labor graph.",
] as const;

export type { ReplySemanticContext } from "./content-semantic-anchoring";
export {
  extractReplySemanticContext,
  isSurfaceAnchoredReply,
  wouldReplySurviveParaphrase,
} from "./content-semantic-anchoring";
