import type { StatusTone } from "@/lib/status-colors";

import {
  isConnectivityProbeReachable,
  isConnectivityProbeUnreachable,
} from "../connectivity/probe";
import { parseOrg, pickDetail } from "../normalize/common";
import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  ConnectivityProbeResult,
  FinalDecision,
  IpInfoResponse,
  IpqsResponse,
  IpQualityReport,
  IpQualityScoreDimension,
  IpQualityScoreDimensionKey,
  ServiceCompatibilityCategory,
} from "../types";

const QUALITY_SCORE_WEIGHTS = {
  reputation: 0.5,
  networkQuality: 0.3,
  compatibility: 0.2,
} satisfies IpQualityReport["weights"];

type BuildIpQualityReportInput = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  connectivity: ConnectivityProbeResult | null;
  finalDecision: FinalDecision | null;
  serviceCompatibility: ServiceCompatibilityCategory[];
  hasAnalysis: boolean;
};

type ScoreEvidence = {
  score: number;
  summary: string;
  detail: string;
  tone: StatusTone;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreTone(score: number): StatusTone {
  if (score >= 80) {
    return "good";
  }

  if (score >= 60) {
    return "caution";
  }

  return "risk";
}

function formatScore(score: number | null) {
  return score === null ? "--" : String(score);
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
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

function hasNetworkTextSignal(ipInfo: IpInfoResponse, keywords: string[]) {
  const values = [
    ipInfo.asn?.type,
    ipInfo.company?.type,
    ipInfo.asn?.name,
    ipInfo.company?.name,
    ipInfo.org,
  ];

  return values.some((value) => {
    const normalizedValue = normalizeText(value);

    return keywords.some((keyword) => normalizedValue.includes(keyword));
  });
}

function hasCloudflareTraceMatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = normalizeText(cloudflare?.ip);
  const ipInfoIp = normalizeText(ipInfo.ip);

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

function hasConsumerNetworkSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const usageType = normalizeText(abuseIpDb?.usageType);

  return (
    usageType.includes("residential") ||
    usageType.includes("mobile") ||
    hasNetworkTextSignal(ipInfo, [
      "broadband",
      "cable",
      "cellular",
      "fiber",
      "fibre",
      "internet service provider",
      "isp",
      "mobile",
      "telecom",
      "wireless",
    ])
  );
}

function getIpInfoOwnershipSignals(ipInfo: IpInfoResponse) {
  const parsedOrg = parseOrg(ipInfo.org);
  const asn = pickDetail(ipInfo.asn?.asn, parsedOrg.asn);
  const owner = pickDetail(ipInfo.company?.name, ipInfo.asn?.name, ipInfo.org);

  return {
    hasAsn: Boolean(asn),
    hasOwner: Boolean(owner),
  };
}

function getIpqsFraudScore(ipqs?: IpqsResponse | null) {
  if (ipqs?.status === "unavailable") {
    return null;
  }

  return ipqs?.fraudScore ?? null;
}

function getAbusePenalty(abuseConfidence: number | null) {
  if (abuseConfidence === null || abuseConfidence <= 0) {
    return 0;
  }

  if (abuseConfidence >= 85) {
    return 50;
  }

  if (abuseConfidence >= 60) {
    return 35;
  }

  if (abuseConfidence >= 25) {
    return 20;
  }

  return 10;
}

function getIpqsFraudPenalty(fraudScore: number | null) {
  if (fraudScore === null || fraudScore <= 0) {
    return 0;
  }

  if (fraudScore >= 90) {
    return 65;
  }

  if (fraudScore >= 80) {
    return 45;
  }

  if (fraudScore >= 60) {
    return 30;
  }

  if (fraudScore >= 25) {
    return 15;
  }

  return fraudScore >= 10 ? 5 : 0;
}

function buildReputationScore(
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
): ScoreEvidence {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const fraudScore = getIpqsFraudScore(ipqs);
  const penalties = [
    getAbusePenalty(abuseConfidence),
    getIpqsFraudPenalty(fraudScore),
    ipqs?.recentAbuse === true ? 25 : 0,
    ipqs?.bot === true ? 15 : 0,
  ];
  const score = clampScore(
    100 - penalties.reduce((total, penalty) => total + penalty, 0),
  );
  const hasAbuseSignal = (abuseConfidence ?? 0) > 0;
  const hasFraudSignal = (fraudScore ?? 0) >= 25;
  const hasStrongSignal =
    (abuseConfidence ?? 0) >= 60 ||
    (fraudScore ?? 0) >= 80 ||
    ipqs?.recentAbuse === true;

  if (hasStrongSignal) {
    return {
      score,
      summary: "High reputation risk detected",
      detail: "Abuse history or IPQS reputation data raised a strong signal.",
      tone: getScoreTone(score),
    };
  }

  if (hasAbuseSignal || hasFraudSignal || ipqs?.bot === true) {
    return {
      score,
      summary: "Some reputation signals found",
      detail: "Provider reputation data shows low to moderate review signals.",
      tone: getScoreTone(score),
    };
  }

  if (ipqs?.status === "unavailable") {
    return {
      score,
      summary: "Clean reputation from available data",
      detail: "IPQS was unavailable, so reputation uses the remaining provider data.",
      tone: "good",
    };
  }

  return {
    score,
    summary: "Clean IP history",
    detail: "No abuse history or high IPQS reputation risk was reported.",
    tone: "good",
  };
}

function buildNetworkQualityScore({
  ipInfo,
  abuseIpDb,
  ipqs,
  cloudflare,
}: Pick<
  BuildIpQualityReportInput,
  "ipInfo" | "abuseIpDb" | "ipqs" | "cloudflare"
>): ScoreEvidence {
  const privacy = ipInfo.privacy;
  const hasTor = privacy?.tor === true || ipqs?.tor === true;
  const hasVpn =
    privacy?.vpn === true || ipqs?.vpn === true || ipqs?.activeVpn === true;
  const hasProxy = privacy?.proxy === true || ipqs?.proxy === true;
  const hasRelay = privacy?.relay === true;
  const hasHosting =
    privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    hasCloudflareColoSignal(ipInfo, cloudflare) ||
    hasNetworkTextSignal(ipInfo, [
      "cloud",
      "data center",
      "datacenter",
      "host",
      "hosting",
      "infrastructure",
      "server",
    ]);
  const hasConsumer = hasConsumerNetworkSignal(ipInfo, abuseIpDb);
  const ownership = getIpInfoOwnershipSignals(ipInfo);
  const penalties = [
    hasTor ? 55 : 0,
    hasProxy ? 40 : 0,
    hasVpn ? 35 : 0,
    hasRelay ? 20 : 0,
    hasHosting ? 30 : 0,
    isCloudflareWarpOn(cloudflare) ? 25 : 0,
    !ownership.hasAsn ? 10 : 0,
    !ownership.hasOwner ? 5 : 0,
    !hasConsumer && !hasHosting && !hasVpn && !hasProxy && !hasTor ? 10 : 0,
  ];
  const score = clampScore(
    100 - penalties.reduce((total, penalty) => total + penalty, 0),
  );

  if (hasTor) {
    return {
      score,
      summary: "Tor network detected",
      detail: "Tor exit traffic is a shared network signal for many services.",
      tone: "risk",
    };
  }

  if (hasVpn || hasProxy || hasRelay || isCloudflareWarpOn(cloudflare)) {
    return {
      score,
      summary: "VPN or proxy network detected",
      detail: "An anonymized, relayed, or shared network path was detected.",
      tone: score >= 60 ? "caution" : "risk",
    };
  }

  if (hasHosting) {
    return {
      score,
      summary: "Datacenter network detected",
      detail: "Hosting, cloud, or infrastructure ownership signals were found.",
      tone: "infrastructure",
    };
  }

  if (hasConsumer) {
    return {
      score,
      summary: "Residential ISP detected",
      detail: "Network ownership looks like a normal consumer ISP or mobile network.",
      tone: "good",
    };
  }

  return {
    score,
    summary: "Network type not fully identified",
    detail: "Provider data did not clearly identify a residential or infrastructure network.",
    tone: getScoreTone(score),
  };
}

function getConnectivityCounts(connectivity: ConnectivityProbeResult | null) {
  const probes = connectivity ? Object.values(connectivity) : [];

  return {
    total: probes.length,
    reachable: probes.filter(isConnectivityProbeReachable).length,
    unreachable: probes.filter(isConnectivityProbeUnreachable).length,
    notVerified: probes.filter(
      (probe) =>
        !isConnectivityProbeReachable(probe) &&
        !isConnectivityProbeUnreachable(probe),
    ).length,
  };
}

function getConnectivityBaseScore(connectivity: ConnectivityProbeResult | null) {
  const counts = getConnectivityCounts(connectivity);

  if (counts.total === 0) {
    return 75;
  }

  if (counts.reachable === counts.total) {
    return 100;
  }

  if (counts.unreachable === 0 && counts.reachable > 0) {
    return 90;
  }

  if (counts.unreachable === 0) {
    return 75;
  }

  return clampScore(
    85 + counts.reachable * 5 - counts.notVerified * 5 - counts.unreachable * 30,
  );
}

function getRestrictedServiceCount(
  serviceCompatibility: ServiceCompatibilityCategory[],
) {
  return serviceCompatibility
    .flatMap((category) => category.services)
    .filter((service) => service.finalAvailability === "Restricted").length;
}

function getRegionRestrictionPenalty(
  finalDecision: FinalDecision | null,
  restrictedServiceCount: number,
) {
  const regionAvailability = finalDecision?.decision.regionAvailability;
  const hasHardRestriction =
    regionAvailability?.status === "likely_blocked" ||
    regionAvailability?.restriction === "hard_region";
  const servicePenalty =
    restrictedServiceCount > 0
      ? Math.min(30, 15 + restrictedServiceCount * 2)
      : 0;

  return Math.max(hasHardRestriction ? 30 : 0, servicePenalty);
}

function buildCompatibilityScore({
  connectivity,
  finalDecision,
  serviceCompatibility,
}: Pick<
  BuildIpQualityReportInput,
  "connectivity" | "finalDecision" | "serviceCompatibility"
>): ScoreEvidence {
  const counts = getConnectivityCounts(connectivity);
  const restrictedServiceCount = getRestrictedServiceCount(serviceCompatibility);
  const restrictionPenalty = getRegionRestrictionPenalty(
    finalDecision,
    restrictedServiceCount,
  );
  const score = clampScore(
    getConnectivityBaseScore(connectivity) - restrictionPenalty,
  );

  if (restrictedServiceCount > 0 || restrictionPenalty >= 30) {
    return {
      score,
      summary: "Regional restriction detected",
      detail: "One or more service checks indicate regional or policy restrictions.",
      tone: getScoreTone(score),
    };
  }

  if (counts.unreachable > 0) {
    return {
      score,
      summary: "Connectivity failure detected",
      detail: `${counts.unreachable} of ${counts.total} browser probes were unreachable.`,
      tone: getScoreTone(score),
    };
  }

  if (counts.total === 0) {
    return {
      score,
      summary: "Connectivity not fully verified",
      detail: "No browser connectivity probe data is available for this report.",
      tone: "caution",
    };
  }

  if (counts.reachable === 0) {
    return {
      score,
      summary: "Connectivity not fully verified",
      detail: "Browser probes ran, but reachability could not be fully confirmed.",
      tone: "caution",
    };
  }

  if (counts.reachable === counts.total) {
    return {
      score,
      summary: "Connectivity verified",
      detail: "All tested service probes were reachable.",
      tone: "good",
    };
  }

  return {
    score,
    summary: "Most tested services reachable",
    detail: `${counts.reachable} probes were verified reachable and ${counts.notVerified} could not be fully verified by the browser.`,
    tone: score >= 80 ? "good" : "caution",
  };
}

function buildDimension(
  key: IpQualityScoreDimensionKey,
  label: string,
  icon: string,
  evidence: ScoreEvidence,
): IpQualityScoreDimension {
  return {
    key,
    label,
    icon,
    score: evidence.score,
    displayValue: formatScore(evidence.score),
    summary: evidence.summary,
    detail: evidence.detail,
    tone: evidence.tone,
  };
}

function buildPendingDimension(
  key: IpQualityScoreDimensionKey,
  label: string,
  icon: string,
  summary: string,
): IpQualityScoreDimension {
  return {
    key,
    label,
    icon,
    score: null,
    displayValue: "--",
    summary,
    detail: "Run an analysis to calculate this score.",
    tone: "neutral",
  };
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildOverallSummary(
  dimensions: IpQualityReport["dimensions"],
) {
  const reputation = dimensions.reputation;
  const network = dimensions.networkQuality;
  const compatibility = dimensions.compatibility;

  if (
    (reputation.score ?? 0) >= 85 &&
    (network.score ?? 100) < 80
  ) {
    return `Good reputation, but ${lowerFirst(network.summary)}.`;
  }

  if (
    (reputation.score ?? 0) >= 85 &&
    (compatibility.score ?? 0) >= 85
  ) {
    return "Clean IP with strong compatibility.";
  }

  if ((reputation.score ?? 100) < 60) {
    return "Reputation risk is the main issue for this IP.";
  }

  if ((compatibility.score ?? 100) < 70) {
    return "Compatibility needs review before sensitive use.";
  }

  return `${reputation.summary}. ${network.summary}. ${compatibility.summary}.`;
}

function buildOverallScore(dimensions: IpQualityReport["dimensions"]) {
  return clampScore(
    (dimensions.reputation.score ?? 0) * QUALITY_SCORE_WEIGHTS.reputation +
      (dimensions.networkQuality.score ?? 0) *
        QUALITY_SCORE_WEIGHTS.networkQuality +
      (dimensions.compatibility.score ?? 0) *
        QUALITY_SCORE_WEIGHTS.compatibility,
  );
}

export function buildIpQualityReport({
  ipInfo,
  abuseIpDb,
  ipqs,
  cloudflare,
  connectivity,
  finalDecision,
  serviceCompatibility,
  hasAnalysis,
}: BuildIpQualityReportInput): IpQualityReport {
  if (!hasAnalysis) {
    const dimensions = {
      reputation: buildPendingDimension(
        "reputation",
        "Reputation",
        "Shield",
        "Reputation pending",
      ),
      networkQuality: buildPendingDimension(
        "networkQuality",
        "Network Quality",
        "Globe",
        "Network quality pending",
      ),
      compatibility: buildPendingDimension(
        "compatibility",
        "Compatibility",
        "Check",
        "Compatibility pending",
      ),
    } satisfies IpQualityReport["dimensions"];

    return {
      overallScore: null,
      displayValue: "--",
      summary:
        "Enter an IP address or analyze your current IP to see IP quality and compatibility.",
      recommendationExplanation: "Run an analysis to see the final recommendation.",
      weights: QUALITY_SCORE_WEIGHTS,
      dimensions,
    };
  }

  const dimensions = {
    reputation: buildDimension(
      "reputation",
      "Reputation",
      "Shield",
      buildReputationScore(abuseIpDb, ipqs),
    ),
    networkQuality: buildDimension(
      "networkQuality",
      "Network Quality",
      "Globe",
      buildNetworkQualityScore({ ipInfo, abuseIpDb, ipqs, cloudflare }),
    ),
    compatibility: buildDimension(
      "compatibility",
      "Compatibility",
      "Check",
      buildCompatibilityScore({
        connectivity,
        finalDecision,
        serviceCompatibility,
      }),
    ),
  } satisfies IpQualityReport["dimensions"];
  const overallScore = buildOverallScore(dimensions);

  return {
    overallScore,
    displayValue: formatScore(overallScore),
    summary: buildOverallSummary(dimensions),
    recommendationExplanation: buildOverallSummary(dimensions),
    weights: QUALITY_SCORE_WEIGHTS,
    dimensions,
  };
}
