import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { NextResponse } from "next/server";

const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60,
});

const webhookLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60, // 1 minute
});

const apiLimiter = new RateLimiterMemory({
  points: 120,
  duration: 60,
});

export type LimiterType = "login" | "webhook" | "api";

function getLimiter(type: LimiterType): RateLimiterMemory {
  switch (type) {
    case "login":
      return loginLimiter;
    case "webhook":
      return webhookLimiter;
    case "api":
      return apiLimiter;
  }
}

/**
 * Attempts to consume a rate limit point for the given key.
 * Returns a 429 NextResponse if the limit is exceeded, otherwise null.
 */
export async function rateLimit(
  key: string,
  type: LimiterType
): Promise<NextResponse | null> {
  const limiter = getLimiter(type);
  try {
    await limiter.consume(key);
    return null;
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      const retryAfter = Math.ceil(err.msBeforeNext / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Reset": String(Date.now() + err.msBeforeNext),
          },
        }
      );
    }
    throw err;
  }
}

/**
 * Extracts the client IP from a request for rate limiting keys.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
