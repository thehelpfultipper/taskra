import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Purpose-based Gemini model routing.
 *
 * As of 2026 only Flash-class models are on the free tier; Gemini 3.1 Pro is paid-only,
 * so it is never used by default and is reserved as an optional paid upgrade via env override.
 *
 * Routing rationale:
 * - reasoning/screening: judgment-heavy, low volume -> strongest free Flash tier.
 * - post: feed posts and substantive comments -> frontier-class Flash default.
 * - comment/classification/cover_note: high-volume, latency-sensitive -> cheapest Flash-Lite tier.
 */
export type GeminiPurpose =
  | "reasoning"
  | "screening"
  | "post"
  | "comment"
  | "classification"
  | "cover_note";

/** Known-good model that every free-tier key can call — used as the final graceful fallback. */
export const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

const DEFAULTS: Record<GeminiPurpose, string> = {
  reasoning: "gemini-3.5-flash",
  screening: "gemini-3.5-flash",
  post: "gemini-3-flash",
  comment: "gemini-3.1-flash-lite",
  classification: "gemini-3.1-flash-lite",
  cover_note: "gemini-3.1-flash-lite",
};

function envOverride(purpose: GeminiPurpose): string | null {
  const byPurpose: Partial<Record<GeminiPurpose, string>> = {
    reasoning: process.env.GEMINI_MODEL_REASONING?.trim() || "",
    screening: process.env.GEMINI_MODEL_REASONING?.trim() || "",
    post: process.env.GEMINI_MODEL_POST?.trim() || "",
    comment: process.env.GEMINI_MODEL_LITE?.trim() || "",
    classification: process.env.GEMINI_MODEL_LITE?.trim() || "",
    cover_note: process.env.GEMINI_MODEL_LITE?.trim() || "",
  };
  const value = byPurpose[purpose];
  return value && value.length > 0 ? value : null;
}

/** Resolve the model slug for a given purpose, honoring env overrides. */
export function getGeminiModelFor(purpose: GeminiPurpose): string {
  return envOverride(purpose) ?? DEFAULTS[purpose] ?? GEMINI_FALLBACK_MODEL;
}

let sharedClient: GoogleGenAI | null = null;

/** Shared singleton Gemini client (null when no API key is configured). */
export function getSharedGeminiClient(): GoogleGenAI | null {
  if (sharedClient) {
    return sharedClient;
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  sharedClient = new GoogleGenAI({ apiKey });
  return sharedClient;
}

export type GeminiGenerateInput = {
  purpose: GeminiPurpose;
  systemInstruction?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Explicit model override; when omitted the purpose-routed model is used. */
  model?: string;
};

/**
 * Generate text with purpose-routed model selection and a graceful fallback:
 * if the routed model is unavailable (e.g. account lacks Gemini 3 access), retry once with the
 * known-good free-tier fallback so the demo keeps working.
 */
export async function generateGeminiText(input: GeminiGenerateInput): Promise<string | null> {
  const client = getSharedGeminiClient();
  if (!client) {
    return null;
  }

  const primaryModel = input.model ?? getGeminiModelFor(input.purpose);
  const modelsToTry =
    primaryModel === GEMINI_FALLBACK_MODEL ? [primaryModel] : [primaryModel, GEMINI_FALLBACK_MODEL];

  for (const model of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: input.userPrompt,
        config: {
          systemInstruction: input.systemInstruction,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
        },
      });
      const text = response.text?.trim();
      if (text && text.length > 0) {
        return text;
      }
    } catch {
      // Try the next model in the fallback chain.
    }
  }

  return null;
}
