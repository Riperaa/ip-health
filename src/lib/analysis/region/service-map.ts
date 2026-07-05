export type RegionRiskLevel = "low" | "medium" | "high" | "unknown";

export type RegionServiceStatus =
  | "likely_available"
  | "uncertain"
  | "likely_blocked";

export type RegionRuleHint =
  | "available"
  | "caution"
  | "restricted"
  | "high_risk"
  | "unknown_region";

export type HistoricalAccessConsistency =
  | "stable"
  | "mixed"
  | "unstable"
  | "unavailable";

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
  reasoning: string[];
};

type RegionIpInfo = {
  country?: string | null;
};

type WeightedSignal = {
  risk: number;
  weight: number;
  reason: string;
};

const CN_HIGH_RISK_SERVICES = new Set(["google voice"]);

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
      risk: 0.45,
      weight: 0.35,
      reason:
        "Country is missing, so regional availability uses conservative inference.",
    };
  }

  if (normalizedRegion === "CN") {
    const hintRisk = getRuleHintRisk(ruleHint);
    const risk =
      hintRisk >= 0.45 && hasBypassSignal
        ? Math.max(hintRisk - 0.18, 0.42)
        : hintRisk;

    return {
      risk,
      weight: 0.35,
      reason: hasBypassSignal
        ? `${input.service} has elevated regional restriction likelihood in CN, partly offset by VPN, proxy, or WARP signals.`
        : `${input.service} has elevated regional restriction likelihood in CN.`,
    };
  }

  return {
    risk: 0.08,
    weight: 0.35,
    reason: `No strong country-level restriction signal is mapped for ${normalizedRegion}.`,
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
      risk: 0.65,
      weight: 0.15,
      reason:
        "Hosting or data center network type increases service availability checks.",
    };
  }

  if (networkText.includes("residential")) {
    return {
      risk: 0.12,
      weight: 0.15,
      reason: "Residential network type lowers regional availability risk.",
    };
  }

  if (networkText.includes("mobile")) {
    return {
      risk: 0.18,
      weight: 0.15,
      reason: "Mobile network type usually lowers regional availability risk.",
    };
  }

  if (networkText.includes("business") || networkText.includes("isp")) {
    return {
      risk: 0.25,
      weight: 0.15,
      reason: "Business or ISP network type adds only light regional risk.",
    };
  }

  return {
    risk: 0.35,
    weight: 0.15,
    reason: "ASN type is unavailable, adding uncertainty to availability.",
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
      risk: hasIspName ? 0.25 : 0.35,
      weight: 0.15,
      reason: hasIspName
        ? "ISP identity is available, but reputation coverage is limited."
        : "ISP reputation data is limited, adding uncertainty.",
    };
  }

  const risk = Math.max(...knownRiskValues);

  if (risk >= 0.6) {
    return {
      risk,
      weight: 0.15,
      reason:
        "Elevated abuse or fraud reputation increases service availability risk.",
    };
  }

  return {
    risk: Math.max(risk, 0.12),
    weight: 0.15,
    reason: "Abuse and fraud reputation signals are relatively clean.",
  };
}

function getProxySignal(input: RegionServiceInferenceInput): WeightedSignal {
  const hasBypassSignal =
    input.vpnStatus || input.proxyStatus || input.cloudflareWarpStatus;
  const normalizedRegion = normalizeValue(input.region).toUpperCase();
  const isRestrictedRegion = normalizedRegion === "CN";

  if (input.torStatus) {
    return {
      risk: 0.95,
      weight: 0.15,
      reason: "Tor creates high service availability and verification risk.",
    };
  }

  if (input.cloudflareTraceMismatch) {
    return {
      risk: 0.65,
      weight: 0.15,
      reason:
        "Cloudflare trace mismatch suggests inconsistent regional routing.",
    };
  }

  if (isRestrictedRegion && hasBypassSignal) {
    return {
      risk: 0.42,
      weight: 0.15,
      reason:
        "VPN, proxy, or WARP may improve reachability but can still trigger platform checks.",
    };
  }

  if (isRestrictedRegion && !hasBypassSignal) {
    return {
      risk: 0.72,
      weight: 0.15,
      reason:
        "No VPN, proxy, or WARP signal is available for a region with known service restrictions.",
    };
  }

  if (hasBypassSignal || input.relayStatus) {
    return {
      risk: 0.55,
      weight: 0.15,
      reason:
        "VPN, proxy, relay, or WARP signals can affect service availability checks.",
    };
  }

  if (input.cloudflareTraceMatch) {
    return {
      risk: 0.12,
      weight: 0.15,
      reason: "Cloudflare trace is consistent with the IP location.",
    };
  }

  return {
    risk: 0.2,
    weight: 0.15,
    reason: "No proxy or Cloudflare routing instability signal was detected.",
  };
}

function getHistoricalConsistencySignal(
  input: RegionServiceInferenceInput,
): WeightedSignal {
  if (input.historicalAccessConsistency === "stable") {
    return {
      risk: 0.12,
      weight: 0.1,
      reason: "Local history shows stable previous analysis signals.",
    };
  }

  if (input.historicalAccessConsistency === "mixed") {
    return {
      risk: 0.45,
      weight: 0.1,
      reason: "Local history shows mixed previous analysis signals.",
    };
  }

  if (input.historicalAccessConsistency === "unstable") {
    return {
      risk: 0.7,
      weight: 0.1,
      reason: "Local history shows unstable previous analysis signals.",
    };
  }

  return {
    risk: 0.35,
    weight: 0.1,
    reason: "No historical access consistency signal is available.",
  };
}

function getRuleHintSignal(ruleHint: RegionRuleHint): WeightedSignal {
  const risk = getRuleHintRisk(ruleHint);

  if (ruleHint === "unknown_region") {
    return {
      risk,
      weight: 0.1,
      reason:
        "Static rule hint is unknown because no country was detected.",
    };
  }

  if (ruleHint === "available") {
    return {
      risk,
      weight: 0.1,
      reason: "Static service map provides a low-risk hint.",
    };
  }

  return {
    risk,
    weight: 0.1,
    reason: `Static service map provides a ${ruleHint.replace("_", " ")} hint.`,
  };
}

function getTopReasoning(signals: WeightedSignal[]) {
  const topReasons = signals
    .map((signal) => ({
      ...signal,
      impact: signal.weight * Math.abs(signal.risk - NEUTRAL_RISK),
    }))
    .sort((signalA, signalB) => signalB.impact - signalA.impact)
    .slice(0, 3)
    .map((signal) => signal.reason);

  return topReasons.length > 0
    ? topReasons
    : ["No strong regional availability signal was detected."];
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

export function inferRegionServiceCompatibility(
  input: RegionServiceInferenceInput,
): RegionServiceInference {
  const ruleHint = getRegionRuleHint(input.service, input.region);
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
    reasoning: getTopReasoning(signals),
  };
}

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
