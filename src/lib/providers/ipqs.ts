import { ProviderLookupError } from "./errors";
import {
  IpqsLookupError,
  lookupIpQualityScore,
  type IpqsDebugInfo,
  type IpqsClientResult,
  type IpqsUnavailableReason,
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
  reason?: IpqsUnavailableReason;
  fraudScore?: number | null;
  country?: string | null;
  vpn?: boolean | null;
  proxy?: boolean | null;
  tor?: boolean | null;
  bot?: boolean | null;
  activeVpn?: boolean | null;
  recentAbuse?: boolean | null;
  raw?: unknown;
  debug?: IpqsDebugInfo;
  error?: string;
};

export type { IpqsDebugInfo, IpqsUnavailableReason };

const USER_SAFE_UNAVAILABLE_ERROR = "IPQualityScore data is unavailable.";

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
    raw: result.raw,
    debug: result.debug,
  };
}

function createDefaultDebug(): IpqsDebugInfo {
  return {
    requestExecuted: false,
    responseStatusCode: null,
    success: null,
    message: null,
  };
}

export function createUnavailableIpqsResult({
  reason = "api_error",
  debug = createDefaultDebug(),
  error = USER_SAFE_UNAVAILABLE_ERROR,
}: {
  reason?: IpqsUnavailableReason;
  debug?: IpqsDebugInfo;
  error?: string;
} = {}): ProviderResult {
  return {
    status: "unavailable",
    reason,
    fraudScore: null,
    country: null,
    vpn: null,
    proxy: null,
    tor: null,
    bot: null,
    activeVpn: null,
    recentAbuse: null,
    debug,
    error,
  };
}

export async function lookup(ip: string): Promise<ProviderResult> {
  try {
    return normalizeClientResult(await lookupIpQualityScore(ip));
  } catch (error) {
    if (error instanceof IpqsLookupError) {
      return createUnavailableIpqsResult({
        reason: error.reason,
        debug: error.debug,
      });
    }

    if (error instanceof ProviderLookupError) {
      return createUnavailableIpqsResult({
        reason: "api_error",
        debug: createDefaultDebug(),
      });
    }

    return createUnavailableIpqsResult({
      reason: "network_error",
      debug: createDefaultDebug(),
    });
  }
}

export function normalizeRawResponse(raw: IpqsResponse): ProviderResult {
  return normalizeIpqsResponse(raw);
}
