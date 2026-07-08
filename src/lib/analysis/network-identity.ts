import type { StatusTone } from "@/lib/status-colors";

import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  EndUserReport,
  IpApiIsResponse,
  IpInfoResponse,
  IpqsResponse,
  NetworkIdentityCategory,
  NetworkIdentityConfidence,
} from "./types";

type NetworkIdentityInput = {
  ipInfo: IpInfoResponse;
  abuseIpDb?: AbuseIpDbResponse | null;
  ipqs?: IpqsResponse | null;
  cloudflare?: CloudflareTraceResponse | null;
  ipApiIs?: IpApiIsResponse | null;
};

type ProviderMatcher = {
  provider: string;
  keywords?: string[];
  asns?: string[];
  firstOctets?: string[];
};

type SignalContext = {
  asn: string;
  firstOctet: string | null;
  ip: string;
  rawProvider: string;
  sourceText: string;
  usageType: string;
};

const NOT_IDENTIFIED = "Not identified";

const PUBLIC_INFRASTRUCTURE_IPS: Record<
  string,
  { provider: string; reason: string }
> = {
  "1.0.0.1": {
    provider: "Cloudflare DNS",
    reason: "IP matches Cloudflare DNS public resolver infrastructure.",
  },
  "1.1.1.1": {
    provider: "Cloudflare DNS",
    reason: "IP matches Cloudflare DNS public resolver infrastructure.",
  },
  "8.8.4.4": {
    provider: "Google Public DNS",
    reason: "IP matches Google Public DNS infrastructure.",
  },
  "8.8.8.8": {
    provider: "Google Public DNS",
    reason: "IP matches Google Public DNS infrastructure.",
  },
  "9.9.9.9": {
    provider: "Quad9 DNS",
    reason: "IP matches Quad9 public resolver infrastructure.",
  },
  "149.112.112.112": {
    provider: "Quad9 DNS",
    reason: "IP matches Quad9 public resolver infrastructure.",
  },
  "208.67.220.220": {
    provider: "Cisco OpenDNS",
    reason: "IP matches Cisco OpenDNS public resolver infrastructure.",
  },
  "208.67.222.222": {
    provider: "Cisco OpenDNS",
    reason: "IP matches Cisco OpenDNS public resolver infrastructure.",
  },
};

const CLOUD_PROVIDER_MATCHERS: ProviderMatcher[] = [
  {
    provider: "Amazon AWS",
    keywords: [
      "amazon web services",
      "amazon data services",
      "amazon technologies",
      "amazon com",
      "aws",
    ],
    asns: ["AS16509", "AS14618"],
    firstOctets: ["3"],
  },
  {
    provider: "Microsoft Azure",
    keywords: ["microsoft azure", "azure"],
    asns: ["AS8075"],
    firstOctets: ["20"],
  },
  {
    provider: "Google Cloud",
    keywords: ["google cloud", "googleusercontent", "gcp"],
    firstOctets: ["34", "35"],
  },
  {
    provider: "Oracle Cloud",
    keywords: ["oracle cloud", "oraclecloud"],
    asns: ["AS31898"],
  },
  {
    provider: "DigitalOcean",
    keywords: ["digitalocean", "digital ocean"],
    asns: ["AS14061"],
  },
  {
    provider: "Linode",
    keywords: ["linode", "akamai cloud"],
    asns: ["AS63949"],
  },
  {
    provider: "Vultr",
    keywords: ["vultr", "choopa"],
    asns: ["AS20473"],
  },
  {
    provider: "Hetzner",
    keywords: ["hetzner"],
    asns: ["AS24940"],
  },
  {
    provider: "OVHcloud",
    keywords: ["ovhcloud", "ovh"],
    asns: ["AS16276"],
  },
  {
    provider: "Alibaba Cloud",
    keywords: ["alibaba cloud", "aliyun"],
    asns: ["AS45102"],
  },
  {
    provider: "Tencent Cloud",
    keywords: ["tencent cloud"],
  },
  {
    provider: "IBM Cloud",
    keywords: ["ibm cloud", "softlayer"],
    asns: ["AS36351"],
  },
];

const ENTERPRISE_MATCHERS: ProviderMatcher[] = [
  {
    provider: "Apple",
    keywords: ["apple"],
    asns: ["AS714"],
    firstOctets: ["17"],
  },
  {
    provider: "Meta",
    keywords: ["meta platforms", "facebook"],
    asns: ["AS32934"],
  },
  {
    provider: "Netflix",
    keywords: ["netflix"],
    asns: ["AS2906"],
  },
  {
    provider: "Microsoft",
    keywords: ["microsoft"],
  },
  {
    provider: "Adobe",
    keywords: ["adobe"],
  },
  {
    provider: "Salesforce",
    keywords: ["salesforce"],
  },
];

const PUBLIC_INFRASTRUCTURE_MATCHERS: ProviderMatcher[] = [
  {
    provider: "Google Public DNS",
    keywords: ["google public dns", "dns google"],
  },
  {
    provider: "Cloudflare DNS",
    keywords: ["cloudflare dns", "one one one one"],
  },
  {
    provider: "Quad9 DNS",
    keywords: ["quad9"],
  },
  {
    provider: "Cisco OpenDNS",
    keywords: ["opendns", "cisco umbrella"],
  },
  {
    provider: "Cloudflare",
    keywords: ["cloudflare"],
    asns: ["AS13335"],
  },
  {
    provider: "Cisco",
    keywords: ["public dns", "dns resolver", "root server"],
  },
];

const RESIDENTIAL_PROVIDER_MATCHERS: ProviderMatcher[] = [
  {
    provider: "Comcast",
    keywords: ["comcast", "xfinity"],
  },
  {
    provider: "Spectrum",
    keywords: ["charter communications", "spectrum"],
  },
  {
    provider: "Cox",
    keywords: ["cox communications"],
  },
  {
    provider: "Verizon Fios",
    keywords: ["verizon fios"],
  },
  {
    provider: "Frontier",
    keywords: ["frontier communications"],
  },
  {
    provider: "CenturyLink",
    keywords: ["centurylink", "lumen"],
  },
  {
    provider: "BT",
    keywords: ["bt broadband", "british telecommunications"],
  },
  {
    provider: "Deutsche Telekom",
    keywords: ["deutsche telekom"],
  },
  {
    provider: "ISP",
    keywords: ["broadband", "cable internet", "fiber internet", "dsl"],
  },
];

const MOBILE_PROVIDER_MATCHERS: ProviderMatcher[] = [
  {
    provider: "T-Mobile",
    keywords: ["t mobile", "tmobile"],
  },
  {
    provider: "Verizon Wireless",
    keywords: ["verizon wireless"],
  },
  {
    provider: "AT&T Mobility",
    keywords: ["at t mobility", "att mobility"],
  },
  {
    provider: "US Cellular",
    keywords: ["us cellular"],
  },
  {
    provider: "Sprint",
    keywords: ["sprint"],
  },
  {
    provider: "Mobile Carrier",
    keywords: ["mobile", "cellular", "wireless"],
  },
];

function normalizeText(value?: string | null) {
  return (
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function normalizeAsn(value?: string | null) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.startsWith("AS") ? normalized : `AS${normalized}`;
}

function parseOrg(org?: string | null) {
  if (!org) {
    return {};
  }

  const [asn, ...nameParts] = org.trim().split(/\s+/);

  return {
    asn,
    name: nameParts.join(" "),
  };
}

function formatProvider(value?: string | null) {
  const trimmedValue = value?.trim();
  const normalizedValue = trimmedValue?.toLowerCase();

  if (
    !trimmedValue ||
    normalizedValue === "unknown" ||
    normalizedValue === "not identified"
  ) {
    return NOT_IDENTIFIED;
  }

  return trimmedValue;
}

function pickProvider(...values: (string | null | undefined)[]) {
  return (
    values.find((value) => formatProvider(value) !== NOT_IDENTIFIED) ??
    NOT_IDENTIFIED
  );
}

function getFirstOctet(ip?: string | null) {
  const firstOctet = ip?.trim().split(".")[0];

  if (!firstOctet || !/^\d+$/.test(firstOctet)) {
    return null;
  }

  return firstOctet;
}

function hasCloudflareTraceMatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = cloudflare?.ip?.trim().toLowerCase();
  const ipInfoIp = ipInfo.ip?.trim().toLowerCase();

  return Boolean(traceIp && ipInfoIp && traceIp === ipInfoIp);
}

function hasCloudflareColoSignal(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return Boolean(
    cloudflare?.colo?.trim() && hasCloudflareTraceMatch(ipInfo, cloudflare),
  );
}

function isCloudflareWarpOn(cloudflare?: CloudflareTraceResponse | null) {
  return cloudflare?.warp?.trim().toLowerCase() === "on";
}

function isInfrastructureUsage(usageType?: string | null) {
  const normalized = normalizeText(usageType);

  return (
    normalized.includes("data center") ||
    normalized.includes("datacenter") ||
    normalized.includes("web hosting") ||
    normalized.includes("transit") ||
    normalized.includes("hosting") ||
    normalized.includes("infrastructure") ||
    normalized.includes("cloud")
  );
}

function getSignalContext({
  ipInfo,
  abuseIpDb,
  ipApiIs,
}: NetworkIdentityInput): SignalContext {
  const parsedOrg = parseOrg(ipInfo.org);
  const sourceValues = [
    ipInfo.asn?.type,
    ipInfo.company?.type,
    ipInfo.asn?.name,
    ipInfo.company?.name,
    ipInfo.org,
    parsedOrg.name,
    abuseIpDb?.isp,
    abuseIpDb?.domain,
    ipApiIs?.organization,
    ipApiIs?.asnName,
    ipApiIs?.isp,
    ipInfo.hostname,
    ipInfo.privacy?.service,
  ];
  const usageType = normalizeText(abuseIpDb?.usageType);

  return {
    asn: normalizeAsn(ipInfo.asn?.asn ?? parsedOrg.asn),
    firstOctet: getFirstOctet(ipInfo.ip),
    ip: ipInfo.ip?.trim() ?? "",
    rawProvider: formatProvider(
      pickProvider(
        ipInfo.company?.name,
        abuseIpDb?.isp,
        ipApiIs?.organization,
        ipApiIs?.asnName,
        ipApiIs?.isp,
        ipInfo.asn?.name,
        parsedOrg.name,
        ipInfo.org,
        abuseIpDb?.domain,
      ),
    ),
    sourceText: [...sourceValues.map(normalizeText), usageType]
      .filter(Boolean)
      .join(" "),
    usageType,
  };
}

function findProviderMatch(
  signals: SignalContext,
  matchers: ProviderMatcher[],
) {
  return matchers.find((matcher) => {
    const matchesAsn = matcher.asns?.includes(signals.asn) ?? false;
    const matchesFirstOctet =
      matcher.firstOctets?.includes(signals.firstOctet ?? "") ?? false;
    const matchesKeyword =
      matcher.keywords?.some((keyword) =>
        signals.sourceText.includes(normalizeText(keyword)),
      ) ?? false;

    return matchesAsn || matchesFirstOctet || matchesKeyword;
  });
}

function getPublicInfrastructureIpMatch(signals: SignalContext) {
  return PUBLIC_INFRASTRUCTURE_IPS[signals.ip] ?? null;
}

function hasGenericIspSignal(signals: SignalContext) {
  return (
    signals.sourceText.includes("isp") ||
    signals.sourceText.includes("internet service provider") ||
    signals.sourceText.includes("telecom") ||
    signals.sourceText.includes("communications")
  );
}

function hasMobileSignal(signals: SignalContext) {
  return (
    signals.usageType.includes("mobile") ||
    signals.sourceText.includes("mobile") ||
    signals.sourceText.includes("cellular") ||
    signals.sourceText.includes("wireless")
  );
}

function hasDatacenterSignal(
  input: NetworkIdentityInput,
  signals: SignalContext,
) {
  const { ipInfo, abuseIpDb, cloudflare, ipApiIs } = input;
  const asnType = normalizeText(ipInfo.asn?.type);
  const companyType = normalizeText(ipInfo.company?.type);

  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    hasCloudflareColoSignal(ipInfo, cloudflare) ||
    ipApiIs?.datacenter === true ||
    ipApiIs?.hosting === true ||
    asnType.includes("hosting") ||
    asnType.includes("business") ||
    companyType.includes("hosting") ||
    signals.sourceText.includes("datacenter") ||
    signals.sourceText.includes("data center") ||
    signals.sourceText.includes("colocation") ||
    signals.sourceText.includes("hosting provider")
  );
}

function getTone(category: NetworkIdentityCategory): StatusTone {
  if (category === "Residential ISP" || category === "Mobile Network") {
    return "good";
  }

  if (
    category === "Enterprise Network" ||
    category === "Public Infrastructure"
  ) {
    return "good";
  }

  if (category === "Tor Exit") {
    return "risk";
  }

  if (category === "VPN / Proxy") {
    return "caution";
  }

  if (category === "Cloud Provider" || category === "Datacenter") {
    return "infrastructure";
  }

  return "neutral";
}

function getDetail(category: NetworkIdentityCategory) {
  switch (category) {
    case "Residential ISP":
      return "Residential ISP detected. This IP appears to belong to a consumer broadband provider and is generally a normal access network when reputation is clean.";
    case "Mobile Network":
      return "Mobile network detected. This IP appears to belong to a cellular carrier.";
    case "Enterprise Network":
      return "Enterprise network detected. This IP belongs to an organization-operated network. These networks are often clean, though some platforms may apply extra checks to shared corporate traffic.";
    case "Public Infrastructure":
      return "Public infrastructure detected. This is normal for public DNS, CDN, and edge services, but it is not ideal as a personal browsing or account registration IP.";
    case "Cloud Provider":
      return "Cloud infrastructure detected. Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.";
    case "Datacenter":
      return "Datacenter infrastructure detected. Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.";
    case "VPN / Proxy":
      return "VPN or proxy network detected. Traffic may be relayed through an anonymization or privacy service.";
    case "Tor Exit":
      return "Tor exit network detected. This is a high-risk anonymity network and is not recommended for account registration, verification, banking, payments, or sensitive login.";
    case "Unknown":
      return "Network identity could not be confidently determined.";
  }
}

function buildIdentity({
  category,
  provider = NOT_IDENTIFIED,
  identityConfidence,
  reason,
}: {
  category: NetworkIdentityCategory;
  provider?: string;
  identityConfidence: NetworkIdentityConfidence;
  reason: string;
}): EndUserReport["identity"] {
  const formattedProvider = formatProvider(provider);

  return {
    networkIdentity: category,
    ipType: category,
    provider: formattedProvider,
    identityConfidence,
    reason,
    detail: getDetail(category),
    tone: getTone(category),
  };
}

function getTorIdentity(
  input: NetworkIdentityInput,
): EndUserReport["identity"] | null {
  const provider = pickProvider(
    input.ipInfo.privacy?.service,
    input.ipApiIs?.organization,
    "Tor Exit",
  );

  if (input.ipInfo.privacy?.tor === true) {
    return buildIdentity({
      category: "Tor Exit",
      provider,
      identityConfidence: "High",
      reason: "IPInfo privacy data marks this IP as Tor exit traffic.",
    });
  }

  if (input.ipqs?.tor === true) {
    return buildIdentity({
      category: "Tor Exit",
      provider,
      identityConfidence: "High",
      reason: "IPQS marks this IP as Tor exit traffic.",
    });
  }

  if (input.ipApiIs?.tor === true) {
    return buildIdentity({
      category: "Tor Exit",
      provider,
      identityConfidence: "Medium",
      reason: "ipapi.is marks this IP as Tor exit traffic.",
    });
  }

  return null;
}

function getVpnProxyIdentity(
  input: NetworkIdentityInput,
): EndUserReport["identity"] | null {
  const provider = pickProvider(
    input.ipInfo.privacy?.service,
    input.ipApiIs?.organization,
    "VPN / Proxy",
  );

  if (
    input.ipInfo.privacy?.vpn === true ||
    input.ipInfo.privacy?.proxy === true ||
    input.ipInfo.privacy?.relay === true
  ) {
    return buildIdentity({
      category: "VPN / Proxy",
      provider,
      identityConfidence: "High",
      reason:
        "IPInfo privacy data marks this IP as VPN, proxy, or relay traffic.",
    });
  }

  if (
    input.ipqs?.vpn === true ||
    input.ipqs?.activeVpn === true ||
    input.ipqs?.proxy === true
  ) {
    return buildIdentity({
      category: "VPN / Proxy",
      provider,
      identityConfidence: "High",
      reason: "IPQS marks this IP as VPN or proxy traffic.",
    });
  }

  if (input.ipApiIs?.vpn === true || input.ipApiIs?.proxy === true) {
    return buildIdentity({
      category: "VPN / Proxy",
      provider,
      identityConfidence: "Medium",
      reason: "ipapi.is marks this IP as VPN or proxy traffic.",
    });
  }

  if (isCloudflareWarpOn(input.cloudflare)) {
    return buildIdentity({
      category: "VPN / Proxy",
      provider: "Cloudflare WARP",
      identityConfidence: "Medium",
      reason: "Cloudflare reports WARP is active for this network path.",
    });
  }

  return null;
}

function getResidentialIdentity(
  signals: SignalContext,
): EndUserReport["identity"] | null {
  const providerMatch = findProviderMatch(
    signals,
    RESIDENTIAL_PROVIDER_MATCHERS,
  );

  if (providerMatch) {
    const provider =
      providerMatch.provider === "ISP" && signals.rawProvider !== NOT_IDENTIFIED
        ? signals.rawProvider
        : providerMatch.provider === "ISP"
          ? "Residential ISP"
          : providerMatch.provider;

    return buildIdentity({
      category: "Residential ISP",
      provider,
      identityConfidence: "High",
      reason:
        provider === "Residential ISP"
          ? "Provider data includes residential broadband ownership signals."
          : `Provider data identifies ${provider} as a residential ISP.`,
    });
  }

  if (signals.usageType.includes("residential")) {
    return buildIdentity({
      category: "Residential ISP",
      provider: signals.rawProvider,
      identityConfidence:
        signals.rawProvider === NOT_IDENTIFIED ? "Medium" : "High",
      reason: "Provider usage data identifies this IP as residential.",
    });
  }

  if (hasGenericIspSignal(signals) && !hasMobileSignal(signals)) {
    return buildIdentity({
      category: "Residential ISP",
      provider: signals.rawProvider,
      identityConfidence: "Medium",
      reason: "ISP ownership signals suggest a residential broadband network.",
    });
  }

  return null;
}

function getMobileIdentity(
  signals: SignalContext,
): EndUserReport["identity"] | null {
  const providerMatch = findProviderMatch(signals, MOBILE_PROVIDER_MATCHERS);

  if (providerMatch || signals.usageType.includes("mobile")) {
    return buildIdentity({
      category: "Mobile Network",
      provider: providerMatch?.provider ?? signals.rawProvider,
      identityConfidence: providerMatch ? "High" : "Medium",
      reason: providerMatch
        ? `Provider data identifies ${providerMatch.provider} as a mobile network.`
        : "Provider usage data identifies this IP as mobile.",
    });
  }

  return null;
}

function getCloudProviderIdentity(
  signals: SignalContext,
): EndUserReport["identity"] | null {
  const providerMatch = findProviderMatch(signals, CLOUD_PROVIDER_MATCHERS);

  if (!providerMatch) {
    return null;
  }

  return buildIdentity({
    category: "Cloud Provider",
    provider: providerMatch.provider,
    identityConfidence: "High",
    reason: `ASN belongs to ${providerMatch.provider} infrastructure.`,
  });
}

function getEnterpriseIdentity(
  signals: SignalContext,
): EndUserReport["identity"] | null {
  const providerMatch = findProviderMatch(signals, ENTERPRISE_MATCHERS);

  if (!providerMatch) {
    return null;
  }

  return buildIdentity({
    category: "Enterprise Network",
    provider: providerMatch.provider,
    identityConfidence: "High",
    reason: `ASN belongs to ${providerMatch.provider} infrastructure.`,
  });
}

function getPublicInfrastructureIdentity(
  signals: SignalContext,
): EndUserReport["identity"] | null {
  const ipMatch = getPublicInfrastructureIpMatch(signals);
  const providerMatch = findProviderMatch(
    signals,
    PUBLIC_INFRASTRUCTURE_MATCHERS,
  );

  if (ipMatch) {
    return buildIdentity({
      category: "Public Infrastructure",
      provider: ipMatch.provider,
      identityConfidence: "High",
      reason: ipMatch.reason,
    });
  }

  if (providerMatch) {
    return buildIdentity({
      category: "Public Infrastructure",
      provider: providerMatch.provider,
      identityConfidence: "High",
      reason: `ASN belongs to ${providerMatch.provider} public internet infrastructure.`,
    });
  }

  return null;
}

function getDatacenterIdentity(
  input: NetworkIdentityInput,
  signals: SignalContext,
): EndUserReport["identity"] | null {
  if (!hasDatacenterSignal(input, signals)) {
    return null;
  }

  return buildIdentity({
    category: "Datacenter",
    provider: signals.rawProvider,
    identityConfidence: "Low",
    reason:
      "Hosting or infrastructure signals were present, but a specific provider family was not identified.",
  });
}

export function classifyNetworkIdentity(
  input: NetworkIdentityInput,
): EndUserReport["identity"] {
  const signals = getSignalContext(input);

  return (
    getTorIdentity(input) ??
    getVpnProxyIdentity(input) ??
    getResidentialIdentity(signals) ??
    getMobileIdentity(signals) ??
    getCloudProviderIdentity(signals) ??
    getEnterpriseIdentity(signals) ??
    getPublicInfrastructureIdentity(signals) ??
    getDatacenterIdentity(input, signals) ??
    buildIdentity({
      category: "Unknown",
      identityConfidence: "Low",
      reason: "Network identity could not be confidently determined.",
    })
  );
}
