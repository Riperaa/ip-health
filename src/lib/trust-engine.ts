export type IpInfoResponse = {
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

export type AbuseIpDbResponse = {
  abuseConfidence?: number | null;
  usageType?: string | null;
  isp?: string | null;
  domain?: string | null;
  isWhitelisted?: boolean | null;
  raw?: unknown;
  error?: string;
};

function parseOrg(org?: string) {
  if (!org) {
    return {};
  }

  const [asn, ...nameParts] = org.split(" ");

  return {
    asn,
    name: nameParts.join(" "),
  };
}

function isDatacenterUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase() ?? "";

  return (
    normalized.includes("data center") ||
    normalized.includes("web hosting") ||
    normalized.includes("transit")
  );
}

function getAbuseIpDbPenalties(abuseIpDb?: AbuseIpDbResponse | null) {
  if (!abuseIpDb) {
    return [];
  }

  const abuseConfidence = abuseIpDb.abuseConfidence ?? null;

  return [
    abuseConfidence !== null && abuseConfidence >= 80 ? 30 : 0,
    abuseConfidence !== null && abuseConfidence >= 50 && abuseConfidence < 80
      ? 15
      : 0,
    isDatacenterUsage(abuseIpDb.usageType) ? 20 : 0,
  ];
}

function getIpInfoSignals(ipInfo: IpInfoResponse) {
  const parsedOrg = parseOrg(ipInfo.org);

  return {
    hasAsn: Boolean(ipInfo.asn?.asn ?? parsedOrg.asn),
    hasIspOrOrg: Boolean(
      ipInfo.company?.name ?? ipInfo.asn?.name ?? parsedOrg.name ?? ipInfo.org,
    ),
  };
}

function getAbuseIpDbReasons(abuseIpDb?: AbuseIpDbResponse | null) {
  if (!abuseIpDb) {
    return [];
  }

  const abuseConfidence = abuseIpDb.abuseConfidence ?? null;

  return [
    abuseConfidence !== null && abuseConfidence >= 80
      ? `AbuseIPDB confidence is ${abuseConfidence}% (high risk)`
      : null,
    abuseConfidence !== null && abuseConfidence >= 50 && abuseConfidence < 80
      ? `AbuseIPDB confidence is ${abuseConfidence}% (elevated risk)`
      : null,
    abuseConfidence !== null && abuseConfidence < 50
      ? `AbuseIPDB confidence is ${abuseConfidence}%`
      : null,
    isDatacenterUsage(abuseIpDb.usageType)
      ? `AbuseIPDB usage type is ${abuseIpDb.usageType}`
      : null,
    abuseIpDb.isWhitelisted === true ? "AbuseIPDB whitelist match" : null,
    abuseIpDb.isWhitelisted === false ? "No AbuseIPDB whitelist match" : null,
    abuseIpDb.isp ? `AbuseIPDB ISP: ${abuseIpDb.isp}` : null,
    abuseIpDb.domain ? `AbuseIPDB domain: ${abuseIpDb.domain}` : null,
    abuseConfidence === null &&
    !abuseIpDb.usageType &&
    abuseIpDb.isWhitelisted === null &&
    !abuseIpDb.isp &&
    !abuseIpDb.domain
      ? "AbuseIPDB returned no reputation details"
      : null,
  ].filter((reason): reason is string => Boolean(reason));
}

export function calculateTrustScore(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const { hasAsn, hasIspOrOrg } = getIpInfoSignals(ipInfo);
  const privacy = ipInfo.privacy;
  const penalties = [
    privacy?.hosting === true ? 20 : 0,
    privacy?.vpn === true ? 25 : 0,
    privacy?.proxy === true ? 25 : 0,
    privacy?.tor === true ? 40 : 0,
    privacy?.relay === true ? 15 : 0,
    hasAsn ? 0 : 10,
    hasIspOrOrg ? 0 : 5,
    ...getAbuseIpDbPenalties(abuseIpDb),
  ];

  return Math.max(
    0,
    Math.min(
      100,
      100 - penalties.reduce((total, penalty) => total + penalty, 0),
    ),
  );
}

export function buildReasons(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const { hasAsn, hasIspOrOrg } = getIpInfoSignals(ipInfo);
  const privacy = ipInfo.privacy;

  return [
    privacy?.vpn === true ? "VPN detected" : "No obvious VPN detected",
    privacy?.proxy === true ? "Proxy detected" : "No obvious proxy detected",
    privacy?.tor === true ? "Tor detected" : "No obvious Tor detected",
    privacy?.relay === true ? "Relay detected" : "No obvious relay detected",
    privacy?.hosting === true
      ? "Hosting network detected"
      : "No hosting network detected",
    hasAsn ? "ASN available" : "ASN missing",
    hasIspOrOrg ? "ISP/org available" : "ISP/org missing",
    ...getAbuseIpDbReasons(abuseIpDb),
  ];
}
