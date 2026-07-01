type Params = {
  ip?: string;
};

type IpWhoResponse = {
  ip?: string;
  city?: string;
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
  city?: string;
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
  const response = await fetch(buildIpinfoUrl({ ip: ip || undefined }), {
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json()) as ProviderResult;

  if (!token && response.status === 429) {
    const fallbackResponse = await fetch(buildFallbackUrl({ ip: ip || undefined }), {
      headers: {
        Accept: "application/json",
      },
    });
    const fallbackData = (await fallbackResponse.json()) as IpWhoResponse;

    return {
      data: normalizeFallbackResponse(fallbackData),
      status: fallbackResponse.status,
    };
  }

  return {
    data,
    status: response.status,
  };
}

export async function lookup(ip?: string): Promise<ProviderResult> {
  const { data } = await lookupWithStatus(ip);

  return data;
}
