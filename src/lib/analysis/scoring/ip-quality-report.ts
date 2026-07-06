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
  IpQualityConfidence,
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
  assessmentLabel: string;
  summary: string;
  detail: string;
  tone: StatusTone;
  confidence: Exclude<IpQualityConfidence, "Pending">;
  confidenceReason: string;
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

function getConfidenceTone(confidence: IpQualityConfidence): StatusTone {
  if (confidence === "High") {
    return "good";
  }

  if (confidence === "Medium") {
    return "caution";
  }

  if (confidence === "Low") {
    return "risk";
  }

  return "neutral";
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function capScoreForEvidence(score: number, maxScore: number) {
  return Math.min(score, maxScore);
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

function hasIpInfoProviderData(ipInfo: IpInfoResponse) {
  const ownership = getIpInfoOwnershipSignals(ipInfo);
  const hasLocation =
    hasText(ipInfo.country) ||
    hasText(ipInfo.country_name) ||
    hasText(ipInfo.region) ||
    hasText(ipInfo.city);
  const hasPrivacyFields = Object.values(ipInfo.privacy ?? {}).some(
    (value) => value !== undefined && value !== null,
  );

  return (
    ownership.hasAsn || ownership.hasOwner || hasLocation || hasPrivacyFields
  );
}

function getIpInfoCoverage(ipInfo: IpInfoResponse) {
  const ownership = getIpInfoOwnershipSignals(ipInfo);

  if (!hasIpInfoProviderData(ipInfo)) {
    return "unavailable";
  }

  if (!ownership.hasAsn || !ownership.hasOwner) {
    return "partial";
  }

  return "available";
}

function isIpqsAvailable(ipqs?: IpqsResponse | null) {
  return Boolean(ipqs && ipqs.status !== "unavailable");
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

function getReputationConfidence(
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
) {
  const hasAbuseIpDb = Boolean(abuseIpDb);
  const hasIpqs = isIpqsAvailable(ipqs);

  if (hasAbuseIpDb && hasIpqs) {
    return {
      confidence: "High" as const,
      confidenceReason: "IPQS and abuse history providers were available.",
      maxScore: 100,
    };
  }

  if (!hasAbuseIpDb && !hasIpqs) {
    return {
      confidence: "Low" as const,
      confidenceReason: "Reputation providers were unavailable.",
      maxScore: 70,
    };
  }

  return {
    confidence: "Medium" as const,
    confidenceReason: "Some reputation providers were unavailable.",
    maxScore: hasIpqs ? 90 : 85,
  };
}

function getReputationAssessmentLabel(score: number) {
  if (score >= 85) {
    return "Good Reputation";
  }

  if (score >= 70) {
    return "Mostly Clean Reputation";
  }

  if (score >= 40) {
    return "Reputation Needs Review";
  }

  return "High Reputation Risk";
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
  const providerConfidence = getReputationConfidence(abuseIpDb, ipqs);
  const rawScore = clampScore(
    100 - penalties.reduce((total, penalty) => total + penalty, 0),
  );
  const score = capScoreForEvidence(rawScore, providerConfidence.maxScore);
  const hasAbuseSignal = (abuseConfidence ?? 0) > 0;
  const hasFraudSignal = (fraudScore ?? 0) >= 25;
  const hasStrongSignal =
    (abuseConfidence ?? 0) >= 60 ||
    (fraudScore ?? 0) >= 80 ||
    ipqs?.recentAbuse === true;

  if (hasStrongSignal) {
    return {
      score,
      assessmentLabel: getReputationAssessmentLabel(score),
      summary: "High reputation risk detected",
      detail: "Abuse history or IPQS reputation data raised a strong signal.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasAbuseSignal || hasFraudSignal || ipqs?.bot === true) {
    return {
      score,
      assessmentLabel: getReputationAssessmentLabel(score),
      summary: "Some reputation signals found",
      detail: "Provider reputation data shows low to moderate review signals.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (ipqs?.status === "unavailable") {
    return {
      score,
      assessmentLabel: getReputationAssessmentLabel(score),
      summary: "Clean reputation from available data",
      detail:
        "Some reputation providers were unavailable, so reputation uses the remaining provider data.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  return {
    score,
    assessmentLabel: getReputationAssessmentLabel(score),
    summary: "Clean IP history",
    detail: "No abuse history or high IPQS reputation risk was reported.",
    tone: getScoreTone(score),
    confidence: providerConfidence.confidence,
    confidenceReason: providerConfidence.confidenceReason,
  };
}

function getNetworkQualityConfidence(ipInfo: IpInfoResponse) {
  const ipInfoCoverage = getIpInfoCoverage(ipInfo);

  if (ipInfoCoverage === "available") {
    return {
      confidence: "High" as const,
      confidenceReason: "IPInfo network ownership data is available.",
      maxScore: 100,
    };
  }

  if (ipInfoCoverage === "partial") {
    return {
      confidence: "Medium" as const,
      confidenceReason: "IPInfo ownership data is incomplete.",
      maxScore: 85,
    };
  }

  return {
    confidence: "Low" as const,
    confidenceReason: "IPInfo response unavailable.",
    maxScore: 70,
  };
}

function getNetworkQualityAssessmentLabel(score: number) {
  if (score >= 85) {
    return "Strong Network Quality";
  }

  if (score >= 70) {
    return "Medium Network Quality";
  }

  if (score >= 40) {
    return "Limited Network Quality";
  }

  return "High Network Risk";
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
  const providerConfidence = getNetworkQualityConfidence(ipInfo);
  const rawScore = clampScore(
    100 - penalties.reduce((total, penalty) => total + penalty, 0),
  );
  const score = capScoreForEvidence(rawScore, providerConfidence.maxScore);

  if (hasTor) {
    return {
      score,
      assessmentLabel: getNetworkQualityAssessmentLabel(score),
      summary: "Tor network detected",
      detail: "Tor exit traffic is a shared network signal for many services.",
      tone: "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasVpn || hasProxy || hasRelay || isCloudflareWarpOn(cloudflare)) {
    return {
      score,
      assessmentLabel: getNetworkQualityAssessmentLabel(score),
      summary: "VPN or proxy network detected",
      detail: "An anonymized, relayed, or shared network path was detected.",
      tone: score >= 60 ? "caution" : "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasHosting) {
    return {
      score,
      assessmentLabel: getNetworkQualityAssessmentLabel(score),
      summary: "Datacenter network detected",
      detail:
        "This IP belongs to infrastructure commonly used by hosting providers.",
      tone: "infrastructure",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasConsumer) {
    return {
      score,
      assessmentLabel: getNetworkQualityAssessmentLabel(score),
      summary: "Residential ISP detected",
      detail:
        "Network ownership looks like a normal consumer ISP or mobile network.",
      tone: "good",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  return {
    score,
    assessmentLabel: getNetworkQualityAssessmentLabel(score),
    summary: "Network type not fully identified",
    detail:
      "Provider data did not clearly identify a residential or infrastructure network.",
    tone: getScoreTone(score),
    confidence: providerConfidence.confidence,
    confidenceReason: providerConfidence.confidenceReason,
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

function getConnectivityBaseScore(
  connectivity: ConnectivityProbeResult | null,
) {
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
    85 +
      counts.reachable * 5 -
      counts.notVerified * 5 -
      counts.unreachable * 30,
  );
}

function getConnectivityConfidence(
  connectivity: ConnectivityProbeResult | null,
) {
  const counts = getConnectivityCounts(connectivity);

  if (counts.total === 0) {
    return {
      confidence: "Low" as const,
      confidenceReason: "Connectivity probes were unavailable.",
      maxScore: 75,
    };
  }

  if (counts.notVerified > 0) {
    return {
      confidence: "Medium" as const,
      confidenceReason: "Some connectivity probes could not be fully verified.",
      maxScore: 85,
    };
  }

  return {
    confidence: "High" as const,
    confidenceReason: "Connectivity probes completed.",
    maxScore: 100,
  };
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

function getCompatibilityAssessmentLabel(score: number) {
  if (score >= 85) {
    return "Strong Compatibility";
  }

  if (score >= 70) {
    return "Moderate Compatibility";
  }

  if (score >= 40) {
    return "Limited Compatibility";
  }

  return "Restricted Compatibility";
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
  const restrictedServiceCount =
    getRestrictedServiceCount(serviceCompatibility);
  const restrictionPenalty = getRegionRestrictionPenalty(
    finalDecision,
    restrictedServiceCount,
  );
  const connectivityConfidence = getConnectivityConfidence(connectivity);
  const rawScore = clampScore(
    getConnectivityBaseScore(connectivity) - restrictionPenalty,
  );
  const score = capScoreForEvidence(rawScore, connectivityConfidence.maxScore);

  if (restrictedServiceCount > 0 || restrictionPenalty >= 30) {
    return {
      score,
      assessmentLabel: getCompatibilityAssessmentLabel(score),
      summary: "Regional restriction detected",
      detail:
        "One or more service checks indicate regional or policy restrictions.",
      tone: getScoreTone(score),
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  if (counts.unreachable > 0) {
    return {
      score,
      assessmentLabel: getCompatibilityAssessmentLabel(score),
      summary: "Connectivity failure detected",
      detail: `${counts.unreachable} of ${counts.total} browser probes were unreachable.`,
      tone: getScoreTone(score),
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  if (counts.total === 0) {
    return {
      score,
      assessmentLabel: getCompatibilityAssessmentLabel(score),
      summary: "Connectivity not fully verified",
      detail:
        "No browser connectivity probe data is available for this report.",
      tone: "caution",
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  if (counts.reachable === 0) {
    return {
      score,
      assessmentLabel: getCompatibilityAssessmentLabel(score),
      summary: "Connectivity not fully verified",
      detail:
        "Browser probes ran, but reachability could not be fully confirmed.",
      tone: "caution",
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  if (counts.reachable === counts.total) {
    return {
      score,
      assessmentLabel: getCompatibilityAssessmentLabel(score),
      summary: "Connectivity verified",
      detail: "All tested service probes were reachable.",
      tone: "good",
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  return {
    score,
    assessmentLabel: getCompatibilityAssessmentLabel(score),
    summary: "Most tested services reachable",
    detail: `${counts.reachable} probes were verified reachable and ${counts.notVerified} could not be fully verified by the browser.`,
    tone: score >= 80 ? "good" : "caution",
    confidence: connectivityConfidence.confidence,
    confidenceReason: connectivityConfidence.confidenceReason,
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
    assessmentLabel: evidence.assessmentLabel,
    summary: evidence.summary,
    detail: evidence.detail,
    tone: evidence.tone,
    confidence: evidence.confidence,
    confidenceReason: evidence.confidenceReason,
    confidenceTone: getConfidenceTone(evidence.confidence),
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
    assessmentLabel: summary,
    summary,
    detail: "Run an analysis to calculate this score.",
    tone: "neutral",
    confidence: "Pending",
    confidenceReason: "Run an analysis to estimate confidence.",
    confidenceTone: "neutral",
  };
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function joinReasons(reasons: string[]) {
  if (reasons.length === 0) {
    return "";
  }

  if (reasons.length === 1) {
    return reasons[0];
  }

  return `${reasons.slice(0, -1).join(" ")} ${reasons.at(-1)}`;
}

function buildDataQuality({
  ipInfo,
  ipqs,
  connectivity,
}: Pick<BuildIpQualityReportInput, "ipInfo" | "ipqs" | "connectivity">) {
  const reasons: string[] = [];
  const ipInfoCoverage = getIpInfoCoverage(ipInfo);
  const connectivityConfidence = getConnectivityConfidence(connectivity);

  if (!isIpqsAvailable(ipqs)) {
    reasons.push("IPQS response unavailable.");
  }

  if (ipInfoCoverage === "unavailable") {
    reasons.push("IPInfo response unavailable.");
  } else if (ipInfoCoverage === "partial") {
    reasons.push("IPInfo ownership data is incomplete.");
  }

  if (connectivityConfidence.confidence === "Low") {
    reasons.push("Connectivity probes were unavailable.");
  } else if (connectivityConfidence.confidence === "Medium") {
    reasons.push("Connectivity probes were only partially verified.");
  }

  const level: Exclude<IpQualityConfidence, "Pending"> =
    reasons.length === 0 ? "High" : reasons.length === 1 ? "Medium" : "Low";

  return {
    level,
    tone: getConfidenceTone(level),
    reason:
      reasons.length > 0
        ? joinReasons(reasons)
        : "IPQS, IPInfo, and connectivity probes were available.",
  } satisfies IpQualityReport["dataQuality"];
}

function hasManagedNetworkSignal(dimension: IpQualityScoreDimension) {
  const text = `${dimension.summary} ${dimension.detail}`.toLowerCase();

  return (
    text.includes("datacenter") ||
    text.includes("hosting") ||
    text.includes("infrastructure")
  );
}

function buildOverallAssessment(
  dimensions: IpQualityReport["dimensions"],
  confidence: IpQualityConfidence,
) {
  const reputation = dimensions.reputation;
  const network = dimensions.networkQuality;
  const compatibility = dimensions.compatibility;
  const scores = [reputation.score, network.score, compatibility.score].filter(
    (score): score is number => score !== null,
  );
  const hasHighRisk =
    (reputation.score ?? 100) < 60 ||
    (network.score ?? 100) < 40 ||
    (compatibility.score ?? 100) < 40;
  const hasStrongScores =
    scores.length === 3 && scores.every((score) => score >= 85);

  if (hasHighRisk) {
    return {
      label: "High Risk Signals",
      tone: "risk",
      items: [
        reputation.assessmentLabel,
        network.assessmentLabel,
        compatibility.assessmentLabel,
      ],
    } satisfies IpQualityReport["assessment"];
  }

  if ((reputation.score ?? 0) >= 85 && hasManagedNetworkSignal(network)) {
    return {
      label: "Clean Reputation, Managed Network",
      tone: "infrastructure",
      items: [
        reputation.assessmentLabel,
        network.assessmentLabel,
        compatibility.assessmentLabel,
      ],
    } satisfies IpQualityReport["assessment"];
  }

  if (hasStrongScores && confidence === "High") {
    return {
      label: "High Quality IP",
      tone: "good",
      items: [
        reputation.assessmentLabel,
        network.assessmentLabel,
        compatibility.assessmentLabel,
      ],
    } satisfies IpQualityReport["assessment"];
  }

  return {
    label: "Mixed Signals",
    tone: "caution",
    items: [
      reputation.assessmentLabel,
      network.assessmentLabel,
      compatibility.assessmentLabel,
    ],
  } satisfies IpQualityReport["assessment"];
}

function buildOverallSummary(dimensions: IpQualityReport["dimensions"]) {
  const reputation = dimensions.reputation;
  const network = dimensions.networkQuality;
  const compatibility = dimensions.compatibility;

  if ((reputation.score ?? 0) >= 85 && hasManagedNetworkSignal(network)) {
    return "Reputation signals are clean, but this IP belongs to infrastructure commonly used by hosting providers.";
  }

  if ((reputation.score ?? 0) >= 85 && (network.score ?? 100) < 80) {
    return `Reputation signals are clean, but ${lowerFirst(network.summary)}.`;
  }

  if ((reputation.score ?? 0) >= 85 && (compatibility.score ?? 0) >= 85) {
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
      confidence: "Pending",
      confidenceTone: "neutral",
      dataQuality: {
        level: "Pending",
        tone: "neutral",
        reason: "Run an analysis to evaluate data quality.",
      },
      assessment: {
        label: "Pending",
        tone: "neutral",
        items: [
          dimensions.reputation.assessmentLabel,
          dimensions.networkQuality.assessmentLabel,
          dimensions.compatibility.assessmentLabel,
        ],
      },
      summary:
        "Enter an IP address or analyze your current IP to see IP quality and compatibility.",
      recommendationExplanation:
        "Run an analysis to see the final recommendation.",
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
  const dataQuality = buildDataQuality({
    ipInfo,
    ipqs,
    connectivity,
  });
  const confidence = dataQuality.level;
  const assessment = buildOverallAssessment(dimensions, confidence);

  return {
    overallScore,
    displayValue: formatScore(overallScore),
    confidence,
    confidenceTone: getConfidenceTone(confidence),
    dataQuality,
    assessment,
    summary: buildOverallSummary(dimensions),
    recommendationExplanation: buildOverallSummary(dimensions),
    weights: QUALITY_SCORE_WEIGHTS,
    dimensions,
  };
}
