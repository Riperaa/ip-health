import type { StatusTone } from "@/lib/status-colors";

import {
  isConnectivityProbeReachable,
  isConnectivityProbeUnreachable,
} from "../connectivity/probe";
import { classifyNetworkIdentity } from "../network-identity";
import { parseOrg, pickDetail } from "../normalize/common";
import {
  filterPublicSummaryFragments,
  joinEnglishSummaryFragments,
  type SummaryFragment,
} from "../summary-presentation";
import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  ConnectivityProbeResult,
  FinalDecision,
  IpApiIsResponse,
  IpInfoResponse,
  IpqsResponse,
  IpQualityConfidence,
  IpQualityReport,
  IpQualityScoreDimension,
  IpQualityScoreDimensionKey,
  NetworkIdentityCategory,
  ScamalyticsResponse,
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
  scamalytics: ScamalyticsResponse | null;
  ipApiIs: IpApiIsResponse | null;
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

function isConsumerAccessIdentity(category: NetworkIdentityCategory) {
  return category === "Residential ISP" || category === "Mobile Network";
}

function isHostedInfrastructureIdentity(category: NetworkIdentityCategory) {
  return category === "Cloud Provider" || category === "Datacenter";
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

function isScamalyticsAvailable(scamalytics?: ScamalyticsResponse | null) {
  return Boolean(scamalytics && scamalytics.status !== "unavailable");
}

function isIpApiIsAvailable(ipApiIs?: IpApiIsResponse | null) {
  return Boolean(ipApiIs && ipApiIs.status !== "unavailable");
}

function getIpqsFraudScore(ipqs?: IpqsResponse | null) {
  if (ipqs?.status === "unavailable") {
    return null;
  }

  return ipqs?.fraudScore ?? null;
}

function getScamalyticsScore(scamalytics?: ScamalyticsResponse | null) {
  if (scamalytics?.status === "unavailable") {
    return null;
  }

  return scamalytics?.score ?? null;
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

function getScamalyticsPenalty(score: number | null) {
  if (score === null || score <= 0) {
    return 0;
  }

  if (score >= 90) {
    return 60;
  }

  if (score >= 75) {
    return 40;
  }

  if (score >= 50) {
    return 25;
  }

  if (score >= 25) {
    return 12;
  }

  return score >= 10 ? 5 : 0;
}

function getReputationConfidence(
  abuseIpDb: AbuseIpDbResponse | null,
  scamalytics: ScamalyticsResponse | null,
  ipApiIs: IpApiIsResponse | null,
) {
  const hasAbuseIpDb = Boolean(abuseIpDb);
  const hasScamalytics = isScamalyticsAvailable(scamalytics);
  const hasIpApiIs = isIpApiIsAvailable(ipApiIs);
  const hasSecondaryReputation = hasScamalytics || hasIpApiIs;

  if (hasAbuseIpDb && hasSecondaryReputation) {
    return {
      confidence: "High" as const,
      confidenceReason:
        "Abuse history and secondary reputation data were available.",
      maxScore: 100,
    };
  }

  if (hasAbuseIpDb) {
    return {
      confidence: "Medium" as const,
      confidenceReason:
        "Secondary reputation data was unavailable; abuse history was available.",
      maxScore: 85,
    };
  }

  if (!hasSecondaryReputation) {
    return {
      confidence: "Low" as const,
      confidenceReason: "Important reputation providers were unavailable.",
      maxScore: 70,
    };
  }

  return {
    confidence: "Medium" as const,
    confidenceReason: "Abuse history data was unavailable.",
    maxScore: 85,
  };
}

function getReputationAssessmentLabel(
  score: number,
  confidence: Exclude<IpQualityConfidence, "Pending">,
) {
  if (confidence === "Low" && score >= 60) {
    return "Insufficient Evidence";
  }

  if (confidence === "Medium" && score >= 85) {
    return "Clean Signals, Limited Evidence";
  }

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
  scamalytics: ScamalyticsResponse | null,
  ipApiIs: IpApiIsResponse | null,
): ScoreEvidence {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const fraudScore = getIpqsFraudScore(ipqs);
  const scamalyticsScore = getScamalyticsScore(scamalytics);
  const penalties = [
    getAbusePenalty(abuseConfidence),
    getIpqsFraudPenalty(fraudScore),
    getScamalyticsPenalty(scamalyticsScore),
    ipqs?.recentAbuse === true ? 25 : 0,
    ipqs?.bot === true ? 15 : 0,
    scamalytics?.proxy === true ? 20 : 0,
    scamalytics?.vpn === true ? 15 : 0,
    scamalytics?.tor === true ? 30 : 0,
    ipApiIs?.abuser === true ? 12 : 0,
    ipApiIs?.proxy === true ? 8 : 0,
    ipApiIs?.vpn === true ? 6 : 0,
    ipApiIs?.tor === true ? 12 : 0,
  ];
  const providerConfidence = getReputationConfidence(
    abuseIpDb,
    scamalytics,
    ipApiIs,
  );
  const rawScore = clampScore(
    100 - penalties.reduce((total, penalty) => total + penalty, 0),
  );
  const score = capScoreForEvidence(rawScore, providerConfidence.maxScore);
  const hasAbuseSignal = (abuseConfidence ?? 0) > 0;
  const hasFraudSignal = (fraudScore ?? 0) >= 25;
  const hasScamalyticsSignal = (scamalyticsScore ?? 0) >= 25;
  const hasIpApiIsSignal =
    ipApiIs?.abuser === true ||
    ipApiIs?.vpn === true ||
    ipApiIs?.proxy === true ||
    ipApiIs?.tor === true;
  const hasStrongSignal =
    (abuseConfidence ?? 0) >= 60 ||
    (fraudScore ?? 0) >= 80 ||
    (scamalyticsScore ?? 0) >= 75 ||
    ipqs?.recentAbuse === true;
  const assessmentLabel = getReputationAssessmentLabel(
    score,
    providerConfidence.confidence,
  );

  if (providerConfidence.confidence === "Low") {
    return {
      score,
      assessmentLabel,
      summary: "Insufficient reputation evidence",
      detail: providerConfidence.confidenceReason,
      tone: "caution",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasStrongSignal) {
    return {
      score,
      assessmentLabel,
      summary: "High reputation risk detected",
      detail:
        "Abuse history or reputation provider data raised a strong signal.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (
    hasAbuseSignal ||
    hasFraudSignal ||
    hasScamalyticsSignal ||
    hasIpApiIsSignal ||
    ipqs?.bot === true ||
    scamalytics?.proxy === true ||
    scamalytics?.vpn === true ||
    scamalytics?.tor === true
  ) {
    return {
      score,
      assessmentLabel,
      summary: "Some reputation signals found",
      detail: "Provider reputation data shows low to moderate review signals.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (
    ipqs?.status === "unavailable" &&
    !isScamalyticsAvailable(scamalytics) &&
    !isIpApiIsAvailable(ipApiIs)
  ) {
    return {
      score,
      assessmentLabel,
      summary: "Clean reputation signals, limited confidence",
      detail:
        "Clean reputation signals, but confidence is limited because a reputation data source was unavailable.",
      tone: getScoreTone(score),
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  return {
    score,
    assessmentLabel,
    summary: "Clean IP history",
    detail: "No abuse history or high reputation provider risk was reported.",
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
    confidenceReason: "IPInfo network data was unavailable.",
    maxScore: 70,
  };
}

function getNetworkQualityAssessmentLabel(
  score: number,
  confidence: Exclude<IpQualityConfidence, "Pending">,
) {
  if (confidence === "Low" && score >= 60) {
    return "Insufficient Evidence";
  }

  if (confidence === "Medium" && score >= 85) {
    return "Network Signals Limited";
  }

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
  scamalytics,
  ipApiIs,
  cloudflare,
}: Pick<
  BuildIpQualityReportInput,
  "ipInfo" | "abuseIpDb" | "ipqs" | "scamalytics" | "ipApiIs" | "cloudflare"
>): ScoreEvidence {
  const identity = classifyNetworkIdentity({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    ipApiIs,
  });
  const identityCategory = identity.networkIdentity;
  const privacy = ipInfo.privacy;
  const hasTor =
    privacy?.tor === true || ipqs?.tor === true || scamalytics?.tor === true;
  const hasVpn =
    privacy?.vpn === true ||
    ipqs?.vpn === true ||
    ipqs?.activeVpn === true ||
    scamalytics?.vpn === true;
  const hasProxy =
    privacy?.proxy === true ||
    ipqs?.proxy === true ||
    scamalytics?.proxy === true;
  const hasRelay = privacy?.relay === true;
  const hasIpApiReview =
    ipApiIs?.vpn === true ||
    ipApiIs?.proxy === true ||
    ipApiIs?.tor === true ||
    ipApiIs?.datacenter === true ||
    ipApiIs?.hosting === true;
  const hasHosting =
    privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    scamalytics?.server === true ||
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
    hasIpApiReview ? 10 : 0,
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
  const assessmentLabel = getNetworkQualityAssessmentLabel(
    score,
    providerConfidence.confidence,
  );

  if (hasTor) {
    return {
      score,
      assessmentLabel,
      summary: "Tor network detected",
      detail:
        "Tor exit traffic is high risk and is not recommended for account registration, verification, banking, payments, or sensitive login.",
      tone: "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (identityCategory === "Tor Exit") {
    return {
      score,
      assessmentLabel,
      summary: "Tor network detected",
      detail:
        "Tor exit traffic is high risk and is not recommended for account registration, verification, banking, payments, or sensitive login.",
      tone: "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasVpn || hasProxy || hasRelay || isCloudflareWarpOn(cloudflare)) {
    if (identityCategory === "Public Infrastructure") {
      return {
        score,
        assessmentLabel,
        summary: "Public infrastructure review signal",
        detail:
          "A provider applied a VPN or proxy label, but this IP is a known public service endpoint rather than evidence of a personal VPN connection.",
        tone: "infrastructure",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (isConsumerAccessIdentity(identityCategory)) {
      return {
        score,
        assessmentLabel,
        summary: "Minor network review signals",
        detail:
          "Network ownership looks like a normal access network. Some secondary checks may require review, but they do not override the primary residential or mobile classification by themselves.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (identityCategory === "Enterprise Network") {
      return {
        score,
        assessmentLabel,
        summary: "Enterprise network review signals",
        detail:
          "Enterprise networks are often clean, but platforms may apply extra checks because traffic comes from a large organization or shared corporate network.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    return {
      score,
      assessmentLabel,
      summary: "VPN or proxy network detected",
      detail:
        "A strong anonymized, relayed, or shared network path was detected.",
      tone: score >= 60 ? "caution" : "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasHosting) {
    if (isConsumerAccessIdentity(identityCategory)) {
      return {
        score,
        assessmentLabel,
        summary: "Minor network review signals",
        detail:
          "Network ownership looks like a normal access network. Some infrastructure checks may require review, but the primary classification remains residential or mobile.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (identityCategory === "Enterprise Network") {
      return {
        score,
        assessmentLabel,
        summary: "Enterprise network detected",
        detail:
          "Enterprise networks are often clean, but some platforms may apply extra checks because traffic comes from a large organization or shared corporate network.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (identityCategory === "Public Infrastructure") {
      return {
        score,
        assessmentLabel,
        summary: "Public infrastructure detected",
        detail:
          "This is normal for public DNS, CDN, and edge services, but it is not ideal as a personal browsing or account registration IP.",
        tone: "infrastructure",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    return {
      score,
      assessmentLabel,
      summary: "Cloud or hosting infrastructure detected",
      detail:
        "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
      tone: "infrastructure",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasIpApiReview) {
    if (isConsumerAccessIdentity(identityCategory)) {
      return {
        score,
        assessmentLabel,
        summary: "Minor review signal",
        detail:
          "A secondary provider reported a review signal. Some checks may require review, but the primary classification remains a normal access network.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (identityCategory === "Enterprise Network") {
      return {
        score,
        assessmentLabel,
        summary: "Enterprise network review signal",
        detail:
          "A secondary provider reported a review signal. Enterprise traffic can receive extra checks because it comes from a large organization or shared corporate network.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (identityCategory === "Public Infrastructure") {
      return {
        score,
        assessmentLabel,
        summary: "Public infrastructure review signal",
        detail:
          "This is normal for services and edge infrastructure, but not ideal as a personal browsing or account registration IP.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    if (isHostedInfrastructureIdentity(identityCategory)) {
      return {
        score,
        assessmentLabel,
        summary: "Hosted infrastructure review signal",
        detail:
          "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
        tone: score >= 60 ? "caution" : "risk",
        confidence: providerConfidence.confidence,
        confidenceReason: providerConfidence.confidenceReason,
      };
    }

    return {
      score,
      assessmentLabel,
      summary: "Secondary network review signal",
      detail:
        "ipapi.is reported a privacy or infrastructure signal; use it as corroborating evidence.",
      tone: score >= 60 ? "caution" : "risk",
      confidence: providerConfidence.confidence,
      confidenceReason: providerConfidence.confidenceReason,
    };
  }

  if (hasConsumer) {
    return {
      score,
      assessmentLabel,
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
    assessmentLabel,
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

function getCompatibilityAssessmentLabel(
  score: number,
  confidence: Exclude<IpQualityConfidence, "Pending">,
) {
  if (confidence === "Low" && score >= 60) {
    return "Insufficient Evidence";
  }

  if (confidence === "Medium" && score >= 85) {
    return "Compatibility Partially Verified";
  }

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
  const assessmentLabel = getCompatibilityAssessmentLabel(
    score,
    connectivityConfidence.confidence,
  );

  if (restrictedServiceCount > 0 || restrictionPenalty >= 30) {
    return {
      score,
      assessmentLabel,
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
      assessmentLabel,
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
      assessmentLabel,
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
      assessmentLabel,
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
      assessmentLabel,
      summary: "Connectivity verified",
      detail: "All tested service probes were reachable.",
      tone: "good",
      confidence: connectivityConfidence.confidence,
      confidenceReason: connectivityConfidence.confidenceReason,
    };
  }

  return {
    score,
    assessmentLabel,
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
  abuseIpDb,
  scamalytics,
  ipApiIs,
}: Pick<
  BuildIpQualityReportInput,
  "ipInfo" | "abuseIpDb" | "scamalytics" | "ipApiIs"
>) {
  const internalReasons: string[] = [];
  const presentationCandidates: SummaryFragment[] = [];
  const ipInfoCoverage = getIpInfoCoverage(ipInfo);
  const hasSecondaryProvider =
    isScamalyticsAvailable(scamalytics) || isIpApiIsAvailable(ipApiIs);

  if (!isScamalyticsAvailable(scamalytics) && !isIpApiIsAvailable(ipApiIs)) {
    const reason = "Scamalytics and ipapi.is secondary data were unavailable.";
    internalReasons.push(reason);
    presentationCandidates.push({ text: reason });
  }

  if (ipInfoCoverage === "unavailable") {
    const reason = "IPInfo network data was unavailable.";
    internalReasons.push(reason);
    presentationCandidates.push({ text: reason });
  } else if (ipInfoCoverage === "partial") {
    const reason = "IPInfo ownership data was incomplete.";
    internalReasons.push(reason);
    presentationCandidates.push({ text: reason });
  }

  if (!abuseIpDb) {
    const reason = "AbuseIPDB abuse history was unavailable.";
    internalReasons.push(reason);
    presentationCandidates.push({ text: reason });
  }

  const level: Exclude<IpQualityConfidence, "Pending"> =
    internalReasons.length === 0
      ? "High"
      : internalReasons.length === 1 ||
          (Boolean(abuseIpDb) && hasSecondaryProvider)
        ? "Medium"
        : "Low";
  const publicReasons = filterPublicSummaryFragments(
    presentationCandidates,
  ).map(({ text }) => text);
  const publicReason = joinReasons(publicReasons);

  return {
    level,
    tone: getConfidenceTone(level),
    reason:
      level === "High"
        ? "IPInfo, AbuseIPDB, and secondary reputation data were available."
        : publicReasons.length > 0
          ? level === "Medium"
            ? `Some data sources unavailable: ${publicReason}`
            : `Important data sources were unavailable: ${publicReason}`
          : "",
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

  if (confidence === "Low") {
    return {
      label: "Review Needed",
      tone: "caution",
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

  if (hasStrongScores && confidence === "Medium") {
    return {
      label: "Good Quality",
      tone: "good",
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

function buildBaseOverallSummary(
  dimensions: IpQualityReport["dimensions"],
  hasDefinitiveConnectivity: boolean,
) {
  const reputation = dimensions.reputation;
  const network = dimensions.networkQuality;
  const compatibility = dimensions.compatibility;

  if ((reputation.score ?? 0) >= 85 && hasManagedNetworkSignal(network)) {
    return `Reputation signals are clean, but ${lowerFirst(network.summary)}.`;
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

  return joinEnglishSummaryFragments([
    { text: reputation.summary },
    { text: network.summary },
    {
      text: compatibility.summary,
      source: "connectivity-status",
      hasDefinitiveConnectivity,
    },
  ]);
}

function buildOverallSummary(
  dimensions: IpQualityReport["dimensions"],
  dataQuality: IpQualityReport["dataQuality"],
  hasDefinitiveConnectivity = true,
) {
  const baseSummary = buildBaseOverallSummary(
    dimensions,
    hasDefinitiveConnectivity,
  );

  if (
    dataQuality.level === "Low" &&
    dataQuality.reason.startsWith("Important data sources were unavailable:")
  ) {
    return `Insufficient evidence for a high-confidence assessment. ${dataQuality.reason}`;
  }

  if (dataQuality.level !== "High" && dataQuality.reason) {
    return `${baseSummary} ${dataQuality.reason}`;
  }

  return baseSummary;
}

function hasTorSignal({
  ipInfo,
  ipqs,
  scamalytics,
  ipApiIs,
}: Pick<
  BuildIpQualityReportInput,
  "ipInfo" | "ipqs" | "scamalytics" | "ipApiIs"
>) {
  return (
    ipInfo.privacy?.tor === true ||
    ipqs?.tor === true ||
    scamalytics?.tor === true ||
    ipApiIs?.tor === true
  );
}

function buildRecommendationExplanation({
  dimensions,
  dataQuality,
  overallScore,
  ipInfo,
  abuseIpDb,
  ipqs,
  scamalytics,
  ipApiIs,
  cloudflare,
}: Pick<
  BuildIpQualityReportInput,
  "ipInfo" | "abuseIpDb" | "ipqs" | "scamalytics" | "ipApiIs" | "cloudflare"
> & {
  dimensions: IpQualityReport["dimensions"];
  dataQuality: IpQualityReport["dataQuality"];
  overallScore: number;
}) {
  const identity = classifyNetworkIdentity({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    ipApiIs,
  });
  const category = identity.networkIdentity;
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const hasCleanReputation =
    (dimensions.reputation.score ?? 0) >= 80 && overallScore >= 70;

  if (
    category === "Tor Exit" ||
    hasTorSignal({ ipInfo, ipqs, scamalytics, ipApiIs })
  ) {
    return "High risk: Tor exit traffic is not recommended for account registration, verification, banking, payments, or sensitive login.";
  }

  if (abuseConfidence !== null && abuseConfidence >= 85) {
    return "High risk: severe abuse history was reported, so this IP is not recommended for account registration, verification, banking, payments, or sensitive login.";
  }

  if (isHostedInfrastructureIdentity(category)) {
    return "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic. Use extra caution for account registration, verification, banking, payments, and sensitive login.";
  }

  if (category === "Public Infrastructure") {
    return "This is normal for public DNS, CDN, and edge infrastructure, but it is not ideal as a personal browsing or account registration IP.";
  }

  if (isConsumerAccessIdentity(category)) {
    if (hasCleanReputation) {
      return "This looks suitable for normal browsing and account use when reputation is clean. Minor review signals may still trigger extra checks on stricter platforms.";
    }

    return "This appears to be a normal access network, but some checks may require review based on the available reputation or provider signals.";
  }

  if (category === "Enterprise Network") {
    return "Enterprise networks are often clean, but some platforms may apply extra checks because traffic comes from a large organization or shared corporate network.";
  }

  if (category === "VPN / Proxy") {
    return "Strong privacy or relay signals are present, so this IP may face extra verification or restrictions for accounts, payments, banking, and sensitive login.";
  }

  return buildOverallSummary(dimensions, dataQuality);
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
  scamalytics,
  ipApiIs,
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
      buildReputationScore(abuseIpDb, ipqs, scamalytics, ipApiIs),
    ),
    networkQuality: buildDimension(
      "networkQuality",
      "Network Quality",
      "Globe",
      buildNetworkQualityScore({
        ipInfo,
        abuseIpDb,
        ipqs,
        scamalytics,
        ipApiIs,
        cloudflare,
      }),
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
    abuseIpDb,
    scamalytics,
    ipApiIs,
  });
  const confidence = dataQuality.level;
  const assessment = buildOverallAssessment(dimensions, confidence);
  const connectivityCounts = getConnectivityCounts(connectivity);
  const hasDefinitiveConnectivity =
    connectivityCounts.reachable > 0 || connectivityCounts.unreachable > 0;

  return {
    overallScore,
    displayValue: formatScore(overallScore),
    confidence,
    confidenceTone: getConfidenceTone(confidence),
    dataQuality,
    assessment,
    summary: buildOverallSummary(
      dimensions,
      dataQuality,
      hasDefinitiveConnectivity,
    ),
    recommendationExplanation: buildRecommendationExplanation({
      dimensions,
      dataQuality,
      overallScore,
      ipInfo,
      abuseIpDb,
      ipqs,
      scamalytics,
      ipApiIs,
      cloudflare,
    }),
    weights: QUALITY_SCORE_WEIGHTS,
    dimensions,
  };
}
