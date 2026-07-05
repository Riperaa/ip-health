import type { StatusTone } from "@/lib/status-colors";

import type {
  FinalDecision,
  FinalDecisionCompatible,
  FinalDecisionDisplay,
  FinalDecisionSignal,
  FinalDecisionV1,
  LegacyFinalDecision,
} from "./types";

export const FINAL_DECISION_VERSION = "1.0" as const;

type FinalDecisionDecision = FinalDecisionV1["decision"];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function formatFinalDecisionProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

export function getFinalDecisionRiskLabel(
  riskLevel: FinalDecisionDecision["riskLevel"],
) {
  if (riskLevel === "low") {
    return "Low Risk";
  }

  if (riskLevel === "medium") {
    return "Medium Risk";
  }

  return "High Risk";
}

export function getFinalDecisionRiskTone(
  riskLevel: FinalDecisionDecision["riskLevel"],
): StatusTone {
  if (riskLevel === "low") {
    return "good";
  }

  if (riskLevel === "medium") {
    return "caution";
  }

  return "risk";
}

export function getFinalDecisionServiceTone(
  status: FinalDecisionDecision["serviceCompatibility"]["status"],
): StatusTone {
  if (status === "Good") {
    return "good";
  }

  if (status === "Use with Caution") {
    return "caution";
  }

  return "risk";
}

export function getFinalDecisionRegionLabel(
  status: FinalDecisionDecision["regionAvailability"]["status"],
) {
  if (status === "likely_available") {
    return "Likely Available";
  }

  if (status === "uncertain") {
    return "Uncertain";
  }

  return "Likely Blocked";
}

export function getFinalDecisionRegionTone(
  status: FinalDecisionDecision["regionAvailability"]["status"],
): StatusTone {
  if (status === "likely_available") {
    return "good";
  }

  if (status === "likely_blocked") {
    return "risk";
  }

  return "caution";
}

export function formatFinalDecisionSignalName(signalName: string) {
  return signalName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatFinalDecisionSignalDirection(
  direction: FinalDecisionSignal["direction"],
) {
  if (direction === "supports_availability") {
    return "supports availability";
  }

  if (direction === "raises_risk") {
    return "raises risk";
  }

  return "neutral";
}

export function formatFinalDecisionSignal(signal: FinalDecisionSignal) {
  return `${formatFinalDecisionSignalName(signal.signalName)} ${formatFinalDecisionSignalDirection(signal.direction)} (${formatFinalDecisionProbability(signal.impact)} impact)`;
}

export function buildFinalDecisionDisplay(
  decision: FinalDecisionDecision,
): FinalDecisionDisplay {
  return {
    trustScoreLabel: String(decision.trustScore),
    riskLabel: getFinalDecisionRiskLabel(decision.riskLevel),
    riskTone: getFinalDecisionRiskTone(decision.riskLevel),
    regionAvailabilityLabel: `${getFinalDecisionRegionLabel(decision.regionAvailability.status)} (${formatFinalDecisionProbability(decision.regionAvailability.probability)})`,
    regionAvailabilityTone: getFinalDecisionRegionTone(
      decision.regionAvailability.status,
    ),
    serviceCompatibilityLabel: `${decision.serviceCompatibility.status} (${formatFinalDecisionProbability(decision.serviceCompatibility.probability)})`,
    serviceCompatibilityTone: getFinalDecisionServiceTone(
      decision.serviceCompatibility.status,
    ),
    summary: `Final service compatibility probability is ${formatFinalDecisionProbability(decision.serviceCompatibility.probability)}. Regional availability is ${getFinalDecisionRegionLabel(decision.regionAvailability.status).toLowerCase()} at ${formatFinalDecisionProbability(decision.regionAvailability.probability)}.`,
    topSignals: decision.signals.slice(0, 3).map(formatFinalDecisionSignal),
  };
}

export function createFinalDecisionV1({
  rawSignals,
  computedMetrics,
  decision,
}: Pick<FinalDecisionV1, "rawSignals" | "computedMetrics" | "decision">) {
  return {
    version: FINAL_DECISION_VERSION,
    rawSignals,
    computedMetrics,
    decision,
    display: buildFinalDecisionDisplay(decision),
  } satisfies FinalDecisionV1;
}

function isFinalDecisionV1(value: unknown): value is FinalDecisionV1 {
  return (
    isObjectRecord(value) &&
    value.version === FINAL_DECISION_VERSION &&
    isObjectRecord(value.decision)
  );
}

function isLegacyFinalDecision(value: unknown): value is LegacyFinalDecision {
  return (
    isObjectRecord(value) &&
    typeof value.ip === "string" &&
    typeof value.trustScore === "number" &&
    isObjectRecord(value.regionAvailability) &&
    isObjectRecord(value.serviceCompatibility) &&
    Array.isArray(value.signals)
  );
}

export function normalizeFinalDecision(
  finalDecision: FinalDecisionCompatible,
): FinalDecision {
  if (isFinalDecisionV1(finalDecision)) {
    return finalDecision;
  }

  if (isLegacyFinalDecision(finalDecision)) {
    return createFinalDecisionV1({
      rawSignals: {
        ip: finalDecision.ip,
        region: null,
        service: "legacy",
        signals: finalDecision.signals,
      },
      computedMetrics: {
        trustScore: finalDecision.trustScore,
        trustProbability: Number((finalDecision.trustScore / 100).toFixed(2)),
        regionAvailabilityProbability:
          finalDecision.regionAvailability.probability,
        serviceCompatibilityProbability:
          finalDecision.serviceCompatibility.probability,
      },
      decision: finalDecision,
    });
  }

  throw new Error("Unsupported FinalDecision shape.");
}
