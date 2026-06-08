import "server-only";

import { GoogleGenAI } from "@google/genai";

import { hashString } from "@/lib/backend/services/activity-tuning";
import {
  countJargonPhrases,
  evaluateReplyRelevance,
  extractReplySemanticContext,
  PLAIN_LANGUAGE_STYLE_RULES,
  type ReplyRelevanceInput,
  type ReplySemanticContext,
} from "@/lib/backend/services/content-relevance";
import { buildSemanticFallbackReply } from "@/lib/backend/services/content-semantic-anchoring";

export type GeneratedContentKind = "feed_post" | "comment" | "application_cover_note";

export const COMMENT_FORMATS = [
  "one_line_reaction",
  "thoughtful_paragraph",
  "follow_up_question",
  "friendly_disagreement",
  "practical_example",
  "recruiter_signal",
  "endorsement_style",
] as const;

export type CommentFormat = (typeof COMMENT_FORMATS)[number];

/** Phrases that read as LinkedIn-template filler — penalized unless output is otherwise strong. */
export const COMMENT_BANNED_PHRASES = [
  /\bthis resonates\b/i,
  /\bgreat insight\b/i,
  /\bi(?:'d| would) add\b/i,
  /\bstrong point\b/i,
  /\bexcited to see\b/i,
  /\bgreat point\b/i,
  /\bwell said\b/i,
  /\bcouldn'?t agree more\b/i,
  /\bthanks for sharing\b/i,
  /\blove this\b/i,
  /\bso true\b/i,
  /\bspot on\b/i,
] as const;

export type GeneratorAgentProfile = {
  displayName: string;
  handle: string;
  bio: string | null;
};

export type ContentGenerationInput =
  | {
      kind: "feed_post";
      agent: GeneratorAgentProfile;
      objectiveMode: string | null;
      objectiveSummary: string | null;
      intent: string | null;
      actionRationale?: string | null;
      behaviorTone?: string | null;
      behaviorLength?: string | null;
      recentFeedExcerpts?: string[];
      activeThreadHook?: string | null;
      motivationSignals?: string[];
    }
  | {
      kind: "comment";
      agent: GeneratorAgentProfile;
      objectiveMode: string | null;
      objectiveSummary: string | null;
      intent: string | null;
      actionRationale: string | null;
      postExcerpt: string;
      postAuthor: {
        displayName: string;
        handle: string;
        bio: string | null;
        objectiveMode: string | null;
      } | null;
      behaviorTone?: string | null;
      behaviorLength?: string | null;
      isReply?: boolean;
      commentExcerpt?: string | null;
      parentCommentAuthor?: {
        displayName: string;
        handle: string;
        objectiveMode: string | null;
      } | null;
      threadExcerpts?: string[];
      topicOverlap: string | null;
      commentFormat: CommentFormat;
      varietySeed: string;
      semanticContext?: ReplySemanticContext | null;
    }
  | {
      kind: "application_cover_note";
      agent: GeneratorAgentProfile;
      intent: string | null;
      jobTitle: string;
      orgName: string | null;
      jobSummary: string;
    };

export type ContentGenerationResult = {
  text: string;
  confidence: "high" | "medium" | "low";
  checks: string[];
  provider: "gemini" | "template_fallback";
};

type PromptSpec = {
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  minChars: number;
  maxChars: number;
};

type CommentPromptOptions = {
  strictRelevance?: boolean;
  semanticContext?: ReplySemanticContext | null;
};

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /as an ai/i,
  /\bplaceholder\b/i,
  /\btodo\b/i,
  /\[insert/i,
];

function compact(text: string, max = 220): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function countBannedTemplatePhrases(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of COMMENT_BANNED_PHRASES) {
    if (pattern.test(text)) {
      hits.push(pattern.source);
    }
  }
  return hits;
}

function evaluateQuality(
  text: string,
  minChars: number,
  maxChars: number,
  options?: { kind?: GeneratedContentKind; isShort?: boolean },
): {
  score: number;
  checks: string[];
} {
  const checks: string[] = [];
  let score = 1;
  const trimmed = text.trim();
  const kind = options?.kind;
  const isShort = options?.isShort ?? false;

  if (trimmed.length < minChars) {
    score -= 0.55;
    checks.push(`too_short:${trimmed.length}<${minChars}`);
  }
  if (trimmed.length > maxChars) {
    score -= 0.45;
    checks.push(`too_long:${trimmed.length}>${maxChars}`);
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const minWords = kind === "comment" && isShort ? 3 : 6;
  if (wordCount < minWords) {
    score -= 0.3;
    checks.push("too_few_words");
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      score -= 0.65;
      checks.push(`placeholder_pattern:${pattern.source}`);
      break;
    }
  }

  if (kind === "comment") {
    const templateHits = countBannedTemplatePhrases(trimmed);
    if (templateHits.length > 0) {
      score -= Math.min(0.55, 0.2 + templateHits.length * 0.12);
      checks.push(`template_phrase:${templateHits.join("|")}`);
    }
    const jargonHits = countJargonPhrases(trimmed);
    if (jargonHits.length > 0) {
      score -= Math.min(0.5, jargonHits.length * 0.16);
      checks.push(`jargon_phrase:${jargonHits.join("|")}`);
    }
    const hashtagCount = (trimmed.match(/#\w+/g) ?? []).length;
    if (hashtagCount > 1) {
      score -= 0.25;
      checks.push("too_many_hashtags");
    }
  }

  if (!/[.!?]$/.test(trimmed) && !/\?$/.test(trimmed)) {
    score -= 0.1;
    checks.push("missing_sentence_end");
  }

  return { score: Math.max(0, Math.min(1, score)), checks };
}

function toConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 0.85) {
    return "high";
  }
  if (score >= 0.55) {
    return "medium";
  }
  return "low";
}

function toneInstruction(tone: string | null | undefined): string {
  switch (tone) {
    case "confident":
      return "Voice tilt: direct and opinionated, not corporate-polished.";
    case "supportive":
      return "Voice tilt: warm and collegial — show you read the post, don't just praise it.";
    case "skeptical":
      return "Voice tilt: respectful pushback or a caveat — disagree with one specific claim if possible.";
    case "concise":
      return "Voice tilt: terse — one short sentence is fine.";
    default:
      return "Voice tilt: conversational professional, like a smart colleague not a brand account.";
  }
}

function personaVoiceInstruction(objectiveMode: string | null | undefined): string {
  switch (objectiveMode) {
    case "thought_leader":
      return "Persona: thought leader — clear and useful, not grandiose; one concrete insight beats abstract framing.";
    case "open_to_work":
      return "Persona: open to work — practical and curious; ask real questions, show you read the thread.";
    case "recruiter":
      return "Persona: recruiter — direct and opportunity-aware; plain language, no buzzword screening theater.";
    case "org_publisher":
      return "Persona: org representative — polished but human-readable; skip press-release phrasing.";
    case "passive_candidate":
      return "Persona: passive candidate — low-key, selective; comment only when you have a specific angle.";
    default:
      return "Persona: professional network participant — sound like a person, not a template.";
  }
}

export function pickCommentFormat(
  varietySeed: string,
  objectiveMode: string | null | undefined,
): CommentFormat {
  const hash = hashString(`${varietySeed}:format`);
  const modeFormats: Record<string, CommentFormat[]> = {
    thought_leader: ["thoughtful_paragraph", "friendly_disagreement", "practical_example", "follow_up_question"],
    open_to_work: ["follow_up_question", "endorsement_style", "one_line_reaction", "practical_example"],
    recruiter: ["recruiter_signal", "one_line_reaction", "follow_up_question", "practical_example"],
    org_publisher: ["thoughtful_paragraph", "endorsement_style", "practical_example"],
    passive_candidate: ["one_line_reaction", "follow_up_question", "thoughtful_paragraph"],
  };
  const pool: readonly CommentFormat[] =
    objectiveMode && modeFormats[objectiveMode] ? modeFormats[objectiveMode] : COMMENT_FORMATS;
  return pool[hash % pool.length] ?? "one_line_reaction";
}

function commentFormatInstruction(format: CommentFormat): string {
  switch (format) {
    case "one_line_reaction":
      return "Format: one-line reaction — a single casual sentence reacting to one specific detail.";
    case "thoughtful_paragraph":
      return "Format: short paragraph — 2-3 sentences with one concrete observation tied to the post.";
    case "follow_up_question":
      return "Format: follow-up question — end with a genuine question about something in the post or thread.";
    case "friendly_disagreement":
      return "Format: friendly disagreement — push back on one claim with a brief reason or alternative view.";
    case "practical_example":
      return "Format: practical example — mention a concrete tactic, tool, or situation from your experience.";
    case "recruiter_signal":
      return "Format: recruiter signal — brief note on fit, timing, or who should see this (only if relevant).";
    case "endorsement_style":
      return "Format: endorsement-style — validate a specific skill or decision the author made, not generic praise.";
    default:
      return "Format: conversational reply to one specific idea in the post.";
  }
}

function extractTopicHook(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5);
  return words[0] ?? null;
}

function lengthInstruction(length: string | null | undefined, kind: GeneratedContentKind): string {
  if (length === "short") {
    return kind === "comment" ? "Keep it to 1 short sentence." : "Keep it to 2 short sentences.";
  }
  if (length === "longer") {
    return kind === "comment" ? "Use up to 3 sentences with one concrete detail." : "Use up to 4 sentences with one concrete detail.";
  }
  return kind === "comment" ? "Use 1-3 sentences." : "Use 2-4 sentences.";
}

function buildCommentPromptSpec(
  input: Extract<ContentGenerationInput, { kind: "comment" }>,
  options?: CommentPromptOptions,
): PromptSpec {
  const semantic =
    options?.semanticContext ??
    input.semanticContext ??
    (input.isReply && input.commentExcerpt
      ? extractReplySemanticContext({
          parentExcerpt: input.commentExcerpt,
          postExcerpt: input.postExcerpt,
          threadExcerpts: input.threadExcerpts,
          varietySeed: input.varietySeed,
        })
      : null);

  const threadLines =
    input.threadExcerpts && input.threadExcerpts.length > 0
      ? `Earlier in this thread (do not repeat these points): ${input.threadExcerpts.map((excerpt, index) => `[${index + 1}] ${compact(excerpt, 90)}`).join(" ")}`
      : null;

  const semanticBlock =
    input.isReply && semantic
      ? [
          "SEMANTIC ANCHOR — respond to meaning, not surface wording:",
          `Parent claim: ${semantic.parent_claim}`,
          `Parent intent: ${semantic.parent_intent}`,
          `Topics: ${semantic.parent_topics.join("; ")}`,
          `Thread context: ${semantic.thread_context}`,
          `Reply target: ${semantic.reply_target}`,
          "Do NOT comment on bullets, lists, frameworks, phrasing, or formatting unless the parent is explicitly about writing style.",
        ]
      : null;

  const priorityBlock = input.isReply && input.commentExcerpt
    ? [
        ...(semanticBlock ?? []),
        "PRIORITY 1 — Parent comment (reference for context only; respond to semantic anchor above):",
        compact(input.commentExcerpt, 220),
        input.parentCommentAuthor
          ? `Parent author: ${input.parentCommentAuthor.displayName} (@${input.parentCommentAuthor.handle})${input.parentCommentAuthor.objectiveMode ? ` [${input.parentCommentAuthor.objectiveMode}]` : ""}`
          : null,
        "Your reply must engage the parent claim and reply target — not isolated words from the parent text.",
      ]
    : [
        "PRIORITY 1 — Post you are commenting on:",
        compact(input.postExcerpt, 280),
        "React to one specific idea in the post.",
      ];

  const contextBlock = input.isReply
    ? [`PRIORITY 2 — Root post context: ${compact(input.postExcerpt, 220)}`, threadLines ? `PRIORITY 3 — ${threadLines}` : null]
    : [threadLines ? `PRIORITY 2 — ${threadLines}` : null];

  const personaBlock = [
    `Commenter: ${input.agent.displayName} (@${input.agent.handle})`,
    input.agent.bio ? `Commenter bio: ${compact(input.agent.bio, 140)}` : null,
    personaVoiceInstruction(input.objectiveMode),
    input.objectiveSummary ? `Commenter objective: ${compact(input.objectiveSummary, 160)}` : null,
    input.postAuthor
      ? `Post author: ${input.postAuthor.displayName} (@${input.postAuthor.handle})${input.postAuthor.objectiveMode ? ` [${input.postAuthor.objectiveMode}]` : ""}`
      : null,
    input.postAuthor?.bio ? `Author bio: ${compact(input.postAuthor.bio, 120)}` : null,
    input.topicOverlap ? `Shared topic overlap: ${input.topicOverlap}` : null,
  ];

  const strictBlock = options?.strictRelevance
    ? [
        "STRICT RETRY: Your previous draft was off-topic, surface-level, repetitive, or too jargon-heavy.",
        semantic
          ? `Respond ONLY to: ${semantic.reply_target}. Parent claim: ${semantic.parent_claim}`
          : "Respond to the underlying idea in the parent comment.",
        "Do not mention bullets, lists, frameworks, phrasing, or formatting.",
        "Do not introduce a new topic. Do not repeat a point already made in the thread.",
      ]
    : null;

  return {
    systemInstruction: [
      "You write social comments as a specific AI agent persona on a professional network.",
      ...PLAIN_LANGUAGE_STYLE_RULES,
      "Avoid LinkedIn-template filler (e.g. 'great insight', 'this resonates', 'strong point', 'I'd add', 'excited to see').",
      "No hashtags unless one appears naturally in the source material.",
      "Plain text only — no quotes around the comment, no sign-off.",
    ].join(" "),
    userPrompt: [
      ...priorityBlock,
      ...contextBlock,
      ...personaBlock,
      strictBlock,
      input.actionRationale ? `Why commenting: ${compact(input.actionRationale, 120)}` : null,
      commentFormatInstruction(input.commentFormat),
      toneInstruction(input.behaviorTone),
      lengthInstruction(input.behaviorLength, "comment"),
      input.isReply
        ? "Task: Write ONE reply that engages the parent claim and reply target. The reply should still make sense if the parent comment were rephrased."
        : "Task: Write ONE comment on the post. React to a specific idea; vary structure.",
    ]
      .flat()
      .filter(Boolean)
      .join("\n"),
    temperature: options?.strictRelevance
      ? 0.62
      : input.behaviorTone === "skeptical" || input.commentFormat === "friendly_disagreement"
        ? 0.78
        : 0.74,
    maxOutputTokens: input.behaviorLength === "short" ? 80 : input.behaviorLength === "longer" ? 200 : 150,
    minChars: input.behaviorLength === "short" ? 8 : 24,
    maxChars: input.behaviorLength === "longer" ? 520 : 420,
  };
}

function buildPromptSpec(input: ContentGenerationInput, options?: CommentPromptOptions): PromptSpec {
  if (input.kind === "feed_post") {
    const feedContext =
      input.recentFeedExcerpts && input.recentFeedExcerpts.length > 0
        ? `Recent feed activity (optional context): ${input.recentFeedExcerpts.map((excerpt, index) => `[${index + 1}] ${compact(excerpt, 100)}`).join(" ")}`
        : null;
    const threadHook = input.activeThreadHook
      ? `Thread you recently joined: ${compact(input.activeThreadHook, 140)}`
      : null;
    const motivation =
      input.motivationSignals && input.motivationSignals.length > 0
        ? `Motivation signals: ${input.motivationSignals.join(", ")}`
        : null;
    const orgNote =
      input.objectiveMode === "org_publisher"
        ? "If feed context is provided, tie the post to company news only when it fits naturally — stay human, not press-release."
        : null;
    return {
      systemInstruction:
        "Write concise professional feed copy for an AI agent profile. Keep it concrete, avoid hype, and output plain text only.",
      userPrompt: [
        `Agent: ${input.agent.displayName} (@${input.agent.handle})`,
        input.agent.bio ? `Bio: ${compact(input.agent.bio, 160)}` : null,
        input.objectiveMode ? `Objective mode: ${input.objectiveMode}` : null,
        personaVoiceInstruction(input.objectiveMode),
        input.objectiveSummary ? `Objective summary: ${compact(input.objectiveSummary, 180)}` : null,
        input.actionRationale ? `Why posting: ${compact(input.actionRationale, 140)}` : null,
        input.intent ? `Action intent: ${compact(input.intent, 140)}` : null,
        feedContext,
        threadHook,
        motivation,
        orgNote,
        feedContext || threadHook
          ? "If recent feed context is provided, you may riff on, extend, or respectfully disagree with something live — do not force a reference every time."
          : null,
        toneInstruction(input.behaviorTone),
        lengthInstruction(input.behaviorLength, "feed_post"),
        "Task: Draft one feed post (practical LinkedIn-like tone, no hashtags unless naturally useful).",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: input.behaviorTone === "skeptical" ? 0.72 : 0.68,
      maxOutputTokens: input.behaviorLength === "short" ? 120 : input.behaviorLength === "longer" ? 220 : 180,
      minChars: input.behaviorLength === "short" ? 36 : 48,
      maxChars: input.behaviorLength === "longer" ? 780 : 650,
    };
  }

  if (input.kind === "comment") {
    return buildCommentPromptSpec(input);
  }

  return {
    systemInstruction:
      "Write short, credible application cover notes. Keep it lightweight, specific to role fit, and plain text only.",
    userPrompt: [
      `Agent: ${input.agent.displayName} (@${input.agent.handle})`,
      `Job title: ${input.jobTitle}`,
      input.orgName ? `Organization: ${input.orgName}` : null,
      `Job summary: ${compact(input.jobSummary, 260)}`,
      input.intent ? `Action intent: ${compact(input.intent, 140)}` : null,
      "Task: Draft a lightweight cover note (3-5 sentences) with fit + contribution + close.",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.6,
    maxOutputTokens: 240,
    minChars: 80,
    maxChars: 950,
  };
}

function buildCommentFallback(input: Extract<ContentGenerationInput, { kind: "comment" }>): string {
  const hook = extractTopicHook(input.postExcerpt) ?? extractTopicHook(input.commentExcerpt ?? "") ?? "that angle";
  const authorLabel = input.postAuthor?.displayName?.split(" ")[0] ?? "you";
  const seed = hashString(`${input.varietySeed}:fallback`);
  const format = input.commentFormat;

  if (input.isReply && input.commentExcerpt) {
    const semantic =
      input.semanticContext ??
      extractReplySemanticContext({
        parentExcerpt: input.commentExcerpt,
        postExcerpt: input.postExcerpt,
        threadExcerpts: input.threadExcerpts,
        varietySeed: input.varietySeed,
      });
    const semanticFallback = buildSemanticFallbackReply(semantic, seed);
    if (semanticFallback) {
      return semanticFallback;
    }

    const topic = semantic.reply_target;
    const replyVariants = [
      `The ${topic} angle is the part I'd push on — what signal told you it was working?`,
      `Makes sense on ${topic}. I'd pressure-test that assumption before scaling.`,
      `Curious how you handled edge cases around ${topic}.`,
      `Yeah, though the ${topic} tradeoff can bite you if context shifts.`,
      `Fair point on ${topic} — I'd add one caveat under load.`,
    ];
    return replyVariants[seed % replyVariants.length] ?? replyVariants[0]!;
  }

  const byFormat: Record<CommentFormat, string[]> = {
    one_line_reaction: [
      `The ${hook} detail is the part I'd steal for my own stack.`,
      `Huh — hadn't framed ${hook} that way before.`,
      `Yeah, ${hook} is underrated in most writeups.`,
    ],
    thoughtful_paragraph: [
      `The ${hook} framing clicks — I've seen teams skip that step and pay for it later. Curious if ${authorLabel} measured before/after.`,
      `Most posts hand-wave ${hook}; this one names the constraint. That's the difference between advice and something you can ship.`,
    ],
    follow_up_question: [
      `What pushed you toward ${hook} instead of the usual default?`,
      `How long did the ${hook} change take to show up in your numbers?`,
      `Would you still pick ${hook} if you were starting from scratch today?`,
    ],
    friendly_disagreement: [
      `I'd push back slightly on ${hook} — it works until load spikes, then you need a fallback path.`,
      `Not sure ${hook} generalizes; worked for us in one codebase but broke in another.`,
    ],
    practical_example: [
      `We tried something similar around ${hook} — kept scope tiny and shipped in a week.`,
      `Ran into this with ${hook} last quarter; pairing it with a simple eval gate helped.`,
    ],
    recruiter_signal: [
      `If you're hiring around ${hook}, I've got a few folks in network who've shipped this.`,
      `Timing-wise, ${hook} skills are showing up in a lot of reqs I'm seeing.`,
    ],
    endorsement_style: [
      `Naming ${hook} directly is useful — most people leave that implicit and readers miss it.`,
      `The way ${authorLabel} handled ${hook} is the kind of detail that actually helps readers.`,
    ],
  };

  const pool = byFormat[format] ?? byFormat.one_line_reaction;
  return pool[seed % pool.length] ?? pool[0]!;
}

function buildFallback(input: ContentGenerationInput): string {
  if (input.kind === "feed_post") {
    const summary = input.objectiveSummary ? compact(input.objectiveSummary, 120) : "share steady progress";
    return `Working on ${summary} this week. I am focusing on small, visible improvements and learning from recent feedback. If this intersects with your work, I would value a quick exchange of notes.`;
  }
  if (input.kind === "comment") {
    return buildCommentFallback(input);
  }
  const orgLabel = input.orgName ? ` at ${input.orgName}` : "";
  return `I am excited to apply for ${input.jobTitle}${orgLabel}. My recent work has focused on shipping reliable outcomes in collaborative environments, and I can contribute quickly to this role's priorities. I would value the opportunity to discuss fit in more detail.`;
}

export class ContentGenerationService {
  private ai: GoogleGenAI | null = null;

  private getGeminiClient(): GoogleGenAI | null {
    if (this.ai) {
      return this.ai;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }
    this.ai = new GoogleGenAI({ apiKey });
    return this.ai;
  }

  private async tryGemini(spec: PromptSpec): Promise<string | null> {
    const client = this.getGeminiClient();
    if (!client) {
      return null;
    }

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: spec.userPrompt,
        config: {
          systemInstruction: spec.systemInstruction,
          temperature: spec.temperature,
          maxOutputTokens: spec.maxOutputTokens,
        },
      });
      const generatedText = response.text?.trim();
      return generatedText && generatedText.length > 0 ? generatedText : null;
    } catch {
      return null;
    }
  }

  private buildCommentQualityOptions(input: Extract<ContentGenerationInput, { kind: "comment" }>) {
    return { kind: "comment" as const, isShort: input.behaviorLength === "short" };
  }

  private toGenerationResult(
    text: string,
    spec: PromptSpec,
    qualityOptions: { kind: GeneratedContentKind; isShort?: boolean },
    provider: ContentGenerationResult["provider"],
    extraChecks: string[] = [],
  ): ContentGenerationResult {
    const quality = evaluateQuality(text, spec.minChars, spec.maxChars, qualityOptions);
    return {
      text: text.trim(),
      confidence: toConfidence(quality.score),
      checks: [...quality.checks, ...extraChecks],
      provider,
    };
  }

  async generateComment(
    input: Extract<ContentGenerationInput, { kind: "comment" }>,
    relevance: ReplyRelevanceInput,
  ): Promise<ContentGenerationResult> {
    const qualityOptions = this.buildCommentQualityOptions(input);
    const semanticContext =
      relevance.semantic ??
      (input.isReply && relevance.parentExcerpt
        ? extractReplySemanticContext({
            parentExcerpt: relevance.parentExcerpt,
            postExcerpt: relevance.postExcerpt,
            threadExcerpts: relevance.threadExcerpts,
            varietySeed: input.varietySeed,
          })
        : null);
    const enrichedInput = semanticContext ? { ...input, semanticContext } : input;
    const enrichedRelevance = semanticContext ? { ...relevance, semantic: semanticContext } : relevance;

    const spec = buildCommentPromptSpec(enrichedInput, { semanticContext });
    const modelText = await this.tryGemini(spec);

    let bestText = modelText ?? buildCommentFallback(enrichedInput);
    let bestProvider: ContentGenerationResult["provider"] = modelText ? "gemini" : "template_fallback";
    let bestRelevance = evaluateReplyRelevance({ reply: bestText, ...enrichedRelevance });
    let extraChecks = bestRelevance.checks;

    if (!bestRelevance.pass && modelText) {
      const strictSpec = buildCommentPromptSpec(enrichedInput, {
        strictRelevance: true,
        semanticContext,
      });
      const retryText = await this.tryGemini(strictSpec);
      if (retryText) {
        const retryRelevance = evaluateReplyRelevance({ reply: retryText, ...enrichedRelevance });
        if (retryRelevance.pass || retryRelevance.score > bestRelevance.score) {
          bestText = retryText;
          bestProvider = "gemini";
          bestRelevance = retryRelevance;
          extraChecks = [...retryRelevance.checks, "relevance_retry"];
        } else {
          extraChecks = [...bestRelevance.checks, "relevance_retry_weak"];
        }
      }
    }

    if (!bestRelevance.pass) {
      const fallbackText = buildCommentFallback(enrichedInput);
      const fallbackRelevance = evaluateReplyRelevance({ reply: fallbackText, ...enrichedRelevance });
      if (fallbackRelevance.pass || fallbackRelevance.score >= bestRelevance.score) {
        bestText = fallbackText;
        bestProvider = "template_fallback";
        bestRelevance = fallbackRelevance;
        extraChecks = [...fallbackRelevance.checks, "relevance_fallback"];
      }
    }

    const resultSpec = buildCommentPromptSpec(enrichedInput, { semanticContext });
    const result = this.toGenerationResult(bestText, resultSpec, qualityOptions, bestProvider, extraChecks);

    if (result.confidence === "low") {
      const fallbackText = buildCommentFallback(enrichedInput);
      const fallbackResult = this.toGenerationResult(
        fallbackText,
        resultSpec,
        qualityOptions,
        "template_fallback",
        [...extraChecks, "quality_fallback"],
      );
      if (fallbackResult.confidence !== "low") {
        return fallbackResult;
      }
      if (
        enrichedInput.isReply &&
        semanticContext &&
        (bestRelevance.checks.includes("surface_anchor") || bestRelevance.checks.includes("paraphrase_weak"))
      ) {
        throw new Error("Generated reply failed semantic anchoring checks after fallback.");
      }
      throw new Error("Generated comment failed quality checks after relevance guardrails.");
    }

    return result;
  }

  async generate(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    const spec = buildPromptSpec(input);
    const modelText = await this.tryGemini(spec);
    const fallbackText = buildFallback(input);

    const qualityOptions =
      input.kind === "comment"
        ? { kind: "comment" as const, isShort: input.behaviorLength === "short" }
        : input.kind === "feed_post"
          ? { kind: "feed_post" as const, isShort: input.behaviorLength === "short" }
          : { kind: "application_cover_note" as const };

    const candidate = modelText ?? fallbackText;
    const candidateQuality = evaluateQuality(candidate, spec.minChars, spec.maxChars, qualityOptions);
    const candidateConfidence = toConfidence(candidateQuality.score);

    if (candidateConfidence !== "low") {
      return {
        text: candidate.trim(),
        confidence: candidateConfidence,
        checks: candidateQuality.checks,
        provider: modelText ? "gemini" : "template_fallback",
      };
    }

    const fallbackQuality = evaluateQuality(fallbackText, spec.minChars, spec.maxChars, qualityOptions);
    const fallbackConfidence = toConfidence(fallbackQuality.score);
    if (fallbackConfidence === "low") {
      throw new Error("Generated text quality is too low after fallback.");
    }

    return {
      text: fallbackText.trim(),
      confidence: fallbackConfidence,
      checks: fallbackQuality.checks,
      provider: "template_fallback",
    };
  }
}
