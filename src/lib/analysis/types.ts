import type { StatusTone } from "@/lib/status-colors";
import type {
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

export type RecentCheck = {
  ip: string;
  timestamp: number;
};

export type RiskLevel = "Low" | "Medium" | "High";
export type FinalDecisionRiskLevel = "low" | "medium" | "high";

export type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

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
  decision: {
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
  probability: number;
  tone: StatusTone;
  reason: string;
  finalDecision: FinalDecision;
};

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
  regionRiskLevel: RegionRiskLevel;
  ipHistory: IpHistoryRecord[];
  networkIntegrity: NetworkIntegrity;
};

export type ComparisonDisplayResult = {
  input: string;
  ip: string;
  score: number;
  recommendation: Recommendation;
  confidence: RecommendationConfidence;
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
