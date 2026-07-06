import { ProviderLookupError } from "./errors";
import {
  lookupIpQualityScore,
  type IpqsClientResult,
} from "./ipqs/client";

type IpqsResponse = {
  fraud_score?: unknown;
  country?: unknown;
  vpn?: unknown;
  proxy?: unknown;
  tor?: unknown;
  bot_status?: unknown;
  active_vpn?: unknown;
  recent_abuse?: unknown;
};

export type ProviderResult = {
  status?: "available" | "unavailable";
  fraudScore?: number | null;
  country?: string | null;
  vpn?: boolean | null;
  proxy?: boolean | null;
  tor?: boolean | null;
  bot?: boolean | null;
  activeVpn?: boolean | null;
  recentAbuse?: boolean | null;
  raw?: unknown;
  error?: string;
};

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseNullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeIpqsResponse(raw: IpqsResponse): ProviderResult {
  return {
    status: "available",
    fraudScore: parseNumber(raw.fraud_score),
    country: typeof raw.country === "string" ? raw.country : null,
    vpn: parseNullableBoolean(raw.vpn),
    proxy: parseNullableBoolean(raw.proxy),
    tor: parseNullableBoolean(raw.tor),
    bot: parseNullableBoolean(raw.bot_status),
    activeVpn: parseNullableBoolean(raw.active_vpn),
    recentAbuse: parseNullableBoolean(raw.recent_abuse),
    raw,
  };
}

function normalizeClientResult(result: IpqsClientResult): ProviderResult {
  return {
    status: "available",
    fraudScore: result.fraud_score,
    country: result.country || null,
    vpn: result.vpn,
    proxy: result.proxy,
    tor: result.tor,
    bot: result.bot_status,
    activeVpn: null,
    recentAbuse: null,
    raw: result,
  };
}

export function createUnavailableIpqsResult(error?: string): ProviderResult {
  return {
    status: "unavailable",
    fraudScore: null,
    country: null,
    vpn: null,
    proxy: null,
    tor: null,
    bot: null,
    activeVpn: null,
    recentAbuse: null,
    error,
  };
}

export async function lookup(ip: string): Promise<ProviderResult> {
  try {
    return normalizeClientResult(await lookupIpQualityScore(ip));
  } catch (error) {
    if (error instanceof ProviderLookupError) {
      throw error;
    }

    throw new ProviderLookupError("Unable to fetch IPQualityScore data.", 502);
  }
}

export function normalizeRawResponse(raw: IpqsResponse): ProviderResult {
  return normalizeIpqsResponse(raw);
}
