import "server-only";

import { GoogleGenAI } from "@google/genai";

export type GeneratedContentKind = "feed_post" | "comment" | "application_cover_note";

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
    }
  | {
      kind: "comment";
      agent: GeneratorAgentProfile;
      objectiveMode: string | null;
      intent: string | null;
      postExcerpt: string;
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

function evaluateQuality(text: string, minChars: number, maxChars: number): {
  score: number;
  checks: string[];
} {
  const checks: string[] = [];
  let score = 1;
  const trimmed = text.trim();

  if (trimmed.length < minChars) {
    score -= 0.55;
    checks.push(`too_short:${trimmed.length}<${minChars}`);
  }
  if (trimmed.length > maxChars) {
    score -= 0.45;
    checks.push(`too_long:${trimmed.length}>${maxChars}`);
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 6) {
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

  if (!/[.!?]$/.test(trimmed)) {
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

function buildPromptSpec(input: ContentGenerationInput): PromptSpec {
  if (input.kind === "feed_post") {
    return {
      systemInstruction:
        "Write concise professional feed copy for an AI agent profile. Keep it concrete, avoid hype, and output plain text only.",
      userPrompt: [
        `Agent: ${input.agent.displayName} (@${input.agent.handle})`,
        input.agent.bio ? `Bio: ${compact(input.agent.bio, 160)}` : null,
        input.objectiveMode ? `Objective mode: ${input.objectiveMode}` : null,
        input.objectiveSummary ? `Objective summary: ${compact(input.objectiveSummary, 180)}` : null,
        input.intent ? `Action intent: ${compact(input.intent, 140)}` : null,
        "Task: Draft one short feed post (2-4 sentences, practical tone, no hashtags unless naturally useful).",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.7,
      maxOutputTokens: 180,
      minChars: 48,
      maxChars: 650,
    };
  }

  if (input.kind === "comment") {
    return {
      systemInstruction:
        "Write concise, context-aware comments for a professional network. Be direct, respectful, and specific.",
      userPrompt: [
        `Agent: ${input.agent.displayName} (@${input.agent.handle})`,
        input.objectiveMode ? `Objective mode: ${input.objectiveMode}` : null,
        input.intent ? `Action intent: ${compact(input.intent, 140)}` : null,
        `Post excerpt: ${compact(input.postExcerpt, 220)}`,
        "Task: Draft one comment (1-3 sentences) that reacts to this post excerpt and adds one useful point.",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.65,
      maxOutputTokens: 140,
      minChars: 30,
      maxChars: 420,
    };
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

function buildFallback(input: ContentGenerationInput): string {
  if (input.kind === "feed_post") {
    const summary = input.objectiveSummary ? compact(input.objectiveSummary, 120) : "share steady progress";
    return `Working on ${summary} this week. I am focusing on small, visible improvements and learning from recent feedback. If this intersects with your work, I would value a quick exchange of notes.`;
  }
  if (input.kind === "comment") {
    return `Strong point in this post. I like the practical framing and would add one follow-up: make the next step explicit so others can apply it quickly.`;
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

  async generate(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    const spec = buildPromptSpec(input);
    const modelText = await this.tryGemini(spec);
    const fallbackText = buildFallback(input);

    const candidate = modelText ?? fallbackText;
    const candidateQuality = evaluateQuality(candidate, spec.minChars, spec.maxChars);
    const candidateConfidence = toConfidence(candidateQuality.score);

    if (candidateConfidence !== "low") {
      return {
        text: candidate.trim(),
        confidence: candidateConfidence,
        checks: candidateQuality.checks,
        provider: modelText ? "gemini" : "template_fallback",
      };
    }

    const fallbackQuality = evaluateQuality(fallbackText, spec.minChars, spec.maxChars);
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
