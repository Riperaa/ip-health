export type IpApiIsUnavailableReason =
  | "api_error"
  | "invalid_response"
  | "network_error"
  | "provider_error"
  | "rate_limited";

export type IpApiIsProviderStatus = {
  httpStatusCode: number | null;
  providerError: string | null;
};

export type ProviderResult = {
  status: "available" | "unavailable";
  reason?: IpApiIsUnavailableReason;
  providerStatus: IpApiIsProviderStatus;
  vpn: boolean | null;
  proxy: boolean | null;
  tor: boolean | null;
  datacenter: boolean | null;
  hosting: boolean | null;
  asn: string | null;
  asnName: string | null;
  organization: string | null;
  isp: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  abuser: boolean | null;
  companyAbuserScore: string | null;
  asnAbuserScore: string | null;
  error?: string;
};

type IpApiIsResponse = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 5000;
const USER_SAFE_UNAVAILABLE_ERROR = "ipapi.is data is unavailable.";

function getTimeoutMs() {
  const timeoutMs = Number(
    process.env.IPAPI_IS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
}

function buildIpApiIsUrl(ip: string) {
  const url = new URL("https://api.ipapi.is/");
  url.searchParams.set("q", ip);

  return url;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function getRecord(raw: IpApiIsResponse, key: string) {
  const value = raw[key];

  return isObjectRecord(value) ? value : {};
}

function getHostingSignal(
  raw: IpApiIsResponse,
  company: Record<string, unknown>,
  asn: Record<string, unknown>,
) {
  const datacenter = parseNullableBoolean(raw.is_datacenter);
  const companyType = parseString(company.type)?.toLowerCase() ?? "";
  const asnType = parseString(asn.type)?.toLowerCase() ?? "";

  if (
    datacenter === true ||
    companyType === "hosting" ||
    asnType === "hosting"
  ) {
    return true;
  }

  if (datacenter === false && companyType && asnType) {
    return false;
  }

  return datacenter;
}

function normalizeIpApiIsResponse(
  raw: IpApiIsResponse,
  httpStatusCode: number,
): ProviderResult {
  const company = getRecord(raw, "company");
  const asn = getRecord(raw, "asn");
  const location = getRecord(raw, "location");
  const datacenter = parseNullableBoolean(raw.is_datacenter);
  const providerError = parseString(raw.error);

  if (providerError) {
    return createUnavailableIpApiIsResult({
      reason: "provider_error",
      providerStatus: {
        httpStatusCode,
        providerError,
      },
    });
  }

  if (!parseString(raw.ip)) {
    return createUnavailableIpApiIsResult({
      reason: "invalid_response",
      providerStatus: {
        httpStatusCode,
        providerError: null,
      },
    });
  }

  return {
    status: "available",
    providerStatus: {
      httpStatusCode,
      providerError: null,
    },
    vpn: parseNullableBoolean(raw.is_vpn),
    proxy: parseNullableBoolean(raw.is_proxy),
    tor: parseNullableBoolean(raw.is_tor),
    datacenter,
    hosting: getHostingSignal(raw, company, asn),
    asn: parseAsn(asn.asn),
    asnName: parseString(asn.org) ?? parseString(asn.descr),
    organization: parseString(company.name) ?? parseString(asn.org),
    isp: parseString(company.name) ?? parseString(asn.org),
    country: parseString(location.country),
    countryCode:
      parseString(location.country_code) ??
      parseString(location.country) ??
      parseString(asn.country),
    region: parseString(location.state) ?? parseString(location.region),
    city: parseString(location.city),
    abuser: parseNullableBoolean(raw.is_abuser),
    companyAbuserScore: parseString(company.abuser_score),
    asnAbuserScore: parseString(asn.abuser_score),
  };
}

export function createUnavailableIpApiIsResult({
  reason = "api_error",
  providerStatus = {
    httpStatusCode: null,
    providerError: null,
  },
  error = USER_SAFE_UNAVAILABLE_ERROR,
}: {
  reason?: IpApiIsUnavailableReason;
  providerStatus?: IpApiIsProviderStatus;
  error?: string;
} = {}): ProviderResult {
  return {
    status: "unavailable",
    reason,
    providerStatus,
    vpn: null,
    proxy: null,
    tor: null,
    datacenter: null,
    hosting: null,
    asn: null,
    asnName: null,
    organization: null,
    isp: null,
    country: null,
    countryCode: null,
    region: null,
    city: null,
    abuser: null,
    companyAbuserScore: null,
    asnAbuserScore: null,
    error,
  };
}

async function parseResponseJson(response: Response) {
  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as IpApiIsResponse;
  } catch {
    return null;
  }
}

function logNormalizedResult(result: ProviderResult) {
  console.info("[ipapi.is] normalized result", {
    status: result.status,
    reason: result.status === "unavailable" ? result.reason : undefined,
  });
}

export async function lookup(ip: string): Promise<ProviderResult> {
  console.info("[ipapi.is] request started");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(buildIpApiIsUrl(ip), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const providerStatus = {
      httpStatusCode: response.status,
      providerError: null,
    };

    console.info("[ipapi.is] provider HTTP status", {
      httpStatusCode: response.status,
    });

    if (response.status === 429) {
      const result = createUnavailableIpApiIsResult({
        reason: "rate_limited",
        providerStatus,
      });
      logNormalizedResult(result);

      return result;
    }

    const raw = await parseResponseJson(response);

    if (!response.ok || !raw) {
      const result = createUnavailableIpApiIsResult({
        reason: raw ? "api_error" : "invalid_response",
        providerStatus,
      });
      logNormalizedResult(result);

      return result;
    }

    const result = normalizeIpApiIsResponse(raw, response.status);
    logNormalizedResult(result);

    return result;
  } catch {
    const result = createUnavailableIpApiIsResult({
      reason: "network_error",
    });
    logNormalizedResult(result);

    return result;
  } finally {
    clearTimeout(timeout);
  }
}
