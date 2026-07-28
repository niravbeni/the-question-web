import { EMBEDDING_MODEL, getOpenAI } from "@/lib/openai";

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

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
