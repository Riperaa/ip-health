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

export type RecommendationLabel =
  | "Recommended"
  | "Use with Caution"
  | "Not Recommended";

export type Recommendation = {
  label: RecommendationLabel;
  summary: string;
};

type ServiceCompatibilityProfile =
  | "general"
  | "social"
  | "ai"
  | "developer"
  | "finance"
  | "crypto";

type ServiceCompatibilityGroup = {
  category: string;
  services: {
    name: string;
    profile: ServiceCompatibilityProfile;
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

export function isInfrastructureUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase() ?? "";

  return (
    normalized.includes("data center") ||
    normalized.includes("web hosting") ||
    normalized.includes("transit") ||
    normalized.includes("hosting") ||
    normalized.includes("infrastructure") ||
    normalized.includes("cloud")
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
    isInfrastructureUsage(abuseIpDb.usageType) ? 20 : 0,
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

  if (isInfrastructureUsage(abuseIpDb.usageType)) {
    return `The usage type is ${abuseIpDb.usageType}, which is commonly associated with hosting or infrastructure networks.`;
  }

  return `The usage type is ${abuseIpDb.usageType}.`;
}

function getPrivacySignalSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
) {
  const privacy = ipInfo.privacy;
  const hasInfrastructureUsage = isInfrastructureUsage(abuseIpDb?.usageType);
  const signals = [
    privacy?.vpn === true || ipqs?.vpn === true || ipqs?.activeVpn === true
      ? "VPN"
      : null,
    privacy?.proxy === true || ipqs?.proxy === true ? "proxy" : null,
    privacy?.tor === true || ipqs?.tor === true ? "Tor" : null,
    privacy?.relay === true ? "relay" : null,
    privacy?.hosting === true || hasInfrastructureUsage
      ? "hosting or infrastructure"
      : null,
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
      privacy?.hosting === true || isInfrastructureUsage(abuseIpDb?.usageType),
    vpn:
      privacy?.vpn === true ||
      ipqs?.vpn === true ||
      ipqs?.activeVpn === true,
    proxy: privacy?.proxy === true || ipqs?.proxy === true,
    tor: privacy?.tor === true || ipqs?.tor === true,
    relay: privacy?.relay === true,
  };
}

function getBaseRecommendationLabel(score: number): RecommendationLabel {
  if (score >= 85) {
    return "Recommended";
  }

  if (score >= 40) {
    return "Use with Caution";
  }

  return "Not Recommended";
}

function getBaseRecommendationSummary(score: number) {
  if (score >= 85) {
    return "Suitable for most common online services.";
  }

  if (score >= 65) {
    return "Suitable for general browsing, but use caution with accounts, payments, and crypto services.";
  }

  if (score >= 40) {
    return "Acceptable for basic browsing, but not recommended for sensitive accounts, payments, or crypto exchanges.";
  }

  return "This IP has significant risk signals and should not be used for sensitive services.";
}

function getServiceCompatibilityStatus(
  profile: ServiceCompatibilityProfile,
  signals: ReturnType<typeof getCompatibilitySignals>,
): ServiceCompatibilityStatus {
  const abuseConfidence = signals.abuseConfidence;

  if (profile === "social") {
    if (signals.hosting || (abuseConfidence !== null && abuseConfidence >= 50)) {
      return "Use with Caution";
    }

    if (
      signals.score >= 85 &&
      abuseConfidence !== null &&
      abuseConfidence < 25
    ) {
      return "Good";
    }

    if (signals.score < 40) {
      return "High Risk";
    }

    return "Use with Caution";
  }

  if (signals.score < 40) {
    return "High Risk";
  }

  if (signals.score < 65) {
    return profile === "general" || profile === "ai" || profile === "developer"
      ? "Use with Caution"
      : "High Risk";
  }

  if (signals.score < 85) {
    if (profile === "ai" || profile === "developer" || profile === "finance") {
      return "Use with Caution";
    }

    return profile === "general" ? "Good" : "High Risk";
  }

  return profile === "general" || profile === "ai" || profile === "developer"
    ? "Good"
    : "Use with Caution";
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
    isInfrastructureUsage(abuseIpDb.usageType)
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
  const hasHostingOrInfrastructure =
    privacy?.hosting === true || isInfrastructureUsage(abuseIpDb?.usageType);

  return [
    privacy?.vpn === true ? "VPN detected" : "No obvious VPN detected",
    privacy?.proxy === true ? "Proxy detected" : "No obvious proxy detected",
    privacy?.tor === true ? "Tor detected" : "No obvious Tor detected",
    privacy?.relay === true ? "Relay detected" : "No obvious relay detected",
    hasHostingOrInfrastructure
      ? "Hosting or infrastructure usage detected"
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
    getPrivacySignalSummary(ipInfo, abuseIpDb, ipqs),
  ].join(" ");
}

export function buildServiceCompatibility(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
): ServiceCompatibilityCategory[] {
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs);
  const groups: ServiceCompatibilityGroup[] = [
    {
      category: "GENERAL WEB",
      services: [
        { name: "YouTube", profile: "general" },
        { name: "Reddit", profile: "general" },
        { name: "Wikipedia", profile: "general" },
        { name: "Facebook", profile: "social" },
        { name: "Instagram", profile: "social" },
        { name: "X", profile: "social" },
        { name: "TikTok", profile: "social" },
      ],
    },
    {
      category: "AI SERVICES",
      services: [
        { name: "ChatGPT", profile: "ai" },
        { name: "Claude", profile: "ai" },
        { name: "Gemini", profile: "ai" },
        { name: "Perplexity", profile: "ai" },
        { name: "Grok", profile: "ai" },
      ],
    },
    {
      category: "DEVELOPER",
      services: [
        { name: "GitHub", profile: "developer" },
        { name: "GitLab", profile: "developer" },
        { name: "Cloudflare", profile: "developer" },
        { name: "Vercel", profile: "developer" },
      ],
    },
    {
      category: "FINANCE",
      services: [
        { name: "PayPal", profile: "finance" },
        { name: "Wise", profile: "finance" },
        { name: "Stripe", profile: "finance" },
        { name: "Revolut", profile: "finance" },
      ],
    },
    {
      category: "CRYPTO",
      services: [
        { name: "Binance", profile: "crypto" },
        { name: "Coinbase", profile: "crypto" },
        { name: "Kraken", profile: "crypto" },
        { name: "Bybit", profile: "crypto" },
        { name: "OKX", profile: "crypto" },
      ],
    },
  ];

  return groups.map((group) => ({
    category: group.category,
    services: group.services.map((service) => ({
      name: service.name,
      status: getServiceCompatibilityStatus(service.profile, signals),
    })),
  }));
}

export function buildRecommendation(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
): Recommendation {
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs);
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs);
  const serviceCompatibility = buildServiceCompatibility(ipInfo, abuseIpDb, ipqs);
  const hasHighRiskService = serviceCompatibility.some((category) =>
    category.services.some((service) => service.status === "High Risk"),
  );
  const hasCautionService = serviceCompatibility.some((category) =>
    category.services.some((service) => service.status === "Use with Caution"),
  );
  const hasPrivacyOrInfrastructureSignal =
    signals.vpn ||
    signals.proxy ||
    signals.tor ||
    signals.relay ||
    signals.hosting;

  if (abuseConfidence !== null && abuseConfidence >= 85) {
    return {
      label: "Not Recommended",
      summary:
        "This IP has severe abuse history and should not be used for sensitive services.",
    };
  }

  if (signals.tor) {
    return {
      label: "Not Recommended",
      summary:
        "Tor is detected, so this IP should not be used for sensitive accounts, payments, or crypto exchanges.",
    };
  }

  const label = getBaseRecommendationLabel(score);

  if (label === "Recommended" && hasPrivacyOrInfrastructureSignal) {
    return {
      label,
      summary:
        "Suitable for most common online services, though privacy or infrastructure signals may affect stricter platforms.",
    };
  }

  if (label === "Use with Caution" && hasPrivacyOrInfrastructureSignal) {
    return {
      label,
      summary:
        "Privacy or infrastructure signals affect this IP, so use caution with accounts, payments, and crypto services.",
    };
  }

  if (label === "Use with Caution" && (hasHighRiskService || hasCautionService)) {
    return {
      label,
      summary:
        "Suitable for general browsing, but some services may restrict accounts, payments, or crypto activity.",
    };
  }

  return {
    label,
    summary: getBaseRecommendationSummary(score),
  };
}
