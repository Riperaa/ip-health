import {
  buildRecommendationConfidence,
  isInfrastructureUsage,
} from "@/lib/trust-engine";

import {
  formatDetail,
  parseOrg,
  pickDetail,
} from "../normalize/common";
import { buildIpQualityReport } from "../scoring/ip-quality-report";
import { classifyNetworkIdentity } from "../network-identity";
import { buildNetworkSharingRisk } from "../sharing-risk";
import { assertValidIpv4Address } from "../validation";
import type {
  AbuseIpDbResponse,
  ComparisonDisplayResult,
  ComparisonVerdict,
  IpApiIsResponse,
  IpComparisonResult,
  IpInfoResponse,
  IpqsResponse,
  ProviderAnalysisResult,
  Recommendation,
} from "../types";
import { fetchProviderAnalysis } from "./provider-analysis";

type CompareProviderResult = ProviderAnalysisResult & {
  input: string;
};

function formatUsageType(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
) {
  if (formatDetail(usageType) !== "Not identified") {
    return isInfrastructureUsage(usageType)
      ? "Infrastructure"
      : formatDetail(usageType);
  }

  if (privacy?.hosting === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  return "Not identified";
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "No abuse score";
  }

  if (abuseConfidence < 25) {
    return `Low · ${abuseConfidence}%`;
  }

  if (abuseConfidence < 60) {
    return `Elevated · ${abuseConfidence}%`;
  }

  if (abuseConfidence < 85) {
    return `High · ${abuseConfidence}%`;
  }

  return `Severe · ${abuseConfidence}%`;
}

function getAbuseConfidenceValue(abuseIpDb?: AbuseIpDbResponse | null) {
  return abuseIpDb?.abuseConfidence ?? null;
}

function hasTor(
  ipInfo: IpInfoResponse,
  ipqs?: IpqsResponse | null,
  ipApiIs?: IpApiIsResponse | null,
) {
  return (
    ipInfo.privacy?.tor === true ||
    ipqs?.tor === true ||
    ipApiIs?.tor === true
  );
}

function hasSevereAbuseOrTor(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  ipApiIs?: IpApiIsResponse | null,
) {
  return (
    (abuseIpDb?.abuseConfidence ?? 0) >= 85 || hasTor(ipInfo, ipqs, ipApiIs)
  );
}

function hasInfrastructureSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipApiIs?: IpApiIsResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    ipApiIs?.datacenter === true ||
    ipApiIs?.hosting === true
  );
}

function getIspOrg(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const parsedOrg = parseOrg(ipInfo.org);

  return formatDetail(
    pickDetail(
      ipInfo.company?.name,
      abuseIpDb?.isp,
      ipInfo.asn?.name,
      parsedOrg.name,
      ipInfo.org,
    ),
  );
}

function buildScoreRecommendation(score: number): Recommendation {
  if (score >= 70) {
    return {
      label: "Recommended",
      summary: "This IP has a stronger IP Health Score profile.",
    };
  }

  if (score >= 40) {
    return {
      label: "Use with Caution",
      summary: "This IP has moderate IP quality signals.",
    };
  }

  return {
    label: "Not Recommended",
    summary: "This IP has elevated risk signals.",
  };
}

function getDisplayResult(
  result: CompareProviderResult,
): ComparisonDisplayResult {
  const { ipInfo, abuseIpDb, ipqs, scamalytics, ipApiIs, cloudflare } = result;
  const qualityReport = buildIpQualityReport({
    ipInfo,
    abuseIpDb,
    ipqs,
    scamalytics,
    ipApiIs,
    cloudflare,
    connectivity: null,
    finalDecision: null,
    serviceCompatibility: [],
    hasAnalysis: true,
  });
  const score = qualityReport.overallScore ?? 0;
  const identity = classifyNetworkIdentity({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    ipApiIs,
  });
  const sharingRisk = buildNetworkSharingRisk({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    scamalytics,
    ipApiIs,
    identity,
  });

  return {
    input: result.input,
    ip: formatDetail(ipInfo.ip ?? result.input),
    score,
    recommendation: buildScoreRecommendation(score),
    confidence: buildRecommendationConfidence(
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
      scamalytics,
      ipApiIs,
    ),
    networkIdentity: identity.networkIdentity,
    identityProvider: identity.provider,
    sharingRisk,
    usageType: formatUsageType(abuseIpDb?.usageType, ipInfo.privacy),
    abuseConfidence: formatAbuseConfidence(abuseIpDb),
    abuseConfidenceValue: getAbuseConfidenceValue(abuseIpDb),
    country: formatDetail(pickDetail(ipInfo.country_name, ipInfo.country)),
    ispOrg: getIspOrg(ipInfo, abuseIpDb),
    hasSevereAbuseOrTor: hasSevereAbuseOrTor(
      ipInfo,
      abuseIpDb,
      ipqs,
      ipApiIs,
    ),
    hasInfrastructureSignals: hasInfrastructureSignals(
      ipInfo,
      abuseIpDb,
      ipApiIs,
    ),
  };
}

function getVerdict(
  ipA: ComparisonDisplayResult,
  ipB: ComparisonDisplayResult,
): ComparisonVerdict {
  if (ipA.hasSevereAbuseOrTor && !ipB.hasSevereAbuseOrTor) {
    return "IP B";
  }

  if (ipB.hasSevereAbuseOrTor && !ipA.hasSevereAbuseOrTor) {
    return "IP A";
  }

  const scoreDifference = ipA.score - ipB.score;

  if (Math.abs(scoreDifference) < 10) {
    return "Similar risk";
  }

  return scoreDifference > 0 ? "IP A" : "IP B";
}

function getAbuseConfidenceDifference(
  ipA: ComparisonDisplayResult,
  ipB: ComparisonDisplayResult,
) {
  if (
    ipA.abuseConfidenceValue === null ||
    ipB.abuseConfidenceValue === null
  ) {
    return null;
  }

  return ipA.abuseConfidenceValue - ipB.abuseConfidenceValue;
}

function getVerdictReason(
  ipA: ComparisonDisplayResult,
  ipB: ComparisonDisplayResult,
  verdict: ComparisonVerdict,
) {
  const scoreDifference = ipA.score - ipB.score;
  const abuseConfidenceDifference = getAbuseConfidenceDifference(ipA, ipB);

  if (verdict === "Similar risk") {
    return "Both IPs have similar risk levels.";
  }

  const winner = verdict === "IP A" ? ipA : ipB;
  const other = verdict === "IP A" ? ipB : ipA;
  const winnerLabel = verdict;
  const scoreLead = verdict === "IP A" ? scoreDifference : -scoreDifference;
  const abuseLead =
    abuseConfidenceDifference === null
      ? null
      : verdict === "IP A"
        ? -abuseConfidenceDifference
        : abuseConfidenceDifference;

  if (other.hasSevereAbuseOrTor && !winner.hasSevereAbuseOrTor) {
    return `${winnerLabel} avoids stronger abuse or Tor signals on the other IP.`;
  }

  if (other.hasInfrastructureSignals && !winner.hasInfrastructureSignals) {
    return `${winnerLabel} has fewer infrastructure signals and a cleaner usage profile.`;
  }

  if (scoreLead >= 10 && abuseLead !== null && abuseLead >= 10) {
    return `${winnerLabel} has a higher IP Health Score and lower abuse confidence.`;
  }

  if (scoreLead >= 10) {
    return `${winnerLabel} has a higher IP Health Score.`;
  }

  if (abuseLead !== null && abuseLead >= 10) {
    return `${winnerLabel} has lower abuse confidence.`;
  }

  return `${winnerLabel} has the stronger overall comparison signals.`;
}

export async function compareIpAddresses(
  ipA: string,
  ipB: string,
): Promise<IpComparisonResult> {
  const trimmedIpA = ipA.trim();
  const trimmedIpB = ipB.trim();

  if (!trimmedIpA || !trimmedIpB) {
    throw new Error("Enter both IP addresses.");
  }

  assertValidIpv4Address(trimmedIpA);
  assertValidIpv4Address(trimmedIpB);

  const [nextIpA, nextIpB] = await Promise.all([
    fetchProviderAnalysis(trimmedIpA),
    fetchProviderAnalysis(trimmedIpB),
  ]);
  const displayIpA = getDisplayResult({ ...nextIpA, input: trimmedIpA });
  const displayIpB = getDisplayResult({ ...nextIpB, input: trimmedIpB });
  const verdict = getVerdict(displayIpA, displayIpB);

  return {
    ipA: displayIpA,
    ipB: displayIpB,
    verdict,
    verdictReason: getVerdictReason(displayIpA, displayIpB, verdict),
  };
}
