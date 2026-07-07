export type ScamalyticsUnavailableReason =
  | "missing_configuration"
  | "api_error"
  | "network_error";

export type ProviderResult = {
  status?: "available" | "unavailable";
  reason?: ScamalyticsUnavailableReason;
  score?: number | null;
  risk?: string | null;
  country?: string | null;
  isp?: string | null;
  proxy?: boolean | null;
  vpn?: boolean | null;
  tor?: boolean | null;
  server?: boolean | null;
  raw?: unknown;
  error?: string;
};

type ScamalyticsApiResponse = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://api12.scamalytics.com/v3";
const DEFAULT_TIMEOUT_MS = 5000;
const USER_SAFE_UNAVAILABLE_ERROR = "Scamalytics data is unavailable.";

function getTimeoutMs() {
  const timeoutMs = Number(
    process.env.SCAMALYTICS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
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

    if (["1", "true", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(raw: ScamalyticsApiResponse, keys: string[]) {
  for (const key of keys) {
    const value = parseNumber(raw[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function pickString(raw: ScamalyticsApiResponse, keys: string[]) {
  for (const key of keys) {
    const value = parseString(raw[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function pickBoolean(raw: ScamalyticsApiResponse, keys: string[]) {
  for (const key of keys) {
    const value = parseNullableBoolean(raw[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function buildScamalyticsUrl(ip: string) {
  const apiKey = process.env.SCAMALYTICS_API_KEY?.trim() ?? "";
  const urlTemplate = process.env.SCAMALYTICS_API_URL?.trim();

  if (urlTemplate) {
    return urlTemplate
      .replaceAll("{ip}", encodeURIComponent(ip))
      .replaceAll("{key}", encodeURIComponent(apiKey));
  }

  if (!apiKey) {
    return null;
  }

  const baseUrl = (
    process.env.SCAMALYTICS_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  return `${baseUrl}/${encodeURIComponent(apiKey)}/?ip=${encodeURIComponent(ip)}`;
}

function normalizeScamalyticsResponse(
  raw: ScamalyticsApiResponse,
): ProviderResult {
  const score = pickNumber(raw, [
    "score",
    "risk_score",
    "fraud_score",
    "scamalytics_score",
  ]);

  return {
    status: "available",
    score: score === null ? null : Math.min(Math.max(Math.round(score), 0), 100),
    risk: pickString(raw, ["risk", "risk_level", "riskLevel"]),
    country: pickString(raw, ["country", "country_code", "ip_country_code"]),
    isp: pickString(raw, ["isp", "ip_isp", "organization", "org"]),
    proxy: pickBoolean(raw, ["proxy", "is_proxy", "public_proxy"]),
    vpn: pickBoolean(raw, ["vpn", "is_vpn", "anonymous_vpn"]),
    tor: pickBoolean(raw, ["tor", "is_tor", "tor_exit"]),
    server: pickBoolean(raw, ["server", "is_server", "hosting"]),
    raw,
  };
}

export function createUnavailableScamalyticsResult({
  reason = "api_error",
  error = USER_SAFE_UNAVAILABLE_ERROR,
}: {
  reason?: ScamalyticsUnavailableReason;
  error?: string;
} = {}): ProviderResult {
  return {
    status: "unavailable",
    reason,
    score: null,
    risk: null,
    country: null,
    isp: null,
    proxy: null,
    vpn: null,
    tor: null,
    server: null,
    error,
  };
}

async function parseResponseJson(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as ScamalyticsApiResponse;
  } catch {
    return null;
  }
}

export async function lookup(ip: string): Promise<ProviderResult> {
  const url = buildScamalyticsUrl(ip);

  if (!url) {
    return createUnavailableScamalyticsResult({
      reason: "missing_configuration",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const raw = await parseResponseJson(response);

    if (!response.ok || !raw) {
      return createUnavailableScamalyticsResult({ reason: "api_error" });
    }

    return normalizeScamalyticsResponse(raw);
  } catch {
    return createUnavailableScamalyticsResult({ reason: "network_error" });
  } finally {
    clearTimeout(timeout);
  }
}
