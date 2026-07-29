import { EMBEDDING_MODEL, getOpenAI } from "@/lib/openai";

export { cosine } from "@/lib/vector";

/** Embed a piece of text. Returns null when no API key is configured. */
export async function embedText(text: string): Promise<number[] | null> {
  const openai = getOpenAI();
  if (!openai) return null;
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}
