import type { ProviderResult as AbuseIpDbResponse } from "./providers/abuseipdb";
import type { ProviderResult as CloudflareTraceResponse } from "./providers/cloudflare";
import type { ProviderResult as IpInfoResponse } from "./providers/ipinfo";
import type { ProviderResult as IpqsResponse } from "./providers/ipqs";
import { calculateTrustScore } from "@/lib/analysis/scoring/trust-score";

export type { ProviderResult as AbuseIpDbResponse } from "./providers/abuseipdb";
export type { ProviderResult as CloudflareTraceResponse } from "./providers/cloudflare";
export type { ProviderResult as IpInfoResponse } from "./providers/ipinfo";
export type { ProviderResult as IpqsResponse } from "./providers/ipqs";
export { calculateTrustScore } from "@/lib/analysis/scoring/trust-score";

export type ServiceCompatibilityStatus =
  "Good" | "Use with Caution" | "High Risk";

export type ServiceCompatibilityCategory = {
  category: string;
  services: {
    name: string;
    status: ServiceCompatibilityStatus;
  }[];
};

export type RecommendationLabel =
  "Recommended" | "Use with Caution" | "Not Recommended";

export type RecommendationConfidence = "High" | "Medium" | "Low";

export type Recommendation = {
  label: RecommendationLabel;
  summary: string;
};

export type ServiceCompatibilityReasonSignals = {
  score: number;
  abuseConfidence: number | null;
  usageType?: string | null;
  hosting: boolean;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  relay: boolean;
  recommendationStatus: RecommendationLabel;
};

type ServiceCompatibilityProfile =
  | "general"
  | "streaming"
  | "social"
  | "ai"
  | "developer"
  | "cloud"
  | "google"
  | "googleVoice"
  | "apple"
  | "communication"
  | "gaming"
  | "finance"
  | "crypto";

type ServiceCompatibilityGroup = {
  category: string;
  services: {
    name: string;
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

function normalizeIpAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function isCloudflareWarpOn(
  cloudflare?: CloudflareTraceResponse | null,
) {
  return cloudflare?.warp?.trim().toLowerCase() === "on";
}

export function hasCloudflareTraceMatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = normalizeIpAddress(cloudflare?.ip);
  const ipInfoIp = normalizeIpAddress(ipInfo.ip);

  return Boolean(traceIp && ipInfoIp && traceIp === ipInfoIp);
}

export function hasCloudflareTraceMismatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = normalizeIpAddress(cloudflare?.ip);
  const ipInfoIp = normalizeIpAddress(ipInfo.ip);

  return Boolean(traceIp && ipInfoIp && traceIp !== ipInfoIp);
}

export function hasCloudflareColoSignal(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return Boolean(
    cloudflare?.colo?.trim() && hasCloudflareTraceMatch(ipInfo, cloudflare),
  );
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

function getTrustScoreSummary(
  score: number,
  signals: ReturnType<typeof getCompatibilitySignals>,
) {
  const hasMajorSignal =
    signals.hosting ||
    signals.vpn ||
    signals.proxy ||
    signals.tor ||
    signals.relay ||
    signals.traceMismatch ||
    (signals.abuseConfidence !== null && signals.abuseConfidence >= 50);

  if (
    signals.tor ||
    (signals.abuseConfidence !== null && signals.abuseConfidence >= 85)
  ) {
    return "This IP has severe abuse or privacy risk signals and should not be used for sensitive services.";
  }

  if (score >= 90 && !hasMajorSignal) {
    return `This IP has an IP quality score of ${score}/100, with no major reputation or abuse signals detected.`;
  }

  if (score >= 70 && signals.hosting) {
    return `This IP has generally good reputation, but infrastructure signals still require caution.`;
  }

  if (score >= 70) {
    return `This IP has generally good reputation based on the available provider data.`;
  }

  if (score >= 40) {
    return `This IP has moderate review signals. Use caution with sensitive services.`;
  }

  return `This IP has elevated review signals in the available provider data.`;
}

function getCompatibilitySignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const privacy = ipInfo.privacy;
  const hasCloudflareInfrastructure = hasCloudflareColoSignal(
    ipInfo,
    cloudflare,
  );

  return {
    score: calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    hosting:
      privacy?.hosting === true ||
      isInfrastructureUsage(abuseIpDb?.usageType) ||
      hasCloudflareInfrastructure,
    vpn:
      privacy?.vpn === true ||
      ipqs?.vpn === true ||
      ipqs?.activeVpn === true ||
      isCloudflareWarpOn(cloudflare),
    proxy: privacy?.proxy === true || ipqs?.proxy === true,
    tor: privacy?.tor === true || ipqs?.tor === true,
    relay: privacy?.relay === true,
    traceMismatch: hasCloudflareTraceMismatch(ipInfo, cloudflare),
  };
}

export function buildServiceCompatibilitySignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
): ServiceCompatibilityReasonSignals {
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs, cloudflare);

  return {
    ...signals,
    usageType: abuseIpDb?.usageType ?? null,
    recommendationStatus: getBaseRecommendationLabel(signals.score),
  };
}

function hasUsageType(usageType?: string | null) {
  return Boolean(usageType?.trim());
}

function isResidentialOrMobileUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase() ?? "";

  return normalized.includes("residential") || normalized.includes("mobile");
}

function hasConflictingSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const privacy = ipInfo.privacy;
  const usageType = abuseIpDb?.usageType;
  const hasInfrastructureUsage = isInfrastructureUsage(usageType);
  const hasResidentialOrMobileUsage = isResidentialOrMobileUsage(usageType);

  return (
    (privacy?.hosting === true && hasResidentialOrMobileUsage) ||
    (privacy?.hosting === false && hasInfrastructureUsage) ||
    (privacy?.vpn === false &&
      (ipqs?.vpn === true || ipqs?.activeVpn === true)) ||
    (privacy?.vpn === true &&
      (ipqs?.vpn === false || ipqs?.activeVpn === false)) ||
    (privacy?.proxy === false && ipqs?.proxy === true) ||
    (privacy?.proxy === true && ipqs?.proxy === false) ||
    (privacy?.tor === false && ipqs?.tor === true) ||
    (privacy?.tor === true && ipqs?.tor === false) ||
    hasCloudflareTraceMismatch(ipInfo, cloudflare)
  );
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
  const hasLowAbuseConfidence =
    abuseConfidence !== null && abuseConfidence < 25;
  const hasElevatedAbuse = abuseConfidence !== null && abuseConfidence >= 50;
  const hasSevereAbuse = abuseConfidence !== null && abuseConfidence >= 85;
  const hasNoVpnProxyTor = !signals.vpn && !signals.proxy && !signals.tor;
  const hasCleanCore = hasLowAbuseConfidence && hasNoVpnProxyTor;
  const hasCleanSignals = hasCleanCore && !signals.hosting && !signals.relay;

  if (signals.tor || hasSevereAbuse) {
    return "High Risk";
  }

  if (signals.score < 40) {
    return "High Risk";
  }

  if (signals.score < 65) {
    return profile === "finance" ||
      profile === "crypto" ||
      profile === "googleVoice"
      ? "High Risk"
      : "Use with Caution";
  }

  if (signals.score < 80) {
    if (profile === "general" && hasLowAbuseConfidence && hasNoVpnProxyTor) {
      return "Good";
    }

    return "Use with Caution";
  }

  if (profile === "finance" || profile === "crypto") {
    return "Use with Caution";
  }

  if (profile === "googleVoice") {
    return signals.hosting || hasElevatedAbuse
      ? "High Risk"
      : "Use with Caution";
  }

  if (profile === "google") {
    return signals.score >= 90 && hasCleanSignals ? "Good" : "Use with Caution";
  }

  if (profile === "general" || profile === "developer") {
    return hasCleanCore ? "Good" : "Use with Caution";
  }

  if (profile === "streaming" || profile === "ai" || profile === "social") {
    return signals.hosting || !hasCleanCore ? "Use with Caution" : "Good";
  }

  if (profile === "cloud") {
    return hasCleanSignals ? "Good" : "Use with Caution";
  }

  if (
    profile === "communication" ||
    profile === "gaming" ||
    profile === "apple"
  ) {
    return signals.hosting || !hasCleanCore ? "Use with Caution" : "Good";
  }

  return "Use with Caution";
}

function normalizeServiceName(serviceName: string) {
  return serviceName.trim().toLowerCase();
}

function getServiceExplanationProfile(
  serviceName: string,
  category: string,
): ServiceCompatibilityProfile {
  const service = normalizeServiceName(serviceName);

  if (["youtube", "reddit", "wikipedia"].includes(service)) {
    return "general";
  }

  if (["facebook", "instagram", "x", "tiktok"].includes(service)) {
    return "social";
  }

  if (["chatgpt", "claude", "gemini", "perplexity", "grok"].includes(service)) {
    return "ai";
  }

  if (["netflix", "disney+", "prime video", "max"].includes(service)) {
    return "streaming";
  }

  if (["github", "gitlab", "cloudflare", "vercel"].includes(service)) {
    return "developer";
  }

  if (["aws", "azure", "google cloud"].includes(service)) {
    return "cloud";
  }

  if (service === "google voice") {
    return "googleVoice";
  }

  if (["google account", "gmail", "google play"].includes(service)) {
    return "google";
  }

  if (["paypal", "wise", "stripe", "revolut"].includes(service)) {
    return "finance";
  }

  if (["binance", "coinbase", "kraken", "bybit", "okx"].includes(service)) {
    return "crypto";
  }

  if (["discord", "telegram"].includes(service)) {
    return "communication";
  }

  if (
    ["steam", "epic games", "playstation network", "xbox live"].includes(
      service,
    )
  ) {
    return "gaming";
  }

  if (category === "APPLE") {
    return "apple";
  }

  return "social";
}

export function buildServiceCompatibilityReason(
  serviceName: string,
  category: string,
  status: ServiceCompatibilityStatus,
  signals: ServiceCompatibilityReasonSignals,
) {
  const profile = getServiceExplanationProfile(serviceName, category);
  const hasHostingOrPrivacySignal =
    signals.hosting ||
    signals.vpn ||
    signals.proxy ||
    signals.tor ||
    signals.relay;

  if (status === "Good" && profile === "general" && hasHostingOrPrivacySignal) {
    return "General browsing is usually less sensitive to IP reputation. Clean abuse history keeps this in a usable range.";
  }

  if (status === "Good" && profile === "developer" && !signals.hosting) {
    return "Developer platforms usually work well when reputation is clean. No major abuse signal is detected.";
  }

  const reasons: Record<
    ServiceCompatibilityProfile,
    Record<ServiceCompatibilityStatus, string>
  > = {
    general: {
      Good: "General browsing is usually less sensitive to IP reputation. No major abuse signal is detected.",
      "Use with Caution":
        "General browsing should work, but stricter platforms may still review reputation or infrastructure signals.",
      "High Risk":
        "General web access may still load, but this IP has stronger reputation risk than normal.",
    },
    streaming: {
      Good: "Streaming access is usually fine when reputation is clean and location signals are stable.",
      "Use with Caution":
        "Streaming platforms may use IP type and location signals for region access, so hosting networks can affect availability.",
      "High Risk":
        "Streaming platforms may block access when abuse, VPN, proxy, or Tor signals are strong.",
    },
    social: {
      Good: "Social logins are usually fine when reputation is clean and the location looks consistent.",
      "Use with Caution":
        "Social platforms are sensitive to unusual login and signup patterns. Hosting networks may trigger verification.",
      "High Risk":
        "Social platforms may block signup or require verification when reputation risk is high.",
    },
    ai: {
      Good: "AI services usually accept clean IPs with stable reputation. Keep login patterns consistent.",
      "Use with Caution":
        "AI services may apply extra checks to hosting networks, especially during login, signup, or frequent IP changes.",
      "High Risk":
        "AI services may restrict signups or usage when abuse, VPN, proxy, or Tor signals are present.",
    },
    developer: {
      Good: "Developer platforms usually tolerate infrastructure IPs. No major abuse signal is detected.",
      "Use with Caution":
        "Developer platforms usually tolerate infrastructure IPs, but abuse history can still trigger verification or rate limits.",
      "High Risk":
        "Developer platforms may add verification or rate limits when abuse history is strong.",
    },
    cloud: {
      Good: "Cloud provider dashboards are more likely to work when reputation is clean and signals are stable.",
      "Use with Caution":
        "Cloud providers use stricter fraud and abuse checks. Clean reputation helps, but infrastructure signals may still matter.",
      "High Risk":
        "Cloud providers may restrict access or signup when abuse or privacy signals are strong.",
    },
    google: {
      Good: "Google account services are usually fine when reputation is clean and no hosting or privacy signal is detected.",
      "Use with Caution":
        "Google account services may ask for verification when hosting, location, or reputation signals look unusual.",
      "High Risk":
        "Google account services may block sign-in or signup when risk signals are strong.",
    },
    googleVoice: {
      Good: "Google Voice remains stricter than normal Google services because phone verification abuse is common.",
      "Use with Caution":
        "Google Voice is stricter than normal Google services because registration and phone verification abuse are common.",
      "High Risk":
        "Google Voice has high abuse sensitivity. Hosting, VPN, proxy, or abuse signals can make registration unreliable.",
    },
    apple: {
      Good: "Apple account services usually work when reputation is clean and login context is consistent.",
      "Use with Caution":
        "Apple services may add account checks when hosting or reputation signals look unusual.",
      "High Risk":
        "Apple services may restrict sensitive account actions when abuse or privacy signals are strong.",
    },
    communication: {
      Good: "Messaging platforms usually work when abuse and automation signals are clean.",
      "Use with Caution":
        "Messaging platforms may flag IPs linked to spam or automation, especially for new accounts.",
      "High Risk":
        "Messaging platforms may restrict new accounts when spam or automation risk is high.",
    },
    gaming: {
      Good: "Gaming platforms are usually usable when reputation is clean and location looks consistent.",
      "Use with Caution":
        "Gaming platforms are usually usable, but unusual location or infrastructure signals may trigger login checks.",
      "High Risk":
        "Gaming platforms may require verification or limit marketplace activity when risk signals are strong.",
    },
    finance: {
      Good: "Financial services still review device and account context even when IP reputation looks clean.",
      "Use with Caution":
        "Financial services use strict fraud controls. IP reputation is only one factor, but hosting networks may increase review risk.",
      "High Risk":
        "Financial services may block or heavily review activity when reputation risk is high.",
    },
    crypto: {
      Good: "Crypto exchanges still review device and account context even when IP reputation looks clean.",
      "Use with Caution":
        "Crypto exchanges apply strict risk controls. Hosting or previously abused IPs may increase security checks.",
      "High Risk":
        "Crypto exchanges may block or heavily review activity when reputation risk is high.",
    },
  };

  return reasons[profile][status];
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

export function buildReasons(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const { hasAsn, hasIspOrOrg } = getIpInfoSignals(ipInfo);
  const privacy = ipInfo.privacy;
  const hasHostingOrInfrastructure =
    privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    hasCloudflareColoSignal(ipInfo, cloudflare);

  return [
    privacy?.vpn === true || isCloudflareWarpOn(cloudflare)
      ? "VPN or WARP detected"
      : "No obvious VPN or WARP detected",
    privacy?.proxy === true ? "Proxy detected" : "No obvious proxy detected",
    privacy?.tor === true ? "Tor detected" : "No obvious Tor detected",
    privacy?.relay === true ? "Relay detected" : "No obvious relay detected",
    hasHostingOrInfrastructure
      ? "Hosting or infrastructure usage detected"
      : "No hosting network detected",
    hasAsn ? "ASN available" : "ASN missing",
    hasIspOrOrg ? "ISP/org available" : "ISP/org missing",
    hasCloudflareTraceMismatch(ipInfo, cloudflare)
      ? "Network integrity check does not match IPinfo"
      : null,
    ...getAbuseIpDbReasons(abuseIpDb),
    ...getIpqsReasons(ipqs),
  ].filter((reason): reason is string => Boolean(reason));
}

export function buildRiskSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs, cloudflare);

  return [
    getTrustScoreSummary(score, signals),
    getAbuseIpDbSummary(abuseIpDb),
    getUsageSummary(abuseIpDb),
    getPrivacySignalSummary(ipInfo, abuseIpDb, ipqs),
  ].join(" ");
}

export function buildRecommendationConfidence(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
): RecommendationConfidence {
  const { hasAsn, hasIspOrOrg } = getIpInfoSignals(ipInfo);
  const hasAbuseIpDb = Boolean(abuseIpDb);
  const hasAbuseConfidence = (abuseIpDb?.abuseConfidence ?? null) !== null;
  const hasUsage = hasUsageType(abuseIpDb?.usageType);
  const hasPrivacy = Boolean(ipInfo.privacy);
  const hasConflicts = hasConflictingSignals(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );
  const coverageScore = [
    hasAbuseIpDb ? 1 : -1,
    hasAbuseConfidence ? 1 : -1,
    hasUsage ? 1 : -1,
    hasAsn ? 1 : -1,
    hasIspOrOrg ? 1 : -1,
    hasPrivacy ? 1 : -1,
    hasConflicts ? -2 : 0,
  ].reduce((total, value) => total + value, 0);

  if (
    coverageScore >= 4 &&
    hasAbuseIpDb &&
    hasAbuseConfidence &&
    hasUsage &&
    hasAsn &&
    hasIspOrOrg &&
    !hasConflicts
  ) {
    return "High";
  }

  if (coverageScore <= 0) {
    return "Low";
  }

  return "Medium";
}

export function buildServiceCompatibility(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
): ServiceCompatibilityCategory[] {
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs, cloudflare);
  const groups: ServiceCompatibilityGroup[] = [
    {
      category: "GENERAL WEB",
      services: [
        { name: "YouTube" },
        { name: "Reddit" },
        { name: "Wikipedia" },
        { name: "Facebook" },
        { name: "Instagram" },
        { name: "X" },
        { name: "TikTok" },
      ],
    },
    {
      category: "AI SERVICES",
      services: [
        { name: "ChatGPT" },
        { name: "Claude" },
        { name: "Gemini" },
        { name: "Perplexity" },
        { name: "Grok" },
      ],
    },
    {
      category: "STREAMING",
      services: [
        { name: "Netflix" },
        { name: "Disney+" },
        { name: "Prime Video" },
        { name: "Max" },
      ],
    },
    {
      category: "DEVELOPER",
      services: [
        { name: "GitHub" },
        { name: "GitLab" },
        { name: "Cloudflare" },
        { name: "Vercel" },
      ],
    },
    {
      category: "CLOUD",
      services: [{ name: "AWS" }, { name: "Azure" }, { name: "Google Cloud" }],
    },
    {
      category: "GOOGLE",
      services: [
        { name: "Google Voice" },
        { name: "Google Account" },
        { name: "Gmail" },
        { name: "Google Play" },
      ],
    },
    {
      category: "APPLE",
      services: [{ name: "Apple ID" }, { name: "iCloud" }],
    },
    {
      category: "COMMUNICATION",
      services: [{ name: "Discord" }, { name: "Telegram" }],
    },
    {
      category: "GAMING",
      services: [
        { name: "Steam" },
        { name: "Epic Games" },
        { name: "PlayStation Network" },
        { name: "Xbox Live" },
      ],
    },
    {
      category: "FINANCE",
      services: [
        { name: "PayPal" },
        { name: "Wise" },
        { name: "Stripe" },
        { name: "Revolut" },
      ],
    },
    {
      category: "CRYPTO",
      services: [
        { name: "Binance" },
        { name: "Coinbase" },
        { name: "Kraken" },
        { name: "Bybit" },
        { name: "OKX" },
      ],
    },
  ];

  return groups.map((group) => ({
    category: group.category,
    services: group.services.map((service) => {
      const profile = getServiceExplanationProfile(
        service.name,
        group.category,
      );

      return {
        name: service.name,
        status: getServiceCompatibilityStatus(profile, signals),
      };
    }),
  }));
}

export function buildRecommendation(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
): Recommendation {
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const signals = getCompatibilitySignals(ipInfo, abuseIpDb, ipqs, cloudflare);
  const serviceCompatibility = buildServiceCompatibility(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );
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
    signals.hosting ||
    signals.traceMismatch;

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
    if (signals.hosting && abuseConfidence !== null && abuseConfidence < 25) {
      return {
        label,
        summary:
          "This IP has clean abuse history, but hosting or infrastructure usage may still trigger checks on sensitive services.",
      };
    }

    return {
      label,
      summary:
        "Privacy or infrastructure signals affect this IP, so use caution with accounts, payments, and crypto services.",
    };
  }

  if (
    label === "Use with Caution" &&
    (hasHighRiskService || hasCautionService)
  ) {
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
