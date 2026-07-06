import { ProviderLookupError } from "../errors";

type IpqsApiResponse = {
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
};

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

function parseString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIpqsResponse(raw: IpqsApiResponse): IpqsClientResult {
  return {
    fraud_score: Math.min(Math.max(parseNumber(raw.fraud_score) ?? 0, 0), 100),
    country: parseString(raw.country_code) || parseString(raw.country),
    vpn: parseBoolean(raw.vpn),
    proxy: parseBoolean(raw.proxy),
    tor: parseBoolean(raw.tor),
    bot_status: parseBoolean(raw.bot_status),
  };
}

export async function lookupIpQualityScore(
  ip: string,
): Promise<IpqsClientResult> {
  const apiKey = process.env.IPQS_API_KEY;

  if (!apiKey) {
    throw new ProviderLookupError(
      "IPQualityScore API key is not configured.",
      500,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(buildIpqsUrl(apiKey, ip), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const raw = (await response.json()) as IpqsApiResponse;

    if (!response.ok) {
      throw new ProviderLookupError(
        "IPQualityScore request failed.",
        response.status,
        raw,
      );
    }

    return normalizeIpqsResponse(raw);
  } catch (error) {
    if (error instanceof ProviderLookupError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderLookupError("IPQualityScore request timed out.", 504);
    }

    throw new ProviderLookupError("Unable to fetch IPQualityScore data.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
