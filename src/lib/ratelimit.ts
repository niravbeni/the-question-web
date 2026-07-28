/**
 * Minimal in-memory sliding-window rate limiter. Suitable for a single-instance
 * MVP; swap for a shared store (Redis) before horizontal scaling.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterMs = windowMs - (now - hits[0]);
    buckets.set(key, hits);
    return { ok: false, retryAfterMs };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterMs: 0 };
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "local";
  return `${scope}:${ip}`;
}
