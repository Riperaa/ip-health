import {
  buildRecommendationConfidence,
  buildServiceCompatibilitySignals,
  hasCloudflareColoSignal,
  hasCloudflareTraceMatch,
  hasCloudflareTraceMismatch,
  isCloudflareWarpOn,
  isInfrastructureUsage,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  getServiceCompatibilityTone,
  type StatusTone,
} from "@/lib/status-colors";

import {
  createFinalDecisionV1,
  normalizeFinalDecision,
} from "../final-decision";
import {
  formatDetail,
  hasDetail,
  isObjectRecord,
  parseOrg,
  pickDetail,
} from "../normalize/common";
import { normalizeProviderAnalysisResult } from "../normalize/providers";
import {
  detectRegionFromIpInfo,
  getRegionRiskLevel,
  inferRegionServiceCompatibility,
  type HistoricalAccessConsistency,
  type RegionServiceInferenceInput,
  type WeightedDecisionSignal,
} from "../region/service-map";
import {
  getHistoryForIp,
  getNextIpHistory,
  loadIpHistory,
  normalizeIpHistory,
  persistIpHistory,
} from "../normalize/storage";
import { calculateTrustScore } from "../scoring/trust-score";
import type {
  AbuseIpDbResponse,
  AnalysisResult,
  CloudflareTraceResponse,
  FinalDecision,
  FinalDecisionRiskLevel,
  FinalDecisionSignal,
  IpHistoryRecord,
  IpInfoResponse,
  IpqsResponse,
  IpTypeBadge,
  NetworkIntegrity,
  ProviderAnalysisResult,
  ResultFact,
  RiskLevel,
  RiskSignal,
  ServiceCompatibilityStatus,
} from "../types";
import { fetchProviderAnalysis } from "./provider-analysis";

type IntegrityStatus = {
  label: string;
  detail: string;
  tone: StatusTone;
};

function isDataCenterHostingTransitUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase().replace(/\s+/g, "") ?? "";

  return normalized.includes("datacenter/webhosting/transit");
}

function formatUsageType(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
) {
  if (hasDetail(usageType)) {
    if (isDataCenterHostingTransitUsage(usageType)) {
      return "Infrastructure";
    }

    return formatDetail(usageType);
  }

  if (privacy?.hosting === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  return "Not identified";
}

function getIpTypeBadge(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
): IpTypeBadge {
  const normalized = usageType?.toLowerCase() ?? "";

  if (isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  if (normalized.includes("residential")) {
    return "Residential";
  }

  if (normalized.includes("mobile")) {
    return "Mobile";
  }

  if (normalized.includes("business")) {
    return "Business";
  }

  if (privacy?.hosting === true) {
    return "Infrastructure";
  }

  return "Unknown";
}

function getNetworkIdentity(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const parsedOrg = parseOrg(ipInfo.org);
  const asn = pickDetail(ipInfo.asn?.asn, parsedOrg.asn);
  const isp = pickDetail(
    ipInfo.company?.name,
    abuseIpDb?.isp,
    ipInfo.asn?.name,
    parsedOrg.name,
    ipInfo.org,
  );

  return {
    asn: formatDetail(asn),
    isp: formatDetail(isp),
  };
}

function formatLocation(ipInfo: IpInfoResponse) {
  const city = formatDetail(ipInfo.city);
  const country = formatDetail(pickDetail(ipInfo.country_name, ipInfo.country));
  const locationParts = [city, country].filter((value) => hasDetail(value));

  return locationParts.length > 0 ? locationParts.join(", ") : "Not identified";
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "Low";
  }

  if (score >= 40) {
    return "Medium";
  }

  return "High";
}

function getRiskLevelTone(riskLevel: RiskLevel): StatusTone {
  if (riskLevel === "Low") {
    return "good";
  }

  if (riskLevel === "Medium") {
    return "caution";
  }

  return "risk";
}

function getRiskLevelSummary(riskLevel: RiskLevel) {
  if (riskLevel === "Low") {
    return "No major risk signals were found in the available data.";
  }

  if (riskLevel === "Medium") {
    return "Some risk signals need review before using this IP for sensitive accounts.";
  }

  return "Strong risk signals were found. Avoid this IP for sensitive accounts.";
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "No abuse score";
  }

  if (abuseConfidence < 25) {
    return `Low, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 60) {
    return `Elevated, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 85) {
    return `High, ${abuseConfidence}%`;
  }

  return `Severe, ${abuseConfidence}%`;
}

function getAbuseIpDbHostname(abuseIpDb?: AbuseIpDbResponse | null) {
  const raw = abuseIpDb?.raw;

  if (!isObjectRecord(raw)) {
    return null;
  }

  const data = raw.data;

  if (!isObjectRecord(data)) {
    return null;
  }

  const hostnames = data.hostnames;

  if (!Array.isArray(hostnames)) {
    return null;
  }

  return typeof hostnames[0] === "string" ? hostnames[0] : null;
}

function getReverseDns(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return pickDetail(getAbuseIpDbHostname(abuseIpDb), ipInfo.hostname);
}

function getPrivacySignals(ipInfo: IpInfoResponse) {
  const privacy = ipInfo.privacy;

  return [
    privacy?.vpn === true ? "VPN" : null,
    privacy?.proxy === true ? "proxy" : null,
    privacy?.tor === true ? "Tor" : null,
    privacy?.relay === true ? "relay" : null,
  ].filter((signal): signal is string => Boolean(signal));
}

function hasNativeInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType)
  );
}

function hasInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return (
    hasNativeInfrastructureSignal(ipInfo, abuseIpDb) ||
    hasCloudflareColoSignal(ipInfo, cloudflare)
  );
}

function formatSignalList(signals: string[]) {
  if (signals.length === 0) {
    return "";
  }

  if (signals.length === 1) {
    return signals[0];
  }

  return `${signals.slice(0, -1).join(", ")} and ${signals.at(-1)}`;
}

function getScoreExplanationItems(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  cloudflare: CloudflareTraceResponse | null,
  score: number,
) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const privacySignals = getPrivacySignals(ipInfo);
  const hasInfrastructure = hasInfrastructureSignal(
    ipInfo,
    abuseIpDb,
    cloudflare,
  );
  const usageType = formatUsageType(abuseIpDb?.usageType, ipInfo.privacy);
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const reverseDns = getReverseDns(ipInfo, abuseIpDb);
  const items: string[] = [];

  if (score >= 85) {
    items.push(
      "The trust score is high because no major abuse or privacy signals were found.",
    );
  } else if (score >= 70) {
    items.push(
      "The trust score is strong, with only minor caution signals in the available data.",
    );
  } else if (score >= 40) {
    items.push(
      "The trust score is medium because one or more risk signals need review.",
    );
  } else {
    items.push(
      "The trust score is low because stronger abuse, privacy, or network signals were detected.",
    );
  }

  if (abuseConfidence === null) {
    items.push("No abuse database score was returned for this IP.");
  } else if (abuseConfidence === 0) {
    items.push("IP not found in recent abuse reports.");
  } else if (abuseConfidence < 25) {
    items.push(`Abuse history is low at ${abuseConfidence}% confidence.`);
  } else if (abuseConfidence < 60) {
    items.push(`Abuse history is elevated at ${abuseConfidence}% confidence.`);
  } else {
    items.push(`Abuse history is high at ${abuseConfidence}% confidence.`);
  }

  if (privacySignals.length === 0) {
    items.push("No VPN, proxy, Tor, or relay detected.");
  } else {
    items.push(`${formatSignalList(privacySignals)} detected.`);
  }

  if (isCloudflareWarpOn(cloudflare)) {
    items.push("Cloudflare WARP is active, which increases network risk.");
  } else if (cloudflare?.warp) {
    items.push("Cloudflare WARP is not active.");
  }

  if (hasInfrastructure) {
    items.push(
      hasDetail(usageType)
        ? `Network usage looks like ${usageType.toLowerCase()}, which stricter services may review.`
        : "Network integrity signals suggest infrastructure routing, which stricter services may review.",
    );
  } else {
    items.push("No hosting infrastructure signal was detected.");
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo agree on the visible IP.");
  } else if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo report different visible IPs.");
  }

  if (hasDetail(networkIdentity.asn) || hasDetail(networkIdentity.isp)) {
    items.push(
      `Network owner is visible: ${[networkIdentity.asn, networkIdentity.isp]
        .filter((value) => hasDetail(value))
        .join(" / ")}.`,
    );
  } else {
    items.push("ASN/ISP is unknown, so ownership confidence is lower.");
  }

  if (hasDetail(reverseDns)) {
    items.push("DNS is present and does not show an obvious conflict.");
  } else {
    items.push("DNS consistency could not be confirmed.");
  }

  return items;
}

function getRiskSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  cloudflare: CloudflareTraceResponse | null,
): RiskSignal[] {
  const privacy = ipInfo.privacy;
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const signals: RiskSignal[] = [];

  if (privacy?.proxy === true) {
    signals.push({
      label: "Proxy detected",
      detail: "Traffic appears to be routed through a proxy service.",
      tone: "risk",
    });
  }

  if (privacy?.vpn === true) {
    signals.push({
      label: "VPN detected",
      detail: "Traffic appears to be routed through a VPN service.",
      tone: "caution",
    });
  }

  if (privacy?.tor === true) {
    signals.push({
      label: "Tor detected",
      detail: "Tor exit traffic is a strong risk signal for many services.",
      tone: "risk",
    });
  }

  if (privacy?.relay === true) {
    signals.push({
      label: "Relay detected",
      detail: "Relay traffic can make the origin of activity harder to verify.",
      tone: "caution",
    });
  }

  if (isCloudflareWarpOn(cloudflare)) {
    signals.push({
      label: "WARP enabled",
      detail: "Cloudflare reports WARP is active for this network path.",
      tone: "risk",
    });
  }

  if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    signals.push({
      label: "IP mismatch",
      detail: "Cloudflare and IPinfo identify different visible IPs.",
      tone: "caution",
    });
  }

  if (abuseConfidence !== null && abuseConfidence > 0) {
    signals.push({
      label: "Abuse history",
      detail: `${formatAbuseConfidence(abuseIpDb)} confidence reported.`,
      tone: abuseConfidence >= 50 ? "risk" : "caution",
    });
  }

  if (hasNativeInfrastructureSignal(ipInfo, abuseIpDb)) {
    signals.push({
      label: "Suspicious ASN",
      detail: hasDetail(networkIdentity.asn)
        ? `${networkIdentity.asn} appears to be hosting or infrastructure.`
        : "Network appears to be hosting or infrastructure.",
      tone: "infrastructure",
    });
  }

  if (hasCloudflareColoSignal(ipInfo, cloudflare)) {
    signals.push({
      label: "Infrastructure route",
      detail: hasDetail(cloudflare?.colo)
        ? `Cloudflare routed this IP through ${cloudflare?.colo}.`
        : "Cloudflare detected an edge routing signal.",
      tone: "infrastructure",
    });
  }

  return signals;
}

function getServiceCompatibilitySummary(
  services: { status: ServiceCompatibilityStatus }[],
) {
  return (Array.isArray(services) ? services : []).reduce<
    Record<ServiceCompatibilityStatus, number>
  >(
    (summary, service) => ({
      ...summary,
      [service.status]: summary[service.status] + 1,
    }),
    {
      Good: 0,
      "Use with Caution": 0,
      "High Risk": 0,
    },
  );
}

function getServiceCompatibilitySummaryLabel(
  services: { status: ServiceCompatibilityStatus }[],
) {
  const summary = getServiceCompatibilitySummary(services);

  return `${summary.Good} Good - ${summary["Use with Caution"]} Caution - ${summary["High Risk"]} High Risk`;
}

const SERVICE_COMPATIBILITY_GROUPS = [
  {
    category: "GENERAL WEB",
    services: [
      "YouTube",
      "Reddit",
      "Wikipedia",
      "Facebook",
      "Instagram",
      "X",
      "TikTok",
    ],
  },
  {
    category: "AI SERVICES",
    services: ["ChatGPT", "Claude", "Gemini", "Perplexity", "Grok"],
  },
  {
    category: "STREAMING",
    services: ["Netflix", "Disney+", "Prime Video", "Max"],
  },
  {
    category: "DEVELOPER",
    services: ["GitHub", "GitLab", "Cloudflare", "Vercel"],
  },
  {
    category: "CLOUD",
    services: ["AWS", "Azure", "Google Cloud"],
  },
  {
    category: "GOOGLE",
    services: ["Google Voice", "Google Account", "Gmail", "Google Play"],
  },
  {
    category: "APPLE",
    services: ["Apple ID", "iCloud"],
  },
  {
    category: "COMMUNICATION",
    services: ["Discord", "Telegram"],
  },
  {
    category: "GAMING",
    services: ["Steam", "Epic Games", "PlayStation Network", "Xbox Live"],
  },
  {
    category: "FINANCE",
    services: ["PayPal", "Wise", "Stripe", "Revolut"],
  },
  {
    category: "CRYPTO",
    services: ["Binance", "Coinbase", "Kraken", "Bybit", "OKX"],
  },
] as const;

function roundProbability(value: number) {
  return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
}

function roundSignalValue(value: number) {
  return Number(value.toFixed(4));
}

function getFinalRiskLevel(score: number): FinalDecisionRiskLevel {
  if (score >= 70) {
    return "low";
  }

  if (score >= 40) {
    return "medium";
  }

  return "high";
}

function getLegacyRiskLevel(riskLevel: FinalDecisionRiskLevel): RiskLevel {
  if (riskLevel === "low") {
    return "Low";
  }

  if (riskLevel === "medium") {
    return "Medium";
  }

  return "High";
}

function getServiceStatusFromProbability(
  probability: number,
): ServiceCompatibilityStatus {
  if (probability >= 0.7) {
    return "Good";
  }

  if (probability >= 0.42) {
    return "Use with Caution";
  }

  return "High Risk";
}

function toScaledFinalDecisionSignal(
  signal: WeightedDecisionSignal,
  scale: number,
): FinalDecisionSignal {
  const contribution = roundSignalValue(signal.contribution * scale);
  const impact = roundSignalValue(signal.impact * scale);

  return {
    ...signal,
    weight: roundSignalValue(signal.weight * scale),
    impact,
    contribution,
  };
}

function buildProbabilitySignal(
  signalName: string,
  probability: number,
  weight: number,
): FinalDecisionSignal {
  const contribution = roundSignalValue((probability - 0.5) * weight);
  const impact = roundSignalValue(Math.abs(contribution));

  return {
    signalName,
    direction:
      contribution > 0.005
        ? "supports_availability"
        : contribution < -0.005
          ? "raises_risk"
          : "neutral",
    weight: roundSignalValue(weight),
    impact,
    contribution,
  };
}

function sortFinalDecisionSignals(signals: FinalDecisionSignal[]) {
  return [...signals].sort((signalA, signalB) => {
    if (signalB.impact !== signalA.impact) {
      return signalB.impact - signalA.impact;
    }

    return signalA.signalName.localeCompare(signalB.signalName);
  });
}

function getHistoricalAccessConsistency(
  ipHistory: IpHistoryRecord[],
): HistoricalAccessConsistency {
  if (ipHistory.length < 2) {
    return "unavailable";
  }

  const trustScores = ipHistory.map((historyRecord) => historyRecord.trustScore);
  const scoreSpread = Math.max(...trustScores) - Math.min(...trustScores);
  const ipTypes = new Set(
    ipHistory.map((historyRecord) => historyRecord.ipType),
  );

  if (scoreSpread <= 10 && ipTypes.size <= 1) {
    return "stable";
  }

  if (scoreSpread >= 30 || ipTypes.size >= 3) {
    return "unstable";
  }

  return "mixed";
}

function buildRegionRiskLevel(
  serviceCompatibility: { services: { finalDecision: FinalDecision }[] }[],
  region: string | null,
) {
  if (!region) {
    return "unknown";
  }

  const lowestServiceRegionScore = serviceCompatibility
    .flatMap((category) =>
      category.services.map(
        (service) =>
          service.finalDecision.decision.regionAvailability.probability,
      ),
    )
    .reduce<number | null>(
      (lowestScore, score) =>
        lowestScore === null ? score : Math.min(lowestScore, score),
      null,
    );

  return getRegionRiskLevel(lowestServiceRegionScore);
}

function getReportFinalDecision(
  serviceCompatibility: { services: { finalDecision: FinalDecision }[] }[],
) {
  return serviceCompatibility
    .flatMap((category) =>
      category.services.map((service) => service.finalDecision),
    )
    .reduce<FinalDecision | null>((lowestDecision, decision) => {
      if (!lowestDecision) {
        return decision;
      }

      if (
        decision.decision.regionAvailability.probability !==
        lowestDecision.decision.regionAvailability.probability
      ) {
        return decision.decision.regionAvailability.probability <
          lowestDecision.decision.regionAvailability.probability
          ? decision
          : lowestDecision;
      }

      return decision.decision.serviceCompatibility.probability <
        lowestDecision.decision.serviceCompatibility.probability
        ? decision
        : lowestDecision;
    }, null);
}

function buildRegionInferenceInput({
  service,
  region,
  ipInfo,
  abuseIpDb,
  ipqs,
  cloudflare,
  historicalAccessConsistency,
}: {
  service: string;
  region: string | null;
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  historicalAccessConsistency: HistoricalAccessConsistency;
}): RegionServiceInferenceInput {
  const compatibilitySignals = buildServiceCompatibilitySignals(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );

  return {
    service,
    region,
    usageType: abuseIpDb?.usageType ?? null,
    asnType: pickDetail(ipInfo.asn?.type, ipInfo.company?.type),
    ispName: pickDetail(
      ipInfo.company?.name,
      abuseIpDb?.isp,
      ipInfo.asn?.name,
      ipInfo.org,
    ),
    abuseConfidence: compatibilitySignals.abuseConfidence,
    fraudScore: ipqs?.fraudScore ?? null,
    recentAbuse: ipqs?.recentAbuse ?? null,
    hostingStatus: compatibilitySignals.hosting,
    vpnStatus: compatibilitySignals.vpn,
    proxyStatus: compatibilitySignals.proxy,
    torStatus: compatibilitySignals.tor,
    relayStatus: compatibilitySignals.relay,
    cloudflareWarpStatus: isCloudflareWarpOn(cloudflare),
    cloudflareTraceMatch: hasCloudflareTraceMatch(ipInfo, cloudflare),
    cloudflareTraceMismatch: hasCloudflareTraceMismatch(ipInfo, cloudflare),
    historicalAccessConsistency,
  };
}

function buildFinalDecision({
  service,
  region,
  ipInfo,
  abuseIpDb,
  ipqs,
  cloudflare,
  historicalAccessConsistency,
}: {
  service: string;
  region: string | null;
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  historicalAccessConsistency: HistoricalAccessConsistency;
}): FinalDecision {
  const trustScore = calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);
  const trustProbability = roundProbability(trustScore / 100);
  const regionInference = inferRegionServiceCompatibility(
    buildRegionInferenceInput({
      service,
      region,
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
      historicalAccessConsistency,
    }),
  );
  const serviceProbability = trustProbability;
  const signals = sortFinalDecisionSignals([
    buildProbabilitySignal("trust_score", trustProbability, 0.55),
    buildProbabilitySignal(
      "region_availability",
      regionInference.probability,
      0.45,
    ),
    ...regionInference.signals.map((signal) =>
      toScaledFinalDecisionSignal(signal, 0.45),
    ),
  ]);

  return createFinalDecisionV1({
    rawSignals: {
      ip: ipInfo.ip ?? "",
      region,
      service,
      signals: regionInference.signals,
    },
    computedMetrics: {
      trustScore,
      trustProbability,
      regionAvailabilityProbability: regionInference.probability,
      serviceCompatibilityProbability: serviceProbability,
    },
    decision: {
      ip: ipInfo.ip ?? "",
      trustScore,
      riskLevel: getFinalRiskLevel(trustScore),
      regionAvailability: {
        status: regionInference.status,
        probability: regionInference.probability,
        restriction: regionInference.restriction,
        explanation: regionInference.explanation,
      },
      serviceCompatibility: {
        status: getServiceStatusFromProbability(serviceProbability),
        probability: serviceProbability,
      },
      signals,
    },
  });
}

function buildServiceCompatibilityView(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
  cloudflare: CloudflareTraceResponse | null,
  ipHistory: IpHistoryRecord[],
) {
  const region = detectRegionFromIpInfo(ipInfo);
  const historicalAccessConsistency = getHistoricalAccessConsistency(ipHistory);

  return SERVICE_COMPATIBILITY_GROUPS.map((category) => ({
    category: category.category,
    services: category.services.map((serviceName) => {
      const finalDecision = buildFinalDecision({
        service: serviceName,
        region,
        ipInfo,
        abuseIpDb,
        ipqs,
        cloudflare,
        historicalAccessConsistency,
      });
      const status = finalDecision.decision.serviceCompatibility.status;

      return {
        name: serviceName,
        status,
        probability: finalDecision.decision.serviceCompatibility.probability,
        tone: getServiceCompatibilityTone(status),
        reason: finalDecision.display.summary,
        finalDecision,
      };
    }),
  })).map((category) => ({
    ...category,
    summary: getServiceCompatibilitySummaryLabel(category.services),
  }));
}

function formatCloudflareLocation(cloudflare?: CloudflareTraceResponse | null) {
  const country = formatDetail(cloudflare?.country);
  const colo = formatDetail(cloudflare?.colo);

  if (hasDetail(country) && hasDetail(colo)) {
    return `${country} (${colo})`;
  }

  if (hasDetail(country)) {
    return country;
  }

  if (hasDetail(colo)) {
    return colo;
  }

  return "Not identified";
}

function getWarpStatus(
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.warp) {
    return {
      label: "Not available",
      tone: "neutral",
      detail: "WARP status was not returned.",
    };
  }

  if (isCloudflareWarpOn(cloudflare)) {
    return {
      label: "WARP on",
      tone: "risk",
      detail: "Cloudflare WARP is active for this connection.",
    };
  }

  return {
    label: "No WARP detected",
    tone: "good",
    detail: "Cloudflare did not report WARP on this connection.",
  };
}

function getConsistencyStatus(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.ip || !ipInfo.ip) {
    return {
      label: "Not available",
      tone: "neutral",
      detail: "Unable to compare Cloudflare and IPinfo views.",
    };
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    return {
      label: "Consistent",
      tone: "good",
      detail: "Cloudflare and IPinfo identify the same IP.",
    };
  }

  return {
    label: "Needs review",
    tone: "caution",
    detail: "Cloudflare and IPinfo identify different IPs.",
  };
}

function getNetworkIntegrityTone(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): StatusTone {
  if (!cloudflare) {
    return "neutral";
  }

  if (
    isCloudflareWarpOn(cloudflare) ||
    hasCloudflareTraceMismatch(ipInfo, cloudflare)
  ) {
    return "caution";
  }

  return "good";
}

function buildNetworkIntegrity(
  ipInfo: IpInfoResponse,
  cloudflare: CloudflareTraceResponse | null,
): NetworkIntegrity {
  const warpStatus = getWarpStatus(cloudflare);
  const consistencyStatus = getConsistencyStatus(ipInfo, cloudflare);
  const tone = getNetworkIntegrityTone(ipInfo, cloudflare);

  return {
    label:
      tone === "good" ? "Clean" : tone === "caution" ? "Review" : "Unavailable",
    tone,
    hasCloudflare: Boolean(cloudflare),
    unavailableMessage: "Network integrity is unavailable right now.",
    items: [
      {
        label: "Real IP",
        value: formatDetail(cloudflare?.ip),
        detail: "Seen by Cloudflare trace.",
        tone: "neutral",
      },
      {
        label: "Location",
        value: formatCloudflareLocation(cloudflare),
        detail: "Cloudflare network view.",
        tone: "neutral",
      },
      {
        label: "VPN/WARP",
        value: warpStatus.label,
        detail: warpStatus.detail,
        tone: warpStatus.tone,
      },
      {
        label: "Consistency",
        value: consistencyStatus.label,
        detail: consistencyStatus.detail,
        tone: consistencyStatus.tone,
      },
    ],
  };
}

function buildIpHistoryRecord(
  result: ProviderAnalysisResult,
  fallbackIpAddress: string,
): IpHistoryRecord {
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = result;
  const trustScore = calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);

  return {
    ip: ipInfo.ip || fallbackIpAddress,
    timestamp: Date.now(),
    trustScore,
    recommendationLabel:
      trustScore >= 70
        ? "Recommended"
        : trustScore >= 40
          ? "Use with Caution"
          : "Not Recommended",
    confidence: buildRecommendationConfidence(
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
    ),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    usageType: formatUsageType(abuseIpDb?.usageType, ipInfo.privacy),
    ipType: getIpTypeBadge(abuseIpDb?.usageType, ipInfo.privacy),
  };
}

function buildIpSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
) {
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);

  return {
    address: formatDetail(ipInfo.ip),
    facts: [
      { label: "Location", value: formatLocation(ipInfo) },
      hasDetail(networkIdentity.asn)
        ? { label: "ASN", value: networkIdentity.asn }
        : null,
      hasDetail(networkIdentity.isp)
        ? { label: "ISP", value: networkIdentity.isp }
        : null,
    ].filter((fact): fact is ResultFact => Boolean(fact)),
  };
}

function getRecommendationLabelFromServiceStatus(
  status: ServiceCompatibilityStatus,
) {
  if (status === "Good") {
    return "Recommended";
  }

  if (status === "Use with Caution") {
    return "Use with Caution";
  }

  return "Not Recommended";
}

function buildTrustScore(
  providerResult: ProviderAnalysisResult,
  hasAnalysis: boolean,
  finalDecision: FinalDecision | null,
): AnalysisResult["trustScore"] {
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = providerResult;

  if (!hasAnalysis) {
    return {
      value: null,
      displayValue: "--",
      riskLabel: "Pending",
      riskTone: "neutral" satisfies StatusTone,
      recommendationLabel: "Not analyzed",
      recommendationTone: "neutral" satisfies StatusTone,
      summary: "Run an analysis to populate this report.",
      explanationIntro: "Score details will appear here after analysis.",
      explanationItems: ["Run an analysis to see score details."],
      hasAnalysis,
    };
  }

  const normalizedFinalDecision = finalDecision
    ? normalizeFinalDecision(finalDecision)
    : null;
  const value =
    normalizedFinalDecision?.decision.trustScore ??
    calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);
  const riskLevel = normalizedFinalDecision
    ? getLegacyRiskLevel(normalizedFinalDecision.decision.riskLevel)
    : getRiskLevel(value);
  const serviceStatus =
    normalizedFinalDecision?.decision.serviceCompatibility.status ??
    getServiceStatusFromProbability(value / 100);
  const recommendationLabel =
    getRecommendationLabelFromServiceStatus(serviceStatus);
  const serviceProbability = Math.round(
    (normalizedFinalDecision?.decision.serviceCompatibility.probability ??
      value / 100) * 100,
  );

  return {
    value,
    displayValue: String(value),
    riskLabel: `${riskLevel} Risk`,
    riskTone: getRiskLevelTone(riskLevel),
    recommendationLabel,
    recommendationTone: getRecommendationTone(recommendationLabel),
    summary: `${getRiskLevelSummary(riskLevel)} IP reputation compatibility probability is ${serviceProbability}%.`,
    explanationIntro: `Why this IP received a ${value}/100 trust score.`,
    explanationItems: getScoreExplanationItems(
      ipInfo,
      abuseIpDb,
      cloudflare,
      value,
    ),
    hasAnalysis,
  };
}

export function buildAnalysisResult({
  providerResult,
  ipHistory = [],
  fallbackIpAddress = "",
}: {
  providerResult: ProviderAnalysisResult | null;
  ipHistory?: IpHistoryRecord[];
  fallbackIpAddress?: string;
}): AnalysisResult {
  const hasAnalysis = Boolean(providerResult);
  const normalizedResult = normalizeProviderAnalysisResult(
    providerResult,
    fallbackIpAddress,
  );
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = normalizedResult;
  const normalizedIpHistory = normalizeIpHistory(ipHistory);
  const serviceCompatibility = hasAnalysis
    ? buildServiceCompatibilityView(
        ipInfo,
        abuseIpDb,
        ipqs,
        cloudflare,
        normalizedIpHistory,
      )
    : [];
  const region = detectRegionFromIpInfo(ipInfo);
  const finalDecision = getReportFinalDecision(serviceCompatibility);

  return {
    ip: buildIpSummary(ipInfo, abuseIpDb),
    trustScore: buildTrustScore(normalizedResult, hasAnalysis, finalDecision),
    riskSignals: hasAnalysis
      ? getRiskSignals(ipInfo, abuseIpDb, cloudflare)
      : [],
    finalDecision,
    serviceCompatibility,
    regionRiskLevel: hasAnalysis
      ? buildRegionRiskLevel(serviceCompatibility, region)
      : "unknown",
    ipHistory: normalizedIpHistory,
    networkIntegrity: buildNetworkIntegrity(ipInfo, cloudflare),
  };
}

export function getEmptyAnalysisResult(fallbackIpAddress = ""): AnalysisResult {
  return buildAnalysisResult({
    providerResult: null,
    fallbackIpAddress,
  });
}

export async function buildAnalysis(ipAddress: string): Promise<AnalysisResult> {
  const trimmedIpAddress = ipAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const providerResult = await fetchProviderAnalysis(trimmedIpAddress);
  const storedIpHistory = loadIpHistory();
  const historyRecord = buildIpHistoryRecord(providerResult, trimmedIpAddress);
  const nextIpHistory = getNextIpHistory(storedIpHistory, historyRecord);

  persistIpHistory(nextIpHistory);

  return buildAnalysisResult({
    providerResult,
    ipHistory: getHistoryForIp(nextIpHistory, historyRecord.ip),
    fallbackIpAddress: trimmedIpAddress,
  });
}

export async function analyzeIpAddress(
  ipAddress: string,
): Promise<AnalysisResult> {
  return buildAnalysis(ipAddress);
}
