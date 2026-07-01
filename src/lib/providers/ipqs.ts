import { ProviderLookupError } from "./errors";

type IpqsResponse = {
  fraud_score?: unknown;
  vpn?: unknown;
  proxy?: unknown;
  tor?: unknown;
  bot_status?: unknown;
  active_vpn?: unknown;
  recent_abuse?: unknown;
};

export type ProviderResult = {
  fraudScore?: number | null;
  vpn?: boolean | null;
  proxy?: boolean | null;
  tor?: boolean | null;
  bot?: boolean | null;
  activeVpn?: boolean | null;
  recentAbuse?: boolean | null;
  raw?: unknown;
  error?: string;
};

const apiKey = process.env.IPQS_API_KEY;
const timeoutMs = Number(process.env.IPQS_TIMEOUT_MS ?? 5000);

function buildIpqsUrl(ip: string) {
  const url = new URL(
    `https://www.ipqualityscore.com/api/json/ip/${encodeURIComponent(apiKey ?? "")}/${encodeURIComponent(ip)}`,
  );

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
    fraudScore: parseNumber(raw.fraud_score),
    vpn: parseNullableBoolean(raw.vpn),
    proxy: parseNullableBoolean(raw.proxy),
    tor: parseNullableBoolean(raw.tor),
    bot: parseNullableBoolean(raw.bot_status),
    activeVpn: parseNullableBoolean(raw.active_vpn),
    recentAbuse: parseNullableBoolean(raw.recent_abuse),
    raw,
  };
}

export async function lookup(ip: string): Promise<ProviderResult> {
  if (!apiKey) {
    throw new ProviderLookupError(
      "IPQualityScore API key is not configured.",
      500,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildIpqsUrl(ip), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const raw = (await response.json()) as IpqsResponse;

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
