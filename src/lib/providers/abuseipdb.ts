import { ProviderLookupError } from "./errors";

type AbuseIpDbResponse = {
  data?: {
    abuseConfidenceScore?: unknown;
    usageType?: unknown;
    isp?: unknown;
    domain?: unknown;
    isWhitelisted?: unknown;
  };
};

export type ProviderResult = {
  abuseConfidence?: number | null;
  usageType?: string | null;
  isp?: string | null;
  domain?: string | null;
  isWhitelisted?: boolean | null;
  raw?: unknown;
  error?: string;
};

const apiKey = process.env.ABUSEIPDB_API_KEY;
const timeoutMs = Number(process.env.ABUSEIPDB_TIMEOUT_MS ?? 5000);
const maxAgeInDays = process.env.ABUSEIPDB_MAX_AGE_DAYS ?? "90";

function buildAbuseIpDbUrl(ip: string) {
  const url = new URL("https://api.abuseipdb.com/api/v2/check");
  url.searchParams.set("ipAddress", ip);
  url.searchParams.set("maxAgeInDays", maxAgeInDays);

  return url;
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

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
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

function normalizeAbuseIpDbResponse(raw: AbuseIpDbResponse): ProviderResult {
  const data = raw.data ?? {};

  return {
    abuseConfidence: parseNumber(data.abuseConfidenceScore),
    usageType: parseString(data.usageType),
    isp: parseString(data.isp),
    domain: parseString(data.domain),
    isWhitelisted: parseNullableBoolean(data.isWhitelisted),
    raw,
  };
}

export async function lookup(ip: string): Promise<ProviderResult> {
  if (!apiKey) {
    throw new ProviderLookupError("AbuseIPDB API key is not configured.", 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildAbuseIpDbUrl(ip), {
      headers: {
        Accept: "application/json",
        Key: apiKey,
      },
      signal: controller.signal,
    });

    const raw = (await response.json()) as AbuseIpDbResponse;

    if (!response.ok) {
      throw new ProviderLookupError(
        "AbuseIPDB request failed.",
        response.status,
        raw,
      );
    }

    return normalizeAbuseIpDbResponse(raw);
  } catch (error) {
    if (error instanceof ProviderLookupError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderLookupError("AbuseIPDB request timed out.", 504);
    }

    throw new ProviderLookupError("Unable to fetch AbuseIPDB data.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
