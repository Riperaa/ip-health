import type { StatusTone } from "@/lib/status-colors";

import {
  buildConnectivityProbeResult,
  normalizeConnectivityProbeServiceResult,
} from "./connectivity/probe";
import type {
  FinalDecision,
  FinalDecisionCompatible,
  FinalDecisionDisplay,
  FinalDecisionSignal,
  FinalDecisionV1,
  LegacyFinalDecision,
  OverallVerdict,
  PresentationBadge,
  PresentationContract,
  PresentationTextItem,
  RegionAvailabilityVerification,
} from "./types";

export const FINAL_DECISION_VERSION = "1.0" as const;

type FinalDecisionDecision = FinalDecisionV1["decision"];

const DEFAULT_CONNECTIVITY = buildConnectivityProbeResult(
  "not_verified",
) satisfies FinalDecisionDecision["connectivity"];

const CONNECTIVITY_VERIFICATION_EXPLANATION =
  "Browser privacy and CORS restrictions may prevent full verification. When access cannot be strongly verified, IP Health shows Not Verified instead of Available.";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isRegionAvailabilityVerification(
  value: unknown,
): value is RegionAvailabilityVerification {
  return (
    value === "probe_passed" ||
    value === "probe_failed" ||
    value === "not_probed"
  );
}

function isOverallVerdict(value: unknown): value is OverallVerdict {
  return (
    value === "Healthy" ||
    value === "Use with Caution" ||
    value === "Risky"
  );
}

function getOverallVerdict({
  trustScore,
  hasHardRestriction,
  ipqsFraudScore,
}: {
  trustScore: number;
  hasHardRestriction: boolean;
  ipqsFraudScore: number | null;
}): OverallVerdict {
  if (trustScore < 40 || (ipqsFraudScore !== null && ipqsFraudScore >= 90)) {
    return "Risky";
  }

  if (trustScore >= 80 && !hasHardRestriction) {
    return "Healthy";
  }

  return "Use with Caution";
}

function formatFinalDecisionProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

function getFinalDecisionRiskLabel(
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

function getFinalDecisionRiskTone(
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

function getFinalDecisionServiceTone(
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

function getFinalDecisionRegionLabel(
  regionAvailability: FinalDecisionDecision["regionAvailability"],
) {
  if (
    regionAvailability.status === "likely_blocked" ||
    regionAvailability.restriction === "hard_region"
  ) {
    return "Region Restricted";
  }

  if (regionAvailability.verification === "probe_passed") {
    return "Available";
  }

  return "Not Verified";
}

function getFinalDecisionRegionTone(
  regionAvailability: FinalDecisionDecision["regionAvailability"],
): StatusTone {
  if (
    regionAvailability.status !== "likely_blocked" &&
    regionAvailability.restriction !== "hard_region" &&
    regionAvailability.verification === "probe_passed"
  ) {
    return "good";
  }

  if (
    regionAvailability.status === "likely_blocked" ||
    regionAvailability.restriction === "hard_region"
  ) {
    return "risk";
  }

  return "neutral";
}

function formatFinalDecisionSignalName(signalName: string) {
  return signalName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFinalDecisionSignalDirection(
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

function formatFinalDecisionSignal(signal: FinalDecisionSignal) {
  return `${formatFinalDecisionSignalName(signal.signalName)} ${formatFinalDecisionSignalDirection(signal.direction)} (${formatFinalDecisionProbability(signal.impact)} impact)`;
}

function getSignalBadge(signal: FinalDecisionSignal): PresentationBadge {
  if (signal.direction === "supports_availability") {
    return {
      label: "Supports availability",
      tone: "good",
      severity: "positive",
    };
  }

  if (signal.direction === "raises_risk") {
    return {
      label: "Raises risk",
      tone: "caution",
      severity: "warning",
    };
  }

  return {
    label: "Neutral",
    tone: "neutral",
    severity: "neutral",
  };
}

function getRiskBadge(
  riskLevel: FinalDecisionDecision["riskLevel"],
): PresentationBadge {
  return {
    label: getFinalDecisionRiskLabel(riskLevel),
    tone: getFinalDecisionRiskTone(riskLevel),
    severity: riskLevel,
  };
}

function getServiceCompatibilityBadge(
  decision: FinalDecisionDecision,
): PresentationBadge {
  const status = decision.serviceCompatibility.status;

  return {
    label: `${status} (${formatFinalDecisionProbability(decision.serviceCompatibility.probability)})`,
    tone: getFinalDecisionServiceTone(status),
    severity:
      status === "Good"
        ? "positive"
        : status === "Use with Caution"
          ? "warning"
          : "critical",
  };
}

function getRegionAvailabilityBadge(
  decision: FinalDecisionDecision,
): PresentationBadge {
  const regionAvailability = decision.regionAvailability;
  const isVerifiedAvailable =
    regionAvailability.status !== "likely_blocked" &&
    regionAvailability.restriction !== "hard_region" &&
    regionAvailability.verification === "probe_passed";
  const isRestricted =
    regionAvailability.status === "likely_blocked" ||
    regionAvailability.restriction === "hard_region";

  return {
    label: `${getFinalDecisionRegionLabel(regionAvailability)} (${formatFinalDecisionProbability(regionAvailability.probability)})`,
    tone: getFinalDecisionRegionTone(regionAvailability),
    severity: isVerifiedAvailable
      ? "positive"
      : isRestricted
        ? "critical"
        : "neutral",
  };
}

function getSignalItems(
  signals: FinalDecisionSignal[],
): PresentationTextItem[] {
  return signals.map((signal) => ({
    key: signal.signalName,
    label: formatFinalDecisionSignalName(signal.signalName),
    detail: `Weight ${formatFinalDecisionProbability(signal.weight)}, contribution ${formatFinalDecisionProbability(Math.abs(signal.contribution))}.`,
    badge: getSignalBadge(signal),
  }));
}

function getTopSignalItems(
  signals: FinalDecisionSignal[],
): PresentationTextItem[] {
  return signals.slice(0, 3).map((signal) => ({
    key: signal.signalName,
    label: formatFinalDecisionSignal(signal),
    detail: "",
    badge: getSignalBadge(signal),
  }));
}

function getSignalSummaryBadge(
  signals: FinalDecisionSignal[],
): PresentationBadge {
  if (signals.length === 0) {
    return {
      label: "Clear",
      tone: "good",
      severity: "positive",
    };
  }

  return {
    label: `${signals.length} signals`,
    tone: "caution",
    severity: "warning",
  };
}

function assertPresentationValue(value: unknown, path: string) {
  if (typeof value === "function") {
    throw new Error(`PresentationContract contains logic at ${path}.`);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "undefined"
  ) {
    throw new Error(
      `PresentationContract contains non-formatted value at ${path}.`,
    );
  }

  if (typeof value === "string") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertPresentationValue(item, `${path}[${index}]`),
    );
    return;
  }

  if (isObjectRecord(value)) {
    Object.entries(value).forEach(([key, nestedValue]) =>
      assertPresentationValue(nestedValue, `${path}.${key}`),
    );
    return;
  }

  throw new Error(
    `PresentationContract contains unsupported value at ${path}.`,
  );
}

function validatePresentationContract(display: PresentationContract) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  assertPresentationValue(display, "display");
}

export function buildPresentation(
  decision: FinalDecisionDecision,
): FinalDecisionDisplay {
  const regionLabel = getFinalDecisionRegionLabel(decision.regionAvailability);
  const regionExplanation = decision.regionAvailability.explanation;
  const display = {
    trustScoreValue: String(decision.trustScore),
    trustScoreSuffix: "/100",
    riskBadge: getRiskBadge(decision.riskLevel),
    serviceCompatibilityBadge: getServiceCompatibilityBadge(decision),
    regionAvailabilityBadge: getRegionAvailabilityBadge(decision),
    summary: `Service compatibility probability is ${formatFinalDecisionProbability(decision.serviceCompatibility.probability)}. Regional availability is ${regionLabel.toLowerCase()} at ${formatFinalDecisionProbability(decision.regionAvailability.probability)}. ${regionExplanation}`,
    scoreExplanation: {
      title: "Score Explanation",
      intro: `Why this final decision received a ${decision.trustScore}/100 decision score.`,
      items: getTopSignalItems(decision.signals),
      emptyMessage: "Run an analysis to see decision signals.",
    },
    serviceCompatibility: {
      sectionTitle: "Service Compatibility",
      emptyMessage: "No service compatibility data available.",
      footnote: `This uses browser reachability signals first, then IP reputation and regional accessibility. ${CONNECTIVITY_VERIFICATION_EXPLANATION} Services may also consider account history, device reputation, browser fingerprint, and behavior.`,
      topSignalsLabel: "Top signals:",
      topSignalsSummary: getTopSignalItems(decision.signals)
        .map((item) => item.label)
        .join(" "),
    },
    signals: {
      sectionTitle: "Risk Signals",
      summary: "Weighted signals from the canonical final decision.",
      summaryBadge: getSignalSummaryBadge(decision.signals),
      emptyMessage: "No final decision signals are available yet.",
      items: getSignalItems(decision.signals),
    },
  } satisfies FinalDecisionDisplay;

  validatePresentationContract(display);

  return display;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isObjectRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function getPresentationMismatch(
  finalDecision: FinalDecisionV1,
): { expected: FinalDecisionDisplay; actual: FinalDecisionDisplay } | null {
  const expected = buildPresentation(finalDecision.decision);
  const actual = finalDecision.display;

  return stableStringify(expected) === stableStringify(actual)
    ? null
    : { expected, actual };
}

export function assertPresentationMatchesDecision(
  finalDecision: FinalDecisionV1,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const mismatch = getPresentationMismatch(finalDecision);

  if (mismatch) {
    throw new Error(
      "PresentationContract diverged from FinalDecision decision layer.",
    );
  }
}

export function buildPresentationSnapshot(finalDecision: FinalDecision) {
  const normalizedFinalDecision = normalizeFinalDecision(finalDecision);
  const expectedDisplay = buildPresentation(normalizedFinalDecision.decision);
  const actualDisplay = normalizedFinalDecision.display;
  const consistent =
    stableStringify(expectedDisplay) === stableStringify(actualDisplay);

  return {
    version: normalizedFinalDecision.version,
    consistent,
    decision: normalizedFinalDecision.decision,
    expectedDisplay,
    actualDisplay,
    uiOutput: {
      trustScore: actualDisplay.trustScoreValue,
      trustScoreSuffix: actualDisplay.trustScoreSuffix,
      riskBadge: actualDisplay.riskBadge,
      serviceCompatibilityBadge: actualDisplay.serviceCompatibilityBadge,
      regionAvailabilityBadge: actualDisplay.regionAvailabilityBadge,
      summary: actualDisplay.summary,
      scoreExplanation: actualDisplay.scoreExplanation,
      serviceCompatibility: actualDisplay.serviceCompatibility,
      signals: actualDisplay.signals,
    },
  };
}

export function createFinalDecisionV1({
  rawSignals,
  computedMetrics,
  decision,
}: Pick<FinalDecisionV1, "rawSignals" | "computedMetrics" | "decision">) {
  const finalDecision = {
    version: FINAL_DECISION_VERSION,
    rawSignals,
    computedMetrics,
    externalSignals: decision.externalSignals,
    decision,
    display: buildPresentation(decision),
  } satisfies FinalDecisionV1;

  assertPresentationMatchesDecision(finalDecision);

  return finalDecision;
}

function isFinalDecisionV1(value: unknown): value is FinalDecisionV1 {
  return (
    isObjectRecord(value) &&
    value.version === FINAL_DECISION_VERSION &&
    isObjectRecord(value.decision)
  );
}

function hasFinalDecisionExternalSignals(value: FinalDecisionV1) {
  return (
    isObjectRecord(value.externalSignals) &&
    isObjectRecord(value.externalSignals.ipqs)
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

function withRegionAvailabilityDefaults(
  decision: FinalDecisionV1["decision"] | LegacyFinalDecision,
): FinalDecisionV1["decision"] {
  const regionAvailability = decision.regionAvailability;
  const hasRestriction =
    "restriction" in regionAvailability &&
    typeof regionAvailability.restriction === "string";
  const hasExplanation =
    "explanation" in regionAvailability &&
    typeof regionAvailability.explanation === "string";
  const normalizedRegionAvailability = {
    ...regionAvailability,
    restriction: hasRestriction ? regionAvailability.restriction : "none",
    explanation: hasExplanation
      ? regionAvailability.explanation
      : "Regional availability is inferred from weighted regional signals.",
    verification:
      "verification" in regionAvailability &&
      isRegionAvailabilityVerification(regionAvailability.verification)
        ? regionAvailability.verification
        : "not_probed",
  };
  const externalSignals: FinalDecisionV1["decision"]["externalSignals"] =
    "externalSignals" in decision && isObjectRecord(decision.externalSignals)
      ? {
          ipqs: isObjectRecord(decision.externalSignals.ipqs)
            ? (decision.externalSignals
                .ipqs as FinalDecisionV1["decision"]["externalSignals"]["ipqs"])
            : { status: "unavailable" },
        }
      : {
          ipqs: { status: "unavailable" },
        };
  const hasHardRestriction =
    normalizedRegionAvailability.status === "likely_blocked" ||
    normalizedRegionAvailability.restriction === "hard_region";
  const ipqsFraudScore =
    externalSignals.ipqs.status === "available"
      ? externalSignals.ipqs.fraud_score
      : null;
  const overallVerdict =
    "overallVerdict" in decision && isOverallVerdict(decision.overallVerdict)
      ? decision.overallVerdict
      : getOverallVerdict({
          trustScore: decision.trustScore,
          hasHardRestriction,
          ipqsFraudScore,
        });

  return {
    ...decision,
    overallVerdict,
    connectivity:
      "connectivity" in decision && isObjectRecord(decision.connectivity)
        ? {
            google: normalizeConnectivityProbeServiceResult(
              decision.connectivity.google,
            ),
            youtube: normalizeConnectivityProbeServiceResult(
              decision.connectivity.youtube,
            ),
            openai: normalizeConnectivityProbeServiceResult(
              decision.connectivity.openai,
            ),
          }
        : DEFAULT_CONNECTIVITY,
    regionAvailability: normalizedRegionAvailability,
    externalSignals,
  };
}

export function normalizeFinalDecision(
  finalDecision: FinalDecisionCompatible,
): FinalDecision {
  if (isFinalDecisionV1(finalDecision)) {
    const decision = withRegionAvailabilityDefaults(finalDecision.decision);
    const normalizedFinalDecision =
      stableStringify(decision) === stableStringify(finalDecision.decision) &&
      hasFinalDecisionExternalSignals(finalDecision)
        ? finalDecision
        : createFinalDecisionV1({
            rawSignals: finalDecision.rawSignals,
            computedMetrics: finalDecision.computedMetrics,
            decision,
          });

    assertPresentationMatchesDecision(normalizedFinalDecision);
    return normalizedFinalDecision;
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
      decision: withRegionAvailabilityDefaults(finalDecision),
    });
  }

  throw new Error("Unsupported FinalDecision shape.");
}
