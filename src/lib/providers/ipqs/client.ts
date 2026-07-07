import { ProviderLookupError } from "../errors";

type IpqsApiResponse = {
  success?: unknown;
  message?: unknown;
  fraud_score?: unknown;
  country_code?: unknown;
  country?: unknown;
  vpn?: unknown;
  proxy?: unknown;
  tor?: unknown;
  bot_status?: unknown;
};

export type IpqsClientResult = {
  fraud_score: number;
  country: string;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  bot_status: boolean;
  debug: IpqsDebugInfo;
  raw: IpqsApiResponse;
};

export type IpqsUnavailableReason =
  | "missing_api_key"
  | "invalid_key"
  | "api_error"
  | "quota_limit"
  | "network_error";

export type IpqsDebugInfo = {
  requestExecuted: boolean;
  responseStatusCode: number | null;
  success: boolean | null;
  message: string | null;
};

export class IpqsLookupError extends ProviderLookupError {
  constructor(
    message: string,
    status: number,
    readonly reason: IpqsUnavailableReason,
    readonly debug: IpqsDebugInfo,
    raw?: unknown,
  ) {
    super(message, status, raw);
    this.name = "IpqsLookupError";
  }
}

const IPQS_BASE_URL = "https://ipqualityscore.com/api/json/ip";
const DEFAULT_TIMEOUT_MS = 5000;

function getTimeoutMs() {
  const timeoutMs = Number(process.env.IPQS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
}

function buildIpqsUrl(apiKey: string, ip: string) {
  return `${IPQS_BASE_URL}/${encodeURIComponent(apiKey)}/${encodeURIComponent(ip)}`;
}

function createDebugInfo(
  requestExecuted: boolean,
  responseStatusCode: number | null = null,
  success: boolean | null = null,
  message: string | null = null,
): IpqsDebugInfo {
  return {
    requestExecuted,
    responseStatusCode,
    success,
    message,
  };
}

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

function parseBoolean(value: unknown) {
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

  return false;
}

function parseNullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
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

function parseString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseMessage(value: unknown, apiKey: string) {
  const message = parseString(value);

  if (!message) {
    return null;
  }

  return message.replaceAll(apiKey, "[redacted]");
}

function normalizeIpqsResponse(
  raw: IpqsApiResponse,
  debug: IpqsDebugInfo,
): IpqsClientResult {
  return {
    fraud_score: Math.min(Math.max(parseNumber(raw.fraud_score) ?? 0, 0), 100),
    country: parseString(raw.country_code) || parseString(raw.country),
    vpn: parseBoolean(raw.vpn),
    proxy: parseBoolean(raw.proxy),
    tor: parseBoolean(raw.tor),
    bot_status: parseBoolean(raw.bot_status),
    debug,
    raw,
  };
}

function getIpqsFailureReason(
  statusCode: number | null,
  message: string | null,
): IpqsUnavailableReason {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (
    statusCode === 402 ||
    statusCode === 429 ||
    /\b(quota|limit|limited|rate|credits?|billing|subscription|plan|exceeded)\b/.test(
      normalizedMessage,
    )
  ) {
    return "quota_limit";
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    (/\b(api\s*)?key\b/.test(normalizedMessage) &&
      /\b(invalid|unauthorized|unauthorised|authentication|auth|missing)\b/.test(
        normalizedMessage,
      ))
  ) {
    return "invalid_key";
  }

  return "api_error";
}

async function parseResponseJson(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as IpqsApiResponse;
  } catch {
    return null;
  }
}

export async function lookupIpQualityScore(
  ip: string,
): Promise<IpqsClientResult> {
  const apiKey = process.env.IPQS_API_KEY?.trim();

  if (!apiKey) {
    throw new IpqsLookupError(
      "IPQualityScore API key is not configured.",
      500,
      "missing_api_key",
      createDebugInfo(false),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
  let requestExecuted = false;

  try {
    requestExecuted = true;
    const response = await fetch(buildIpqsUrl(apiKey, ip), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const raw = await parseResponseJson(response);
    const debug = createDebugInfo(
      requestExecuted,
      response.status,
      raw ? parseNullableBoolean(raw.success) : null,
      raw ? parseMessage(raw.message, apiKey) : null,
    );

    if (!raw) {
      throw new IpqsLookupError(
        "IPQualityScore returned an invalid JSON response.",
        response.status,
        "api_error",
        debug,
      );
    }

    if (!response.ok) {
      throw new IpqsLookupError(
        "IPQualityScore request failed.",
        response.status,
        getIpqsFailureReason(response.status, debug.message),
        debug,
        raw,
      );
    }

    if (debug.success === false) {
      throw new IpqsLookupError(
        "IPQualityScore request was unsuccessful.",
        502,
        getIpqsFailureReason(response.status, debug.message),
        debug,
        raw,
      );
    }

    return normalizeIpqsResponse(raw, debug);
  } catch (error) {
    if (error instanceof IpqsLookupError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new IpqsLookupError(
        "IPQualityScore request timed out.",
        504,
        "network_error",
        createDebugInfo(requestExecuted),
      );
    }

    throw new IpqsLookupError(
      "Unable to fetch IPQualityScore data.",
      502,
      "network_error",
      createDebugInfo(requestExecuted),
    );
  } finally {
    clearTimeout(timeout);
  }
}
