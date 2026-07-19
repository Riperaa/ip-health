export type ScamalyticsUnavailableReason =
  "missing_configuration" | "invalid_response" | "api_error" | "network_error";

export type ScamalyticsProviderStatus =
  "Available" | "Unavailable" | "Not configured";

export type ProviderResult = {
  status?: "available" | "unavailable";
  reason?: ScamalyticsUnavailableReason;
  providerStatus?: ScamalyticsProviderStatus;
  score?: number | null;
  risk?: string | null;
  country?: string | null;
  countryCode?: string | null;
  isp?: string | null;
  asn?: string | null;
  proxy?: boolean | null;
  vpn?: boolean | null;
  tor?: boolean | null;
  server?: boolean | null;
  datacenter?: boolean | null;
  abuseSignals?: string[];
  blacklistSignals?: string[];
  raw?: unknown;
  error?: string;
};

type ScamalyticsApiResponse = Record<string, unknown>;

const SCAMALYTICS_BASE_URL = "https://api11.scamalytics.com/v3";
const DEFAULT_TIMEOUT_MS = 5000;
const USER_SAFE_UNAVAILABLE_ERROR = "Scamalytics data is unavailable.";
const NOT_CONFIGURED_ERROR = "Scamalytics is not configured.";

const ABUSE_SIGNAL_KEYS: Array<[key: string, label: string]> = [
  ["is_spam", "Spam"],
  ["is_abuser", "Abuser"],
  ["is_bot", "Bot"],
  ["is_web_spider", "Web spider"],
  ["is_search_engine_robot", "Search engine robot"],
  ["is_mail_server", "Mail server"],
];

const BLACKLIST_SIGNAL_KEYS: Array<[key: string, label: string]> = [
  ["is_blacklisted", "Blacklisted"],
  ["is_blacklisted_external", "Externally blacklisted"],
  ["blacklisted", "Blacklisted"],
  ["on_blacklist", "On blacklist"],
];

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

function parseAsn(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `AS${value}`;
  }

  const asn = parseString(value);

  if (!asn) {
    return null;
  }

  return asn.toUpperCase().startsWith("AS") ? asn.toUpperCase() : `AS${asn}`;
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

function pickAsn(raw: ScamalyticsApiResponse, keys: string[]) {
  for (const key of keys) {
    const value = parseAsn(raw[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function pickSignals(
  raw: ScamalyticsApiResponse,
  signalKeys: Array<[key: string, label: string]>,
) {
  return signalKeys
    .filter(([key]) => parseNullableBoolean(raw[key]) === true)
    .map(([, label]) => label);
}

function getCredentials() {
  const user = process.env.SCAMALYTICS_USER?.trim() ?? "";
  const apiKey = process.env.SCAMALYTICS_API_KEY?.trim() ?? "";

  return user && apiKey ? { user, apiKey } : null;
}

function buildScamalyticsUrl(ip: string) {
  const credentials = getCredentials();

  if (!credentials) {
    return null;
  }

  const url = new URL(
    `${SCAMALYTICS_BASE_URL}/${encodeURIComponent(credentials.user)}/`,
  );
  url.searchParams.set("key", credentials.apiKey);
  url.searchParams.set("ip", ip);

  return url;
}

function getProviderError(raw: ScamalyticsApiResponse) {
  const status = pickString(raw, ["status"])?.toLowerCase() ?? null;

  if (status && ["error", "failed", "failure"].includes(status)) {
    return pickString(raw, ["error", "message", "reason"]) ?? "api_error";
  }

  return pickString(raw, ["error"]);
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
  const datacenter = pickBoolean(raw, [
    "datacenter",
    "is_datacenter",
    "hosting",
    "is_hosting",
  ]);

  return {
    status: "available",
    providerStatus: "Available",
    score:
      score === null ? null : Math.min(Math.max(Math.round(score), 0), 100),
    risk: pickString(raw, ["risk", "risk_level", "riskLevel"]),
    country: pickString(raw, [
      "country",
      "country_name",
      "ip_country_name",
      "country_code",
      "ip_country_code",
    ]),
    countryCode: pickString(raw, ["country_code", "ip_country_code"]),
    isp: pickString(raw, [
      "isp",
      "ip_isp",
      "ip_isp_name",
      "organization",
      "org",
      "ip_org_name",
    ]),
    asn: pickAsn(raw, ["asn", "ip_asn"]),
    proxy: pickBoolean(raw, ["proxy", "is_proxy", "public_proxy"]),
    vpn: pickBoolean(raw, ["vpn", "is_vpn", "anonymous_vpn"]),
    tor: pickBoolean(raw, ["tor", "is_tor", "tor_exit"]),
    server: datacenter ?? pickBoolean(raw, ["server", "is_server", "hosting"]),
    datacenter,
    abuseSignals: pickSignals(raw, ABUSE_SIGNAL_KEYS),
    blacklistSignals: pickSignals(raw, BLACKLIST_SIGNAL_KEYS),
  };
}

export function createUnavailableScamalyticsResult({
  reason = "api_error",
  error = USER_SAFE_UNAVAILABLE_ERROR,
}: {
  reason?: ScamalyticsUnavailableReason;
  error?: string;
} = {}): ProviderResult {
  const isMissingConfiguration = reason === "missing_configuration";

  return {
    status: "unavailable",
    reason,
    providerStatus: isMissingConfiguration ? "Not configured" : "Unavailable",
    score: null,
    risk: null,
    country: null,
    countryCode: null,
    isp: null,
    asn: null,
    proxy: null,
    vpn: null,
    tor: null,
    server: null,
    datacenter: null,
    abuseSignals: [],
    blacklistSignals: [],
    error: isMissingConfiguration ? NOT_CONFIGURED_ERROR : error,
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
      return createUnavailableScamalyticsResult({
        reason: raw ? "api_error" : "invalid_response",
      });
    }

    if (getProviderError(raw)) {
      return createUnavailableScamalyticsResult({ reason: "api_error" });
    }

    return normalizeScamalyticsResponse(raw);
  } catch {
    return createUnavailableScamalyticsResult({ reason: "network_error" });
  } finally {
    clearTimeout(timeout);
  }
}
