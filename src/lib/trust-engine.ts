import type { ProviderResult as AbuseIpDbResponse } from "./providers/abuseipdb";
import type { ProviderResult as IpInfoResponse } from "./providers/ipinfo";
import type { ProviderResult as IpqsResponse } from "./providers/ipqs";

export type { ProviderResult as AbuseIpDbResponse } from "./providers/abuseipdb";
export type { ProviderResult as IpInfoResponse } from "./providers/ipinfo";
export type { ProviderResult as IpqsResponse } from "./providers/ipqs";

export type ServiceCompatibilityStatus =
  | "Good"
  | "Use with Caution"
  | "High Risk";

export type ServiceCompatibilityCategory = {
  category: string;
  services: {
    name: string;
    status: ServiceCompatibilityStatus;
  }[];
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

function getIpqsPenalties(ipqs?: IpqsResponse | null) {
  if (!ipqs) {
    return [];
  }

  const fraudScore = ipqs.fraudScore ?? null;

  return [
    fraudScore !== null && fraudScore >= 85 ? 30 : 0,
    fraudScore !== null && fraudScore >= 60 && fraudScore < 85 ? 20 : 0,
    ipqs.vpn === true ? 25 : 0,
    ipqs.proxy === true ? 25 : 0,
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

function getScoreSummary(score: number) {
  if (score >= 90) {
    return "low risk";
  }

  if (score >= 70) {
    return "generally trustworthy";
  }

  if (score >= 40) {
    return "some risk";
  }

  return "high risk";
}

function getAbuseIpDbSummary(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "AbuseIPDB did not provide a confidence score.";
  }

  if (abuseConfidence >= 80) {
    return `AbuseIPDB reports a high abuse confidence of ${abuseConfidence}%.`;
  }

  if (abuseConfidence >= 50) {
    return `AbuseIPDB reports an elevated abuse confidence of ${abuseConfidence}%.`;
  }

  return `AbuseIPDB abuse confidence is ${abuseConfidence}%.`;
}

function getUsageSummary(abuseIpDb?: AbuseIpDbResponse | null) {
  if (!abuseIpDb?.usageType) {
    return "No specific usage type was reported.";
  }

  if (isDatacenterUsage(abuseIpDb.usageType)) {
    return `The usage type is ${abuseIpDb.usageType}, which is commonly associated with hosting or infrastructure networks.`;
  }

  return `The usage type is ${abuseIpDb.usageType}.`;
}

function getPrivacySignalSummary(
  ipInfo: IpInfoResponse,
  ipqs?: IpqsResponse | null,
) {
  const privacy = ipInfo.privacy;
  const signals = [
    privacy?.vpn === true || ipqs?.vpn === true || ipqs?.activeVpn === true
      ? "VPN"
      : null,
    privacy?.proxy === true || ipqs?.proxy === true ? "proxy" : null,
    privacy?.tor === true || ipqs?.tor === true ? "Tor" : null,
    privacy?.relay === true ? "relay" : null,
    privacy?.hosting === true ? "hosting" : null,
  ].filter((signal): signal is string => Boolean(signal));

  if (signals.length === 0) {
    return "No obvious VPN, proxy, Tor, relay, or hosting signals were detected.";
  }

  return `Detected privacy or infrastructure signals: ${signals.join(", ")}.`;
}

function getCompatibilitySignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
) {
  const privacy = ipInfo.privacy;

  return {
    score: calculateTrustScore(ipInfo, abuseIpDb, ipqs),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    hosting:
      privacy?.hosting === true || isDatacenterUsage(abuseIpDb?.usageType),
    vpn:
      privacy?.vpn === true ||
      ipqs?.vpn === true ||
      ipqs?.activeVpn === true,
    proxy: privacy?.proxy === true || ipqs?.proxy === true,
    tor: privacy?.tor === true || ipqs?.tor === true,
  };
}

function getServiceCompatibilityStatus(
  profile: "general" | "developer" | "finance" | "crypto",
  signals: ReturnType<typeof getCompatibilitySignals>,
): ServiceCompatibilityStatus {
  const elevatedAbuse =
    signals.abuseConfidence !== null && signals.abuseConfidence >= 50;
  const highAbuse =
    signals.abuseConfidence !== null && signals.abuseConfidence >= 80;

  if (signals.tor || highAbuse || signals.score < 35) {
    return "High Risk";
  }

  if (profile === "finance") {
    if (signals.proxy || signals.score < 50) {
      return "High Risk";
    }

    if (
      elevatedAbuse ||
      signals.score < 80 ||
      signals.vpn ||
      signals.hosting
    ) {
      return "Use with Caution";
    }

    return "Good";
  }

  if (profile === "crypto") {
    if (
      signals.proxy ||
      signals.score < 50 ||
      (signals.vpn && signals.score < 70)
    ) {
      return "High Risk";
    }

    if (
      elevatedAbuse ||
      signals.score < 85 ||
      signals.vpn ||
      signals.hosting
    ) {
      return "Use with Caution";
    }

    return "Good";
  }

  if (profile === "developer") {
    if (signals.score < 40) {
      return "High Risk";
    }

    if (elevatedAbuse || signals.score < 70 || signals.vpn || signals.proxy) {
      return "Use with Caution";
    }

    return "Good";
  }

  if (
    elevatedAbuse ||
    signals.score < 70 ||
    signals.vpn ||
    signals.proxy ||
    signals.hosting
  ) {
    return "Use with Caution";
  }

  return "Good";
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

function getIpqsReasons(ipqs?: IpqsResponse | null) {
  if (!ipqs) {
    return [];
  }

  const fraudScore = ipqs.fraudScore ?? null;

  return [
    fraudScore !== null && fraudScore >= 85
      ? `IPQS fraud score is ${fraudScore} (high risk)`
      : null,
    fraudScore !== null && fraudScore >= 60 && fraudScore < 85
      ? `IPQS fraud score is ${fraudScore} (elevated risk)`
      : null,
    fraudScore !== null && fraudScore < 60
      ? `IPQS fraud score is ${fraudScore}`
      : null,
    ipqs.vpn === true ? "IPQS VPN detected" : null,
    ipqs.proxy === true ? "IPQS proxy detected" : null,
    ipqs.tor === true ? "IPQS Tor detected" : null,
    ipqs.bot === true ? "IPQS bot traffic detected" : null,
    ipqs.activeVpn === true ? "IPQS active VPN detected" : null,
    ipqs.recentAbuse === true ? "IPQS recent abuse detected" : null,
    fraudScore === null &&
    ipqs.vpn === null &&
    ipqs.proxy === null &&
    ipqs.tor === null &&
    ipqs.bot === null &&
    ipqs.activeVpn === null &&
    ipqs.recentAbuse === null
      ? "IPQS returned no reputation details"
      : null,
  ].filter((reason): reason is string => Boolean(reason));
}

export function calculateTrustScore(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
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
    ...getIpqsPenalties(ipqs),
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
  ipqs?: IpqsResponse | null,
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
    ...getIpqsReasons(ipqs),
  ];
}

export function buildRiskSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
) {
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs);

  return [
    `This IP has a trust score of ${score}/100, which suggests ${getScoreSummary(score)}.`,
    getAbuseIpDbSummary(abuseIpDb),
    getUsageSummary(abuseIpDb),
    getPrivacySignalSummary(ipInfo, ipqs),
  ].join(" ");
}

export function buildServiceCompatibility(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
): ServiceCompatibilityCategory[] {
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs);
  const groups = [
    {
      category: "General Web",
      profile: "general" as const,
      services: ["YouTube", "Reddit", "Wikipedia"],
    },
    {
      category: "Developer",
      profile: "developer" as const,
      services: ["GitHub", "Cloudflare"],
    },
    {
      category: "Finance",
      profile: "finance" as const,
      services: ["PayPal", "Wise"],
    },
    {
      category: "Crypto",
      profile: "crypto" as const,
      services: ["Binance", "Coinbase"],
    },
  ];

  return groups.map((group) => ({
    category: group.category,
    services: group.services.map((service) => ({
      name: service,
      status: getServiceCompatibilityStatus(group.profile, signals),
    })),
  }));
}
