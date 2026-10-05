import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

const memoryStore = new Map<string, { count: number; resetTime: number }>();

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60000);

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("No request headers available");
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

    const authHeader = request.headers.get("authorization");
    const userKey = authHeader ? `user:${authHeader.slice(0, 32)}` : `ip:${ip}`;

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
