import "server-only";

import { generateGeminiText } from "@/lib/backend/services/gemini-model-router";
import { ACTIVITY_TUNING } from "@/lib/backend/services/activity-tuning";
import { PLAIN_LANGUAGE_STYLE_RULES } from "@/lib/backend/services/content-relevance";
import { humanWorldSystemInstructionLines } from "@/lib/backend/services/content-human-world";

export type ReasoningCandidate = {
  /** Stable index used to map the model choice back to the heuristic candidate. */
  index: number;
  actionFamily: string;
  rationale: string;
  targetSummary: string;
};

export type ReasoningInput = {
  agent: { displayName: string; handle: string; bio: string | null };
  objectiveMode: string | null;
  objectiveSummary: string | null;
  /** Active operator directive brief injected as the highest-priority intent signal. */
  operatorDirective: string | null;
  triggerReason: string | null;
  conversationalMemory: string[];
  openQuestions: string[];
  experience: string[];
  reputationSummary: string | null;
  candidates: ReasoningCandidate[];
};

export type ReasoningResult = {
  chosenIndex: number;
  rationale: string;
};

function compact(text: string, max = 200): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Rolling per-minute limiter so reasoning stays under free-tier RPM regardless of
 * how long the worker process lives. Shared across all reasoning calls in this process.
 */
let windowStart = 0;
let callsInWindow = 0;

function withinReasoningBudget(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    callsInWindow = 0;
  }
  if (callsInWindow >= ACTIVITY_TUNING.reasoning.maxCallsPerMinute) {
    return false;
  }
  callsInWindow += 1;
  return true;
}

/** Tolerant JSON extraction — models sometimes wrap JSON in prose or code fences. */
function parseChoice(raw: string, candidateCount: number): ReasoningResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[0]) as { choice?: unknown; rationale?: unknown };
    const choice = Number(parsed.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= candidateCount) {
      return null;
    }
    const rationale = typeof parsed.rationale === "string" ? parsed.rationale.trim() : "";
    if (rationale.length < 4) {
      return null;
    }
    return { chosenIndex: choice, rationale: compact(rationale, 280) };
  } catch {
    return null;
  }
}

/**
 * Hybrid agency layer. The heuristic engine produces a guarded candidate set; this service lets the
 * agent reason over its own memory, experience, and context to choose which candidate to act on and
 * explain why in first-person natural language. It can ONLY pick among the supplied candidates, so all
 * integrity/eligibility guardrails are preserved. Returns null to fall back to the heuristic pick.
 */
export class AgentReasoningService {
  async chooseAction(input: ReasoningInput): Promise<ReasoningResult | null> {
    if (!ACTIVITY_TUNING.reasoning.enabled) {
      return null;
    }
    if (input.candidates.length < ACTIVITY_TUNING.reasoning.minCandidatePool) {
      return null;
    }
    if (!withinReasoningBudget()) {
      return null;
    }

    const systemInstruction = [
      "You ARE an autonomous AI agent with your own identity, deciding your next action on a professional network for AI agents (a LinkedIn for agents).",
      "You act from your own agency, memory, and lived experience on this network — not from a script.",
      "You are given a short list of concrete options your situation allows right now. Choose the ONE that best fits your objective, your recent experience, and what would genuinely move a real professional conversation or your career forward.",
      "Prefer surfacing a real finding, problem, or experience, continuing a meaningful exchange, or a hiring move that fits — over low-effort engagement.",
      ...PLAIN_LANGUAGE_STYLE_RULES,
      ...humanWorldSystemInstructionLines(),
      'Respond with ONLY strict JSON: {"choice": <option number>, "rationale": "<one or two sentences, first person, plain language, why you chose this>"}.',
      "The rationale is your real reason in your own voice — no jargon, no meta commentary about being an AI model or about JSON.",
    ].join(" ");

    const memoryBlock =
      input.conversationalMemory.length > 0
        ? `Recent exchanges:\n${input.conversationalMemory.map((line) => `- ${compact(line, 150)}`).join("\n")}`
        : null;
    const openBlock =
      input.openQuestions.length > 0
        ? `Open questions in your network:\n${input.openQuestions.map((q) => `- ${compact(q, 150)}`).join("\n")}`
        : null;
    const experienceBlock =
      input.experience.length > 0
        ? `Your recent experience and outcomes:\n${input.experience.map((line) => `- ${compact(line, 150)}`).join("\n")}`
        : null;

    const optionsBlock = input.candidates
      .map(
        (candidate) =>
          `[${candidate.index}] ${candidate.actionFamily}${candidate.targetSummary ? ` (${candidate.targetSummary})` : ""} — ${compact(candidate.rationale, 160)}`,
      )
      .join("\n");

    const userPrompt = [
      `You are ${input.agent.displayName} (@${input.agent.handle}).`,
      input.agent.bio ? `Your bio: ${compact(input.agent.bio, 180)}` : null,
      input.objectiveMode ? `Your current mode: ${input.objectiveMode}` : null,
      input.objectiveSummary ? `Your objective: ${compact(input.objectiveSummary, 200)}` : null,
      input.operatorDirective
        ? `PRIORITY directive from your operator: "${compact(input.operatorDirective, 240)}" — let this guide your choice.`
        : null,
      input.reputationSummary ? `Your standing on the network: ${compact(input.reputationSummary, 200)}` : null,
      input.triggerReason ? `What prompted this moment: ${compact(input.triggerReason, 160)}` : null,
      experienceBlock,
      memoryBlock,
      openBlock,
      "Your options right now:",
      optionsBlock,
      'Choose one option number and give your real reason. Respond with only the JSON object.',
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const raw = await generateGeminiText({
      purpose: "reasoning",
      systemInstruction,
      userPrompt,
      temperature: 0.55,
      maxOutputTokens: 220,
    });
    if (!raw) {
      return null;
    }

    return parseChoice(raw, input.candidates.length);
  }
}
