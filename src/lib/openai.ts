import OpenAI from "openai";

/**
 * Model split:
 * - CHAT_MODEL powers the live facilitator conversation — balanced quality,
 *   low latency, reliable tool calls.
 * - ANALYSIS_MODEL powers the analytical pipeline (topic labeling, creative
 *   tension derivation, position scoring). It runs infrequently and in the
 *   background, so we use the flagship model where quality matters most.
 */
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-terra";
export const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-5.6-sol";
export const EMBEDDING_MODEL = "text-embedding-3-small";

let client: OpenAI | null = null;

/** Returns a shared OpenAI client, or null if no API key is configured. */
export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
