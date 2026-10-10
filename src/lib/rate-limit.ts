import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

const memoryStore = new Map<string, { count: number; resetTime: number }>();

// NOTE: this store is process-local (in-memory). It does NOT provide
// distributed or globally consistent rate limiting — limits reset on process
// restart and are enforced per server instance. On a single private host this
// is sufficient; do not treat it as a distributed limiter.

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60000);

const keyEncoder = new TextEncoder();

// SHA-256 hex (truncated) of the FULL Authorization credential. The previous
// implementation keyed on `authHeader.slice(0, 32)` — the constant JWT header
// segment ("Bearer eyJhbGciOi..."), which is identical for every token, so all
// users shared one bucket. Hashing the full credential gives a stable,
// collision-resistant, per-token key without ever storing or logging the raw
// token.
export async function credentialBucketKey(credential: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", keyEncoder.encode(credential));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

// Bucket key resolution: authenticated requests key on the full credential
// (hashed); requests without an Authorization header keep the IP fallback.
export async function resolveRateLimitKey(
  authHeader: string | null,
  ip: string,
): Promise<string> {
  if (authHeader) {
    return `user:${await credentialBucketKey(authHeader)}`;
  }
  return `ip:${ip}`;
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("No request headers available");
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    const authHeader = request.headers.get("authorization");
    const userKey = await resolveRateLimitKey(authHeader, ip);

    const key = `${config.keyPrefix}:${userKey}`;
    const now = Date.now();

    let entry = memoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + config.windowMs };
      memoryStore.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetTime = new Date(entry.resetTime).toISOString();

    if (entry.count > config.maxRequests) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    const response = await next({});

    if (response instanceof Response) {
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", resetTime);
    }

    return response;
  });
}

export const aiRateLimit = createRateLimitMiddleware({
  maxRequests: 30,
  windowMs: 60000,
  keyPrefix: "ai",
});

export const automationRateLimit = createRateLimitMiddleware({
  maxRequests: 60,
  windowMs: 60000,
  keyPrefix: "automation",
});

export const documentRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 60000,
  keyPrefix: "document",
});

export const datasetRateLimit = createRateLimitMiddleware({
  maxRequests: 10,
  windowMs: 60000,
  keyPrefix: "dataset",
});

export const schedulerRateLimit = createRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60000,
  keyPrefix: "scheduler",
});
