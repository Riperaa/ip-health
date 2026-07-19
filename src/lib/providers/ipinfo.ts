type Params = {
  ip?: string;
};

type IpWhoResponse = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  connection?: {
    asn?: number;
    org?: string;
    isp?: string;
  };
  security?: {
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
    relay?: boolean;
    hosting?: boolean;
  };
};

export type ProviderResult = {
  ip?: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
  org?: string;
  asn?: {
    asn?: string;
    name?: string;
    type?: string;
  };
  company?: {
    name?: string;
    type?: string;
  };
  privacy?: {
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
    relay?: boolean;
    hosting?: boolean;
    service?: string;
  };
};

const token = process.env.IPINFO_TOKEN ?? process.env.NEXT_PUBLIC_IPINFO_TOKEN;
const DEFAULT_TIMEOUT_MS = 5000;

function getTimeoutMs() {
  const timeoutMs = Number(process.env.IPINFO_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildIpinfoUrl({ ip }: Params) {
  const path = ip ? `/${encodeURIComponent(ip)}/json` : "/json";
  const url = new URL(`https://ipinfo.io${path}`);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url;
}

function buildFallbackUrl({ ip }: Params) {
  if (!ip) {
    return new URL("https://ipwho.is/");
  }

  return new URL(`https://ipwho.is/${encodeURIComponent(ip)}`);
}

function normalizeFallbackResponse(data: IpWhoResponse): ProviderResult {
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country_code,
    country_name: data.country,
    asn: {
      asn: data.connection?.asn ? `AS${data.connection.asn}` : undefined,
      name: data.connection?.org ?? data.connection?.isp,
    },
    company: {
      name: data.connection?.isp ?? data.connection?.org,
    },
    privacy: {
      vpn: data.security?.vpn,
      proxy: data.security?.proxy,
      tor: data.security?.tor,
      relay: data.security?.relay,
      hosting: data.security?.hosting,
    },
  };
}

export async function lookupWithStatus(ip?: string) {
  let primaryData: ProviderResult = { ip };
  let primaryStatus = 502;

  try {
    const response = await fetchWithTimeout(
      buildIpinfoUrl({ ip: ip || undefined }),
    );
    primaryStatus = response.status;
    primaryData = (await response.json()) as ProviderResult;

    if (response.ok) {
      return { data: primaryData, status: response.status };
    }
  } catch {
    // Fall through to the independent provider below.
  }

  try {
    const fallbackResponse = await fetchWithTimeout(
      buildFallbackUrl({ ip: ip || undefined }),
    );
    const fallbackData = (await fallbackResponse.json()) as IpWhoResponse;

    if (fallbackResponse.ok) {
      return {
        data: normalizeFallbackResponse(fallbackData),
        status: fallbackResponse.status,
      };
    }
  } catch {
    // Preserve the primary provider status for the caller.
  }

  return {
    data: primaryData,
    status: primaryStatus,
  };
}

export async function lookup(ip?: string): Promise<ProviderResult> {
  const { data } = await lookupWithStatus(ip);

  return data;
}
