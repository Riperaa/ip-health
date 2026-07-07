import type { StatusTone } from "@/lib/status-colors";
import type {
  RegionAvailabilityRestriction,
  RegionRiskLevel,
  RegionServiceStatus,
  WeightedDecisionSignal,
} from "@/lib/analysis/region/service-map";
import type {
  Recommendation,
  RecommendationConfidence,
  RecommendationLabel,
  ServiceCompatibilityStatus,
} from "@/lib/trust-engine";
import type {
  ConnectivityProbeResult,
  ConnectivityStatus,
} from "./connectivity/probe";
import type { ProviderResult as AbuseIpDbResponse } from "@/lib/providers/abuseipdb";
import type { ProviderResult as CloudflareTraceResponse } from "@/lib/providers/cloudflare";
import type { ProviderResult as IpInfoResponse } from "@/lib/providers/ipinfo";
import type { ProviderResult as IpqsResponse } from "@/lib/providers/ipqs";

export type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  IpInfoResponse,
  IpqsResponse,
  Recommendation,
  RecommendationConfidence,
  RecommendationLabel,
  ServiceCompatibilityStatus,
};

export type ProviderAnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  ipqs: IpqsResponse | null;
};

export type AnalysisProgressStepId =
  | "detect_ip"
  | "ipinfo"
  | "abuseipdb"
  | "cloudflare"
  | "ipqs"
  | "trust_score"
  | "report";

export type AnalysisProgressStepStatus =
  | "waiting"
  | "running"
  | "completed"
  | "error";

export type AnalysisProgressEvent = {
  step: AnalysisProgressStepId;
  status: Exclude<AnalysisProgressStepStatus, "waiting">;
};

export type AnalysisProgressHandler = (
  event: AnalysisProgressEvent,
) => void;

export type AnalysisProgressOptions = {
  onProgress?: AnalysisProgressHandler;
};

export type RecentCheck = {
  ip: string;
  timestamp: number;
};

export type RiskLevel = "Low" | "Medium" | "High";
export type FinalDecisionRiskLevel = "low" | "medium" | "high";
export type OverallVerdict = "Healthy" | "Use with Caution" | "Risky";
export type RegionAvailabilityVerification =
  "probe_passed" | "probe_failed" | "not_probed";

export type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

export type NetworkIdentityCategory =
  | "Residential ISP"
  | "Mobile Network"
  | "Enterprise Network"
  | "Public Infrastructure"
  | "Cloud Provider"
  | "Datacenter"
  | "VPN / Proxy"
  | "Tor Exit"
  | "Unknown";

export type NetworkIdentityConfidence = "High" | "Medium" | "Low";

export type IpHistoryRecord = {
  ip: string;
  timestamp: number;
  trustScore: number;
  recommendationLabel: RecommendationLabel;
  confidence: RecommendationConfidence;
  abuseConfidence: number | null;
  usageType: string;
  ipType: IpTypeBadge;
};

export type ResultFact = {
  label: string;
  value: string;
};

export type RiskSignal = {
  label: string;
  detail: string;
  tone: StatusTone;
};

export type FinalDecisionSignal = WeightedDecisionSignal;
export type FinalDecisionVersion = "1.0";

export type PresentationBadge = {
  label: string;
  tone: StatusTone;
  severity: string;
};

export type PresentationTextItem = {
  key: string;
  label: string;
  detail: string;
  badge: PresentationBadge;
};

export type PresentationContract = {
  trustScoreValue: string;
  trustScoreSuffix: string;
  riskBadge: PresentationBadge;
  serviceCompatibilityBadge: PresentationBadge;
  regionAvailabilityBadge: PresentationBadge;
  summary: string;
  scoreExplanation: {
    title: string;
    intro: string;
    items: PresentationTextItem[];
    emptyMessage: string;
  };
  serviceCompatibility: {
    sectionTitle: string;
    emptyMessage: string;
    footnote: string;
    topSignalsLabel: string;
    topSignalsSummary: string;
  };
  signals: {
    sectionTitle: string;
    summary: string;
    summaryBadge: PresentationBadge;
    emptyMessage: string;
    items: PresentationTextItem[];
  };
};

export type FinalDecisionDisplay = PresentationContract;

export type IpqsExternalSignal =
  | {
      status: "available";
      fraud_score: number;
      country: string;
      vpn: boolean;
      proxy: boolean;
      tor: boolean;
      bot_status: boolean;
    }
  | {
      status: "unavailable";
      error?: string;
    };

export type FinalDecisionV1 = {
  version: "1.0";
  rawSignals: {
    ip: string;
    region: string | null;
    service: string;
    signals: FinalDecisionSignal[];
  };
  computedMetrics: {
    trustScore: number;
    trustProbability: number;
    regionAvailabilityProbability: number;
    serviceCompatibilityProbability: number;
  };
  externalSignals: {
    ipqs: IpqsExternalSignal;
  };
  decision: {
    ip: string;
    trustScore: number;
    overallVerdict: OverallVerdict;
    riskLevel: FinalDecisionRiskLevel;
    connectivity: ConnectivityProbeResult;
    regionAvailability: {
      status: RegionServiceStatus;
      probability: number;
      restriction: RegionAvailabilityRestriction;
      explanation: string;
      verification: RegionAvailabilityVerification;
    };
    serviceCompatibility: {
      status: ServiceCompatibilityStatus;
      probability: number;
    };
    externalSignals: {
      ipqs: IpqsExternalSignal;
    };
    signals: FinalDecisionSignal[];
  };
  display: FinalDecisionDisplay;
};

export type LegacyFinalDecision = {
  ip: string;
  trustScore: number;
  riskLevel: FinalDecisionRiskLevel;
  regionAvailability: {
    status: RegionServiceStatus;
    probability: number;
  };
  serviceCompatibility: {
    status: ServiceCompatibilityStatus;
    probability: number;
  };
  signals: FinalDecisionSignal[];
};

export type FinalDecision = FinalDecisionV1;
export type FinalDecisionCompatible = FinalDecision | LegacyFinalDecision;

export type ServiceCompatibilityItem = {
  name: string;
  status: ServiceCompatibilityStatus;
  finalAvailability: ServiceAvailabilityStatus;
  probability: number;
  tone: StatusTone;
  reason: string;
  finalDecision: FinalDecision;
};

export type ServiceAvailabilityStatus =
  "Verified" | "Not Verified" | "Restricted";

export type ServiceCompatibilityCategory = {
  category: string;
  summary: string;
  services: ServiceCompatibilityItem[];
};

export type NetworkIntegrityItem = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

export type NetworkIntegrity = {
  label: string;
  tone: StatusTone;
  items: NetworkIntegrityItem[];
  hasCloudflare: boolean;
  unavailableMessage: string;
};

export type IpQualityScoreDimensionKey =
  "reputation" | "networkQuality" | "compatibility";

export type IpQualityConfidence = RecommendationConfidence | "Pending";

export type IpQualityScoreDimension = {
  key: IpQualityScoreDimensionKey;
  label: string;
  icon: string;
  score: number | null;
  displayValue: string;
  assessmentLabel: string;
  summary: string;
  detail: string;
  tone: StatusTone;
  confidence: IpQualityConfidence;
  confidenceReason: string;
  confidenceTone: StatusTone;
};

export type IpQualityDataQuality = {
  level: IpQualityConfidence;
  tone: StatusTone;
  reason: string;
};

export type IpQualityAssessment = {
  label: string;
  tone: StatusTone;
  items: string[];
};

export type IpQualityReport = {
  overallScore: number | null;
  displayValue: string;
  confidence: IpQualityConfidence;
  confidenceTone: StatusTone;
  dataQuality: IpQualityDataQuality;
  assessment: IpQualityAssessment;
  summary: string;
  recommendationExplanation: string;
  weights: Record<IpQualityScoreDimensionKey, number>;
  dimensions: Record<IpQualityScoreDimensionKey, IpQualityScoreDimension>;
};

export type EndUserReport = {
  reputation: {
    status: "Good" | "Fair" | "Poor" | "Pending";
    tone: StatusTone;
    fraudRisk: string;
    abuseSignals: string;
    confidence: RecommendationConfidence | "Pending";
  };
  identity: {
    networkIdentity: NetworkIdentityCategory;
    ipType: NetworkIdentityCategory;
    provider: string;
    identityConfidence: NetworkIdentityConfidence;
    reason: string;
    detail: string;
    tone: StatusTone;
  };
  location: {
    countryCode: string;
    country: string;
    region: string;
    city: string;
    isp: string;
    timezone: string;
  };
  sharingRisk: {
    level: "Low" | "Medium" | "High" | "Unknown";
    tone: StatusTone;
    explanation: string;
  };
};

export type AnalysisResult = {
  ip: {
    address: string;
    facts: ResultFact[];
  };
  trustScore: {
    value: number | null;
    displayValue: string;
    riskLabel: string;
    riskTone: StatusTone;
    recommendationLabel: string;
    recommendationTone: StatusTone;
    summary: string;
    explanationIntro: string;
    explanationItems: string[];
    hasAnalysis: boolean;
  };
  riskSignals: RiskSignal[];
  finalDecision: FinalDecision | null;
  serviceCompatibility: ServiceCompatibilityCategory[];
  connectivity: ConnectivityProbeResult | null;
  regionRiskLevel: RegionRiskLevel;
  ipHistory: IpHistoryRecord[];
  qualityReport: IpQualityReport;
  networkIntegrity: NetworkIntegrity;
  endUserReport: EndUserReport;
};

export type { ConnectivityProbeResult, ConnectivityStatus };

export type ComparisonDisplayResult = {
  input: string;
  ip: string;
  score: number;
  recommendation: Recommendation;
  confidence: RecommendationConfidence;
  networkIdentity: string;
  identityProvider: string;
  usageType: string;
  abuseConfidence: string;
  abuseConfidenceValue: number | null;
  country: string;
  ispOrg: string;
  hasSevereAbuseOrTor: boolean;
  hasInfrastructureSignals: boolean;
};

export type ComparisonVerdict = "IP A" | "IP B" | "Similar risk";

export type IpComparisonResult = {
  ipA: ComparisonDisplayResult;
  ipB: ComparisonDisplayResult;
  verdict: ComparisonVerdict;
  verdictReason: string;
};
