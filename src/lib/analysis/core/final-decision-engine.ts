export type FinalDecisionService = "google" | "youtube" | "openai";

export type FinalDecisionServiceStatus =
  "Available" | "Restricted" | "Unavailable";

export type FinalDecisionConnectivitySignals = Record<
  FinalDecisionService,
  boolean
>;

export type FinalDecisionIpqsSignals = {
  fraud_score?: number | null;
};

export type FinalDecisionIpInfoSignals = {
  asn?: string | number | null;
  country?: string | null;
  hosting?: boolean | null;
};

export type FinalDecisionRegionSignals = {
  restricted?: boolean | null;
  confidence?: number | null;
};

export type FinalDecisionEngineInput = {
  connectivity: FinalDecisionConnectivitySignals;
  ipqs?: FinalDecisionIpqsSignals | null;
  ipinfo?: FinalDecisionIpInfoSignals | null;
  region?: FinalDecisionRegionSignals | null;
};

export type FinalDecisionTrustSignals = {
  ipqs?: FinalDecisionIpqsSignals | null;
  ipinfo?: FinalDecisionIpInfoSignals | null;
};

export type FinalDecisionServiceResult = {
  status: FinalDecisionServiceStatus;
  trustScore: number;
  confidence: number;
  explanation: string[];
};

export type FinalDecisionEngineOutput = Record<
  FinalDecisionService,
  FinalDecisionServiceResult
>;

const SERVICES = ["google", "youtube", "openai"] as const;

const MAX_SCORE = 100;
const MIN_SCORE = 0;
const IPQS_HIGH_RISK_THRESHOLD = 80;
const IPQS_RESTRICTED_THRESHOLD = 90;
const IPQS_HIGH_RISK_PENALTY = 45;
const IPQS_RESTRICTED_PENALTY = 65;
const HOSTING_PENALTY = 8;
const RESTRICTED_TRUST_SCORE_THRESHOLD = 40;
const REGION_RESTRICTION_CONFIDENCE_PENALTY = 20;
const REGION_CONFIDENCE_PENALTY_FACTOR = 0.3;

function clampScore(score: number) {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeFraudScore(fraudScore?: number | null) {
  if (!isFiniteNumber(fraudScore)) {
    return null;
  }

  return clampScore(fraudScore);
}

function normalizeConfidence(confidence?: number | null) {
  if (!isFiniteNumber(confidence)) {
    return null;
  }

  return clampScore(confidence);
}

function hasAsn(asn?: string | number | null) {
  if (typeof asn === "number") {
    return Number.isFinite(asn);
  }

  return Boolean(asn?.trim());
}

export function computeTrustScore(signals: FinalDecisionTrustSignals) {
  const fraudScore = normalizeFraudScore(signals.ipqs?.fraud_score);
  const penalties = [
    fraudScore !== null && fraudScore > IPQS_RESTRICTED_THRESHOLD
      ? IPQS_RESTRICTED_PENALTY
      : 0,
    fraudScore !== null &&
    fraudScore > IPQS_HIGH_RISK_THRESHOLD &&
    fraudScore <= IPQS_RESTRICTED_THRESHOLD
      ? IPQS_HIGH_RISK_PENALTY
      : 0,
    signals.ipinfo?.hosting === true ? HOSTING_PENALTY : 0,
  ];

  return clampScore(
    MAX_SCORE - penalties.reduce((total, penalty) => total + penalty, 0),
  );
}

export function decideServiceStatus(
  connectivity: boolean,
  trustScore: number,
  region?: FinalDecisionRegionSignals | null,
): FinalDecisionServiceStatus {
  if (connectivity === false) {
    return "Unavailable";
  }

  if (trustScore <= RESTRICTED_TRUST_SCORE_THRESHOLD) {
    return "Restricted";
  }

  if (region?.restricted === true) {
    return "Available";
  }

  return "Available";
}

function computeDecisionConfidence(region?: FinalDecisionRegionSignals | null) {
  if (region?.restricted !== true) {
    return MAX_SCORE;
  }

  const regionConfidence = normalizeConfidence(region.confidence);
  const penalty =
    regionConfidence === null
      ? REGION_RESTRICTION_CONFIDENCE_PENALTY
      : Math.round(regionConfidence * REGION_CONFIDENCE_PENALTY_FACTOR);

  return clampScore(MAX_SCORE - penalty);
}

function buildBaseExplanation(
  input: FinalDecisionEngineInput,
  trustScore: number,
  confidence: number,
) {
  const explanation: string[] = [];
  const fraudScore = normalizeFraudScore(input.ipqs?.fraud_score);

  if (fraudScore !== null && fraudScore > IPQS_RESTRICTED_THRESHOLD) {
    explanation.push(
      `IPQS fraud_score ${fraudScore} is above 90, so trustScore is significantly reduced and connected services are restricted.`,
    );
  } else if (fraudScore !== null && fraudScore > IPQS_HIGH_RISK_THRESHOLD) {
    explanation.push(
      `IPQS fraud_score ${fraudScore} is above 80, so trustScore is significantly reduced.`,
    );
  } else if (fraudScore !== null) {
    explanation.push(
      `IPQS fraud_score ${fraudScore} does not trigger a high-risk reputation rule.`,
    );
  }

  if (input.region?.restricted === true) {
    explanation.push(
      "Region restriction signal lowers confidence only and does not override connectivity.",
    );
  }

  if (input.ipinfo?.hosting === true) {
    explanation.push(
      "IPInfo hosting classification applies a minor trustScore adjustment.",
    );
  }

  if (hasAsn(input.ipinfo?.asn)) {
    explanation.push(
      `IPInfo ASN ${String(input.ipinfo?.asn)} is informational and does not override connectivity.`,
    );
  }

  explanation.push(`Final trustScore is ${trustScore}.`);
  explanation.push(`Decision confidence is ${confidence}.`);

  return explanation;
}

function buildServiceExplanation(
  service: FinalDecisionService,
  connectivity: boolean,
  status: FinalDecisionServiceStatus,
  baseExplanation: string[],
) {
  const explanation = [...baseExplanation];

  if (connectivity === false) {
    explanation.unshift(
      `${service} connectivity is false, so status is Unavailable by hard-block rule.`,
    );
    return explanation;
  }

  explanation.unshift(
    `${service} connectivity is true, so connectivity permits an availability decision.`,
  );

  if (status === "Restricted") {
    explanation.push(
      `${service} remains connected, but trustScore requires Restricted status.`,
    );
  } else {
    explanation.push(
      `${service} status is Available because connectivity is true.`,
    );
  }

  return explanation;
}

export function runFinalDecisionEngine(
  input: FinalDecisionEngineInput,
): FinalDecisionEngineOutput {
  const trustScore = computeTrustScore({
    ipqs: input.ipqs,
    ipinfo: input.ipinfo,
  });
  const confidence = computeDecisionConfidence(input.region);
  const baseExplanation = buildBaseExplanation(input, trustScore, confidence);

  return SERVICES.reduce<FinalDecisionEngineOutput>((decisions, service) => {
    const connectivity = input.connectivity[service];
    const status = decideServiceStatus(connectivity, trustScore, input.region);

    decisions[service] = {
      status,
      trustScore,
      confidence,
      explanation: buildServiceExplanation(
        service,
        connectivity,
        status,
        baseExplanation,
      ),
    };

    return decisions;
  }, {} as FinalDecisionEngineOutput);
}
