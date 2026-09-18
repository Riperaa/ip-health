import {
  isConnectivityProbeReachable,
  isConnectivityProbeUnreachable,
} from "../connectivity/probe";
import type {
  ConnectivityProbeResult,
  FinalDecision,
  ServiceCompatibilityCategory,
  IpQualityConfidence,
} from "../types";
import type {
  BuildIpQualityReportInput,
  ScoreEvidence,
} from "./ip-quality-report";
import { clampScore, getScoreTone, capScoreForEvidence } from "./score-policy";

export function getConnectivityCounts(
  connectivity: ConnectivityProbeResult | null,
) {
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

export function buildCompatibilityScore({
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
