export type RegionRiskLevel = "low" | "medium" | "high" | "unknown";

export type RegionServiceStatus =
  "likely_available" | "uncertain" | "likely_blocked";

export type RegionRuleHint =
  "available" | "caution" | "restricted" | "high_risk" | "unknown_region";

export type RegionAvailabilityRestriction = "none" | "hard_region";

export type WeightedDecisionSignalDirection =
  "supports_availability" | "raises_risk" | "neutral";

export type WeightedDecisionSignal = {
  signalName: string;
  direction: WeightedDecisionSignalDirection;
  weight: number;
  impact: number;
  contribution: number;
};

export type HistoricalAccessConsistency =
  "stable" | "mixed" | "unstable" | "unavailable";

export type RegionServiceInferenceInput = {
  service: string;
  region?: string | null;
  usageType?: string | null;
  asnType?: string | null;
  ispName?: string | null;
  abuseConfidence?: number | null;
  fraudScore?: number | null;
  recentAbuse?: boolean | null;
  hostingStatus: boolean;
  vpnStatus: boolean;
  proxyStatus: boolean;
  torStatus: boolean;
  relayStatus: boolean;
  cloudflareWarpStatus: boolean;
  cloudflareTraceMatch: boolean;
  cloudflareTraceMismatch: boolean;
  historicalAccessConsistency: HistoricalAccessConsistency;
};

export type RegionServiceInference = {
  status: RegionServiceStatus;
  probability: number;
  score: number;
  riskScore: number;
  ruleHint: RegionRuleHint;
  restriction: RegionAvailabilityRestriction;
  explanation: string;
  signals: WeightedDecisionSignal[];
};

type RegionIpInfo = {
  country?: string | null;
};

type WeightedSignal = {
  signalName: string;
  risk: number;
  weight: number;
};

export const HARD_REGION_RESTRICTION_EXPLANATION =
  "This service may be unavailable from the detected region without a proxy or VPN, regardless of IP reputation.";

const CN_HIGH_RISK_SERVICES = new Set(["google voice"]);

const CN_HARD_BLOCKED_SERVICES = new Set([
  "youtube",
  "google",
  "google account",
  "gmail",
  "google play",
  "google voice",
  "facebook",
  "instagram",
  "x",
]);

const CN_HARD_CAPPED_SERVICES = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "netflix",
  "disney+",
  "prime video",
  "max",
]);

const CN_RESTRICTED_SERVICES = new Set([
  "youtube",
  "google",
  "google account",
  "gmail",
  "google play",
  "google cloud",
  "facebook",
  "instagram",
  "x",
]);

const CN_CAUTION_SERVICES = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "wikipedia",
  "reddit",
]);

const NEUTRAL_RISK = 0.4;

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function hasRegionalBypassSignal(input: RegionServiceInferenceInput) {
  return (
    input.vpnStatus ||
    input.proxyStatus ||
    input.cloudflareWarpStatus ||
    input.torStatus ||
    input.relayStatus
  );
}

export function detectRegionFromIpInfo(ipInfo: RegionIpInfo) {
  const country = normalizeValue(ipInfo.country);

  if (!country) {
    return null;
  }

  if (country === "cn" || country === "chn" || country === "china") {
    return "CN";
  }

  return country.toUpperCase();
}

function getRegionRuleHint(
  service: string,
  region?: string | null,
): RegionRuleHint {
  const normalizedRegion = normalizeValue(region).toUpperCase();
  const normalizedService = normalizeValue(service);

  if (!normalizedRegion) {
    return "unknown_region";
  }

  if (normalizedRegion !== "CN") {
    return "available";
  }

  if (CN_HIGH_RISK_SERVICES.has(normalizedService)) {
    return "high_risk";
  }

  if (CN_RESTRICTED_SERVICES.has(normalizedService)) {
    return "restricted";
  }

  if (CN_CAUTION_SERVICES.has(normalizedService)) {
    return "caution";
  }

  return "available";
}

function getRuleHintRisk(ruleHint: RegionRuleHint) {
  if (ruleHint === "high_risk") {
    return 0.92;
  }

  if (ruleHint === "restricted") {
    return 0.82;
  }

  if (ruleHint === "caution") {
    return 0.55;
  }

  if (ruleHint === "unknown_region") {
    return 0.45;
  }

  return 0.08;
}

function getCountryRestrictionSignal(
  input: RegionServiceInferenceInput,
  ruleHint: RegionRuleHint,
): WeightedSignal {
  const normalizedRegion = normalizeValue(input.region).toUpperCase();
  const hasBypassSignal =
    input.vpnStatus || input.proxyStatus || input.cloudflareWarpStatus;

  if (!normalizedRegion) {
    return {
      signalName: "country_restriction",
      risk: 0.45,
      weight: 0.35,
    };
  }

  if (normalizedRegion === "CN") {
    const hintRisk = getRuleHintRisk(ruleHint);
    const risk =
      hintRisk >= 0.45 && hasBypassSignal
        ? Math.max(hintRisk - 0.18, 0.42)
        : hintRisk;

    return {
      signalName: "country_restriction",
      risk,
      weight: 0.35,
    };
  }

  return {
    signalName: "country_restriction",
    risk: 0.08,
    weight: 0.35,
  };
}

function getAsnSignal(input: RegionServiceInferenceInput): WeightedSignal {
  const normalizedAsnType = normalizeValue(input.asnType);
  const normalizedUsageType = normalizeValue(input.usageType);
  const networkText = `${normalizedAsnType} ${normalizedUsageType}`;

  if (
    input.hostingStatus ||
    includesAny(networkText, [
      "hosting",
      "data center",
      "datacenter",
      "cloud",
      "infrastructure",
      "transit",
    ])
  ) {
    return {
      signalName: "asn_type",
      risk: 0.65,
      weight: 0.15,
    };
  }

  if (networkText.includes("residential")) {
    return {
      signalName: "asn_type",
      risk: 0.12,
      weight: 0.15,
    };
  }

  if (networkText.includes("mobile")) {
    return {
      signalName: "asn_type",
      risk: 0.18,
      weight: 0.15,
    };
  }

  if (networkText.includes("business") || networkText.includes("isp")) {
    return {
      signalName: "asn_type",
      risk: 0.25,
      weight: 0.15,
    };
  }

  return {
    signalName: "asn_type",
    risk: 0.35,
    weight: 0.15,
  };
}

function getIspReputationSignal(
  input: RegionServiceInferenceInput,
): WeightedSignal {
  const abuseRisk =
    input.abuseConfidence === null || input.abuseConfidence === undefined
      ? null
      : clamp(input.abuseConfidence / 100);
  const fraudRisk =
    input.fraudScore === null || input.fraudScore === undefined
      ? null
      : clamp(input.fraudScore / 100);
  const knownRiskValues = [
    abuseRisk,
    fraudRisk,
    input.recentAbuse === true ? 0.75 : null,
  ].filter((value): value is number => value !== null);
  const hasIspName = Boolean(normalizeValue(input.ispName));

  if (knownRiskValues.length === 0) {
    return {
      signalName: "isp_reputation",
      risk: hasIspName ? 0.25 : 0.35,
      weight: 0.15,
    };
  }

  const risk = Math.max(...knownRiskValues);

  if (risk >= 0.6) {
    return {
      signalName: "isp_reputation",
      risk,
      weight: 0.15,
    };
  }

  return {
    signalName: "isp_reputation",
    risk: Math.max(risk, 0.12),
    weight: 0.15,
  };
}

function getProxySignal(input: RegionServiceInferenceInput): WeightedSignal {
  const hasBypassSignal =
    input.vpnStatus || input.proxyStatus || input.cloudflareWarpStatus;
  const normalizedRegion = normalizeValue(input.region).toUpperCase();
  const isRestrictedRegion = normalizedRegion === "CN";

  if (input.torStatus) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.95,
      weight: 0.15,
    };
  }

  if (input.cloudflareTraceMismatch) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.65,
      weight: 0.15,
    };
  }

  if (isRestrictedRegion && hasBypassSignal) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.42,
      weight: 0.15,
    };
  }

  if (isRestrictedRegion && !hasBypassSignal) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.72,
      weight: 0.15,
    };
  }

  if (hasBypassSignal || input.relayStatus) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.55,
      weight: 0.15,
    };
  }

  if (input.cloudflareTraceMatch) {
    return {
      signalName: "proxy_cloudflare",
      risk: 0.12,
      weight: 0.15,
    };
  }

  return {
    signalName: "proxy_cloudflare",
    risk: 0.2,
    weight: 0.15,
  };
}

function getHistoricalConsistencySignal(
  input: RegionServiceInferenceInput,
): WeightedSignal {
  if (input.historicalAccessConsistency === "stable") {
    return {
      signalName: "history_consistency",
      risk: 0.12,
      weight: 0.1,
    };
  }

  if (input.historicalAccessConsistency === "mixed") {
    return {
      signalName: "history_consistency",
      risk: 0.45,
      weight: 0.1,
    };
  }

  if (input.historicalAccessConsistency === "unstable") {
    return {
      signalName: "history_consistency",
      risk: 0.7,
      weight: 0.1,
    };
  }

  return {
    signalName: "history_consistency",
    risk: 0.35,
    weight: 0.1,
  };
}

function getRuleHintSignal(ruleHint: RegionRuleHint): WeightedSignal {
  const risk = getRuleHintRisk(ruleHint);

  if (ruleHint === "unknown_region") {
    return {
      signalName: "rule_hint",
      risk,
      weight: 0.1,
    };
  }

  if (ruleHint === "available") {
    return {
      signalName: "rule_hint",
      risk,
      weight: 0.1,
    };
  }

  return {
    signalName: "rule_hint",
    risk,
    weight: 0.1,
  };
}

function roundSignalValue(value: number) {
  return Number(value.toFixed(4));
}

function getSignalDirection(
  contribution: number,
): WeightedDecisionSignalDirection {
  if (contribution > 0.005) {
    return "supports_availability";
  }

  if (contribution < -0.005) {
    return "raises_risk";
  }

  return "neutral";
}

function toDecisionSignal(signal: WeightedSignal): WeightedDecisionSignal {
  const contribution = roundSignalValue(
    signal.weight * (NEUTRAL_RISK - signal.risk),
  );
  const impact = roundSignalValue(Math.abs(contribution));

  return {
    signalName: signal.signalName,
    direction: getSignalDirection(contribution),
    weight: roundSignalValue(signal.weight),
    impact,
    contribution,
  };
}

function getStructuredSignals(signals: WeightedSignal[]) {
  return signals.map(toDecisionSignal).sort((signalA, signalB) => {
    if (signalB.impact !== signalA.impact) {
      return signalB.impact - signalA.impact;
    }

    return signalA.signalName.localeCompare(signalB.signalName);
  });
}

function getStatusFromProbability(probability: number): RegionServiceStatus {
  if (probability >= 0.66) {
    return "likely_available";
  }

  if (probability >= 0.42) {
    return "uncertain";
  }

  return "likely_blocked";
}

function getHardRegionalRestrictionProbability(service: string): number | null {
  const normalizedService = normalizeValue(service);

  if (normalizedService === "google voice") {
    return 0.05;
  }

  if (CN_HARD_BLOCKED_SERVICES.has(normalizedService)) {
    return 0.08;
  }

  if (CN_HARD_CAPPED_SERVICES.has(normalizedService)) {
    return 0.25;
  }

  return null;
}

function getHardRegionalRestrictionOverride(
  input: RegionServiceInferenceInput,
  ruleHint: RegionRuleHint,
): RegionServiceInference | null {
  const normalizedRegion = normalizeValue(input.region).toUpperCase();

  if (normalizedRegion !== "CN" || hasRegionalBypassSignal(input)) {
    return null;
  }

  const probability = getHardRegionalRestrictionProbability(input.service);

  if (probability === null) {
    return null;
  }

  const riskScore = Number((1 - probability).toFixed(2));
  const signals = [
    {
      signalName: "hard_region_restriction",
      risk: riskScore,
      weight: 0.55,
    },
    {
      signalName: "direct_cn_route",
      risk: 0.9,
      weight: 0.25,
    },
    getRuleHintSignal(ruleHint),
  ];

  return {
    status: "likely_blocked",
    probability,
    score: formatPercent(probability),
    riskScore,
    ruleHint,
    restriction: "hard_region",
    explanation: HARD_REGION_RESTRICTION_EXPLANATION,
    signals: getStructuredSignals(signals),
  };
}

export function inferRegionServiceCompatibility(
  input: RegionServiceInferenceInput,
): RegionServiceInference {
  const ruleHint = getRegionRuleHint(input.service, input.region);
  const hardRestrictionOverride = getHardRegionalRestrictionOverride(
    input,
    ruleHint,
  );

  if (hardRestrictionOverride) {
    return hardRestrictionOverride;
  }

  const signals = [
    getCountryRestrictionSignal(input, ruleHint),
    getAsnSignal(input),
    getIspReputationSignal(input),
    getProxySignal(input),
    getHistoricalConsistencySignal(input),
    getRuleHintSignal(ruleHint),
  ];
  const riskScore = clamp(
    signals.reduce(
      (totalRisk, signal) => totalRisk + signal.risk * signal.weight,
      0,
    ),
  );
  const probability = clamp(1 - riskScore);

  return {
    status: getStatusFromProbability(probability),
    probability: Number(probability.toFixed(2)),
    score: formatPercent(probability),
    riskScore: Number(riskScore.toFixed(2)),
    ruleHint,
    restriction: "none",
    explanation:
      "Regional availability is inferred from weighted regional signals.",
    signals: getStructuredSignals(signals),
  };
}

export function runHardRegionalRestrictionDeterministicChecks() {
  const baseInput = {
    region: "CN",
    usageType: "Residential",
    asnType: "residential",
    ispName: "China ISP",
    abuseConfidence: 0,
    fraudScore: 0,
    recentAbuse: false,
    hostingStatus: false,
    vpnStatus: false,
    proxyStatus: false,
    torStatus: false,
    relayStatus: false,
    cloudflareWarpStatus: false,
    cloudflareTraceMatch: true,
    cloudflareTraceMismatch: false,
    historicalAccessConsistency: "stable" as const,
  };
  const checks = [
    {
      service: "YouTube",
      assert: (result: RegionServiceInference) =>
        result.status !== "likely_available" && result.probability <= 0.25,
      message: "CN direct YouTube must not be likely available.",
    },
    {
      service: "Google Voice",
      assert: (result: RegionServiceInference) =>
        result.status === "likely_blocked" && result.probability <= 0.25,
      message: "CN direct Google Voice must be likely blocked.",
    },
    {
      service: "ChatGPT",
      assert: (result: RegionServiceInference) =>
        result.status !== "likely_available" && result.probability <= 0.25,
      message: "CN direct ChatGPT must not be likely available.",
    },
    {
      service: "Netflix",
      assert: (result: RegionServiceInference) =>
        result.status !== "likely_available" && result.probability <= 0.25,
      message: "CN direct Netflix must not be likely available.",
    },
  ];

  checks.forEach((check) => {
    const result = inferRegionServiceCompatibility({
      ...baseInput,
      service: check.service,
    });

    if (!check.assert(result)) {
      throw new Error(check.message);
    }
  });
}

runHardRegionalRestrictionDeterministicChecks();

export function getRegionRiskLevel(
  serviceRegionScore: number | null | undefined,
): RegionRiskLevel {
  if (serviceRegionScore === null || serviceRegionScore === undefined) {
    return "unknown";
  }

  if (serviceRegionScore >= 0.66) {
    return "low";
  }

  if (serviceRegionScore >= 0.42) {
    return "medium";
  }

  return "high";
}
