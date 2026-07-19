import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { getRequestIp } from "@/lib/request-ip";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type ApiProtectionState = {
  rateLimits: Map<string, RateLimitEntry>;
  cache: Map<string, CacheEntry>;
  idempotencyKeys: Map<string, number>;
};

const globalState = globalThis as typeof globalThis & {
  __ipHealthApiProtection?: ApiProtectionState;
};

const state =
  globalState.__ipHealthApiProtection ??
  (globalState.__ipHealthApiProtection = {
    rateLimits: new Map(),
    cache: new Map(),
    idempotencyKeys: new Map(),
  });

function pruneExpiredEntries(now: number) {
  if (state.rateLimits.size > 10_000) {
    for (const [key, entry] of state.rateLimits) {
      if (entry.resetAt <= now) {
        state.rateLimits.delete(key);
      }
    }
  }

  if (state.cache.size > 5_000) {
    for (const [key, entry] of state.cache) {
      if (entry.expiresAt <= now) {
        state.cache.delete(key);
      }
    }
  }

  if (state.idempotencyKeys.size > 10_000) {
    for (const [key, expiresAt] of state.idempotencyKeys) {
      if (expiresAt <= now) {
        state.idempotencyKeys.delete(key);
      }
    }
  }
}

export function checkRateLimit({
  request,
  namespace,
  limit,
  windowMs,
}: {
  request: NextRequest | Request;
  namespace: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  pruneExpiredEntries(now);

  const clientKey = getRequestIp(request) ?? "unknown";
  const key = `${namespace}:${clientKey}`;
  const current = state.rateLimits.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { ...current, count: current.count + 1 };

  state.rateLimits.set(key, entry);

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfterSeconds),
  };
}

export function enforceProviderRateLimit(
  request: NextRequest,
  namespace: string,
) {
  const result = checkRateLimit({
    request,
    namespace: `provider:${namespace}`,
    limit: 30,
    windowMs: 60_000,
  });

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429, headers: getRateLimitHeaders(result) },
  );
}

export function getProviderCacheKey(ip?: string | null) {
  return ip?.trim().toLowerCase() || "current";
}

export function getProviderCachedValue<T>(
  namespace: string,
  ip?: string | null,
) {
  return getCachedValue<T>(`provider:${namespace}`, getProviderCacheKey(ip));
}

export function setProviderCachedValue<T>(
  namespace: string,
  ip: string | null | undefined,
  value: T,
) {
  setCachedValue(
    `provider:${namespace}`,
    getProviderCacheKey(ip),
    value,
    300_000,
  );
}

export function providerJsonResponse(
  data: unknown,
  cacheStatus: "HIT" | "MISS",
) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control":
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "X-IP-Health-Cache": cacheStatus,
    },
  });
}

export function getCachedValue<T>(namespace: string, key: string): T | null {
  const cacheKey = `${namespace}:${key}`;
  const entry = state.cache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    state.cache.delete(cacheKey);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue<T>(
  namespace: string,
  key: string,
  value: T,
  ttlMs: number,
) {
  state.cache.set(`${namespace}:${key}`, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function registerIdempotencyKey(
  namespace: string,
  key: string,
  ttlMs: number,
) {
  const now = Date.now();
  const cacheKey = `${namespace}:${key}`;
  const expiresAt = state.idempotencyKeys.get(cacheKey);

  if (expiresAt && expiresAt > now) {
    return false;
  }

  state.idempotencyKeys.set(cacheKey, now + ttlMs);
  return true;
}
