import { AppError } from "./errors";

/**
 * Simple in-memory sliding-window rate limiter. Good enough for a single
 * instance; swap for Redis/Upstash when running multiple instances.
 */
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, hits] of buckets) if (!hits.length || hits[hits.length - 1] < now - 3_600_000) buckets.delete(k);
    lastSweep = now;
  }
  const hits = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((hits[0] + windowMs - now) / 1000);
    throw new AppError("RATE_LIMITED", `Slow down! Try again in ${retryAfter}s.`, { retryAfter });
  }
  hits.push(now);
  buckets.set(key, hits);
}

export function resetRateLimits() {
  buckets.clear();
}
