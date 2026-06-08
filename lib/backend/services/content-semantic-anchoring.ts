/**
 * Lightweight semantic extraction for reply generation — in-memory only, no schema.
 * Derives meaning from parent comments so replies engage ideas, not surface wording.
 */

export const PARENT_INTENTS = [
  "advice",
  "agreement",
  "critique",
  "hiring_signal",
  "question",
  "clarification",
  "observation",
  "example",
] as const;

export type ParentIntent = (typeof PARENT_INTENTS)[number];

export type ReplySemanticContext = {
  parent_claim: string;
  parent_intent: ParentIntent;
  parent_topics: string[];
  thread_context: string;
  reply_target: string;
};

/** Words that signal formatting/meta commentary — not substantive topics. */
const SURFACE_ANCHOR_TERMS = new Set([
  "bullets",
  "bullet",
  "framework",
  "frameworks",
  "list",
  "lists",
  "listing",
  "phrasing",
  "phrase",
  "phrases",
  "format",
  "formatting",
  "formatted",
  "structure",
  "structured",
  "outline",
  "outlined",
  "template",
  "templates",
  "wording",
  "word",
  "words",
  "syntax",
  "headline",
  "headlines",
  "section",
  "sections",
  "numbered",
  "checklist",
  "checklists",
  "explicitly",
  "explicit",
  "calling",
  "called",
  "gloss",
  "glossed",
  "meta",
]);

/** Regex patterns for surface-level reply commentary. */
export const SURFACE_ANCHOR_PATTERNS = [
  /\bbullet(s)?\b/i,
  /\bframework(s)?\b/i,
  /\blist(ing|s)?\b/i,
  /\bphrasing\b/i,
  /\bword(ing| choice)?\b/i,
  /\bformat(ting|ted)?\b/i,
  /\bcalling (out|this)\b/i,
  /\bdidn'?t gloss over\b/i,
  /\bnice (that|how)\b/i,
  /\bstrong (framework|structure|format)\b/i,
  /\bwell (structured|framed|organized)\b/i,
  /\bgood (framework|list|format|structure)\b/i,
] as const;

const FORMAT_META_PATTERNS = [
  /\b\d+\s+bullet/i,
  /\bin\s+\d+\s+(bullet|point|step)/i,
  /\b(bullet|numbered|ordered)\s+(list|points?|steps?)\b/i,
  /\bhow (to|you) (write|phrase|format|structure)\b/i,
  /\bwriting (tips?|advice|style)\b/i,
  /\bediting (tips?|advice)\b/i,
  /\bformat(ting)? (tips?|advice|guide)\b/i,
] as const;

const STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "being",
  "both",
  "could",
  "does",
  "each",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "look",
  "looks",
  "make",
  "many",
  "more",
  "most",
  "much",
  "need",
  "only",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "yours",
  "role",
  "fit",
  "good",
  "great",
  "nice",
  "harder",
  "than",
  "thing",
  "things",
  "part",
  "parts",
  "point",
  "points",
  "five",
  "four",
  "three",
  "first",
  "second",
  "third",
]);

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isFormatMetaComment(text: string, substantiveTopicCount = 0): boolean {
  const primaryFormatPatterns = [
    /\bhow (to|you) (write|phrase|format|structure)\b/i,
    /\bwriting (tips?|advice|style)\b/i,
    /\bediting (tips?|advice)\b/i,
    /\bformat(ting)? (tips?|advice|guide)\b/i,
  ];
  if (primaryFormatPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }
  const incidentalFormat = FORMAT_META_PATTERNS.some((pattern) => pattern.test(text));
  if (!incidentalFormat) {
    return false;
  }
  // "Role fit in 5 bullets: mission, failure modes…" uses format as delivery, not subject.
  return substantiveTopicCount < 2;
}

function detectIntent(text: string): ParentIntent {
  const lower = text.toLowerCase();
  if (/\?\s*$/.test(text.trim()) || /\b(how|why|what|when|where|who|which|does|do|is|are|can|could|should)\b/i.test(lower)) {
    if (/\?\s*$/.test(text.trim()) || lower.startsWith("how ") || lower.startsWith("why ") || lower.startsWith("what ")) {
      return "question";
    }
  }
  if (/\b(hiring|candidate|req|recruit|open role|job posting|talent)\b/i.test(lower)) {
    return "hiring_signal";
  }
  if (/\b(clarify|clarification|mean by|specifically|to be clear)\b/i.test(lower)) {
    return "clarification";
  }
  if (/\b(disagree|pushback|however|but i|not sure|skeptical|counter|wrong)\b/i.test(lower)) {
    return "critique";
  }
  if (/\b(agree|exactly|co-sign|co signed|same here|yep|yeah)\b/i.test(lower)) {
    return "agreement";
  }
  if (/\b(we tried|we saw|in my experience|last quarter|when i|example from)\b/i.test(lower)) {
    return "example";
  }
  if (/\b(should|recommend|try|consider|suggest|tip|best practice|worth)\b/i.test(lower)) {
    return "advice";
  }
  return "observation";
}

function cleanTopicPhrase(phrase: string): string | null {
  const cleaned = normalizeWhitespace(
    phrase
      .replace(/^[\d.\-•*]+\s*/, "")
      .replace(/[.!?]+$/, "")
      .trim(),
  );
  if (cleaned.length < 3) {
    return null;
  }
  const words = cleaned.toLowerCase().split(/\s+/);
  const substantive = words.filter((word) => !STOPWORDS.has(word) && !SURFACE_ANCHOR_TERMS.has(word));
  if (substantive.length === 0) {
    return null;
  }
  if (substantive.every((word) => SURFACE_ANCHOR_TERMS.has(word))) {
    return null;
  }
  return cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}…` : cleaned;
}

function extractTopicsFromParent(parentText: string): string[] {
  const text = normalizeWhitespace(parentText);
  const topics: string[] = [];
  const seen = new Set<string>();

  const addTopic = (raw: string) => {
    const topic = cleanTopicPhrase(raw);
    if (!topic) {
      return;
    }
    const key = topic.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    topics.push(topic);
  };

  const colonSplit = text.split(/:\s*/);
  if (colonSplit.length > 1) {
    const tail = colonSplit.slice(1).join(": ");
    for (const segment of tail.split(/[,;]|\band\b/i)) {
      addTopic(segment);
    }
  } else {
    for (const segment of text.split(/[,;]|\band\b/i)) {
      addTopic(segment);
    }
  }

  if (topics.length === 0) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5 && !STOPWORDS.has(word) && !SURFACE_ANCHOR_TERMS.has(word));
    for (const word of words.slice(0, 5)) {
      addTopic(word);
    }
  }

  return topics.slice(0, 5);
}

function buildParentClaim(parentText: string, topics: string[]): string {
  const text = normalizeWhitespace(parentText);
  if (topics.length >= 2) {
    const joined =
      topics.length <= 3
        ? topics.join(", ")
        : `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
    return `The comment is about ${joined}.`;
  }
  if (topics.length === 1) {
    return `The comment focuses on ${topics[0]}.`;
  }
  const stripped = text
    .replace(/\b(in \d+ bullets?|as a list|bullet points?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 12 ? stripped : `The comment raises: ${text}`;
}

function buildThreadContext(postExcerpt: string, threadExcerpts: string[]): string {
  const postHook = normalizeWhitespace(postExcerpt).slice(0, 120);
  if (threadExcerpts.length === 0) {
    return `Thread on a post about: ${postHook}`;
  }
  const recent = normalizeWhitespace(threadExcerpts[threadExcerpts.length - 1] ?? "").slice(0, 80);
  return `Ongoing thread on "${postHook}" with ${threadExcerpts.length} earlier comment(s); latest angle: ${recent}`;
}

function pickReplyTarget(topics: string[], varietySeed: string): string {
  if (topics.length === 0) {
    return "the main idea in the parent comment";
  }
  let hash = 0;
  for (let index = 0; index < varietySeed.length; index += 1) {
    hash = (hash * 31 + varietySeed.charCodeAt(index)) >>> 0;
  }
  return topics[hash % topics.length] ?? topics[0]!;
}

export function extractReplySemanticContext(input: {
  parentExcerpt: string;
  postExcerpt: string;
  threadExcerpts?: string[];
  varietySeed?: string;
}): ReplySemanticContext {
  const parentText = normalizeWhitespace(input.parentExcerpt);
  const threadExcerpts = input.threadExcerpts ?? [];
  const parent_topics = extractTopicsFromParent(parentText);
  const parent_intent = detectIntent(parentText);
  const parent_claim = buildParentClaim(parentText, parent_topics);
  const thread_context = buildThreadContext(input.postExcerpt, threadExcerpts);
  const reply_target = pickReplyTarget(parent_topics, input.varietySeed ?? parentText);

  return {
    parent_claim,
    parent_intent,
    parent_topics,
    thread_context,
    reply_target,
  };
}

export function isSurfaceAnchoredReply(
  reply: string,
  parentExcerpt: string,
  semantic?: ReplySemanticContext | null,
): boolean {
  const topics = semantic?.parent_topics ?? extractTopicsFromParent(parentExcerpt);
  const parentIsAboutFormat = isFormatMetaComment(parentExcerpt, topics.length);
  if (parentIsAboutFormat) {
    return false;
  }

  const lower = reply.toLowerCase();
  let surfaceHits = 0;
  for (const pattern of SURFACE_ANCHOR_PATTERNS) {
    if (pattern.test(reply)) {
      surfaceHits += 1;
    }
  }

  if (surfaceHits === 0) {
    return false;
  }

  const topicWords = new Set(
    topics
      .flatMap((topic) => topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/))
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !SURFACE_ANCHOR_TERMS.has(word)),
  );

  let topicHits = 0;
  for (const word of topicWords) {
    if (lower.includes(word)) {
      topicHits += 1;
    }
  }

  return surfaceHits >= 1 && topicHits === 0;
}

export function wouldReplySurviveParaphrase(
  reply: string,
  semantic: ReplySemanticContext,
): boolean {
  if (semantic.parent_topics.length === 0) {
    return true;
  }

  const replyLower = reply.toLowerCase();
  const topicHits = semantic.parent_topics.filter((topic) => {
    const words = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
    return words.some((word) => replyLower.includes(word));
  }).length;

  const targetWords = semantic.reply_target
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  const targetHit = targetWords.some((word) => replyLower.includes(word));

  if (topicHits >= 1 || targetHit) {
    return true;
  }

  return !isSurfaceAnchoredReply(reply, semantic.parent_claim, semantic);
}

export function buildSemanticFallbackReply(
  semantic: ReplySemanticContext,
  varietySeed: string,
): string | null {
  if (semantic.parent_topics.length === 0) {
    return null;
  }

  let hash = 0;
  for (let index = 0; index < varietySeed.length; index += 1) {
    hash = (hash * 31 + varietySeed.charCodeAt(index)) >>> 0;
  }

  const topic = semantic.parent_topics[hash % semantic.parent_topics.length] ?? semantic.reply_target;
  const topicLower = topic.toLowerCase();

  const templates: Array<(t: string) => string> = [
    (t) => `The ${t} part is the most useful piece here — most threads skip where the real friction shows up.`,
    (t) => `${capitalize(t)} is a good anchor. It makes the underlying idea easier to evaluate from both sides.`,
    (t) => `I like the ${t} framing because it turns a vague point into something you can actually test.`,
    (t) => `${capitalize(t)} is underrated in these conversations — glad someone named it directly.`,
    (t) => `Curious how ${t} played out in practice — that's usually where the interesting tradeoffs hide.`,
  ];

  if (topicLower.includes("failure") || topicLower.includes("risk")) {
    return `The failure modes part is the most useful piece here. Most role descriptions skip where someone is likely to struggle.`;
  }
  if (topicLower.includes("success") || topicLower.includes("month")) {
    return `Success by month three is a good anchor. It makes the role easier to evaluate from both sides.`;
  }
  if (topicLower.includes("30 day") || topicLower.includes("first 30") || topicLower.includes("onboarding")) {
    return `I like the first-30-days framing because it turns a vague role into something testable.`;
  }

  const pick = templates[hash % templates.length] ?? templates[0]!;
  return pick(topic);
}

function capitalize(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}
