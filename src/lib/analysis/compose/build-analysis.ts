import {
  buildRecommendationConfidence,
  buildServiceCompatibilitySignals,
  hasCloudflareColoSignal,
  hasCloudflareTraceMatch,
  hasCloudflareTraceMismatch,
  isCloudflareWarpOn,
  isInfrastructureUsage,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  getServiceCompatibilityTone,
  type StatusTone,
} from "@/lib/status-colors";

import {
  createFinalDecisionV1,
  normalizeFinalDecision,
} from "../final-decision";
import {
  buildConnectivityProbeResult,
  isConnectivityProbeReachable,
  isConnectivityProbeUnreachable,
  probeConnectivity,
  type ConnectivityProbeResult,
} from "../connectivity/probe";
import {
  formatDetail,
  hasDetail,
  isObjectRecord,
  parseOrg,
  pickDetail,
} from "../normalize/common";
import { normalizeProviderAnalysisResult } from "../normalize/providers";
import {
  detectRegionFromIpInfo,
  getRegionRiskLevel,
  inferRegionServiceCompatibility,
  type HistoricalAccessConsistency,
  type RegionServiceInferenceInput,
  type WeightedDecisionSignal,
} from "../region/service-map";
import {
  getHistoryForIp,
  getNextIpHistory,
  loadIpHistory,
  normalizeIpHistory,
  persistIpHistory,
} from "../normalize/storage";
import { classifyNetworkIdentity } from "../network-identity";
import { buildIpQualityReport } from "../scoring/ip-quality-report";
import { buildNetworkSharingRisk } from "../sharing-risk";
import { calculateTrustScore } from "../scoring/trust-score";
import { assertValidIpv4Address } from "../validation";
import type {
  AbuseIpDbResponse,
  AnalysisProgressOptions,
  AnalysisResult,
  CloudflareTraceResponse,
  EndUserReport,
  FinalDecision,
  FinalDecisionRiskLevel,
  FinalDecisionSignal,
  IpApiIsExternalSignal,
  IpApiIsResponse,
  IpqsExternalSignal,
  IpHistoryRecord,
  IpInfoResponse,
  IpqsResponse,
  IpQualityReport,
  IpTypeBadge,
  NetworkIntegrity,
  NetworkIdentityCategory,
  OverallVerdict,
  ProviderAnalysisResult,
  ResultFact,
  RiskSignal,
  RegionAvailabilityVerification,
  ScamalyticsExternalSignal,
  ScamalyticsResponse,
  ServiceAvailabilityStatus,
  ServiceCompatibilityStatus,
} from "../types";
import { fetchProviderAnalysis } from "./provider-analysis";

type IntegrityStatus = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type IpInfoPresentationFields = IpInfoResponse & {
  timezone?: string | null;
};

function isDataCenterHostingTransitUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase().replace(/\s+/g, "") ?? "";

  return normalized.includes("datacenter/webhosting/transit");
}

function formatUsageType(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
) {
  if (hasDetail(usageType)) {
    if (isDataCenterHostingTransitUsage(usageType)) {
      return "Infrastructure";
    }

    return formatDetail(usageType);
  }

  if (privacy?.hosting === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  return "Not identified";
}

function getIpTypeBadge(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
): IpTypeBadge {
  const normalized = usageType?.toLowerCase() ?? "";

  if (isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  if (normalized.includes("residential")) {
    return "Residential";
  }

  if (normalized.includes("mobile")) {
    return "Mobile";
  }

  if (normalized.includes("business")) {
    return "Business";
  }

  if (privacy?.hosting === true) {
    return "Infrastructure";
  }

  return "Unknown";
}

function getNetworkIdentity(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const parsedOrg = parseOrg(ipInfo.org);
  const asn = pickDetail(ipInfo.asn?.asn, parsedOrg.asn);
  const isp = pickDetail(
    ipInfo.company?.name,
    abuseIpDb?.isp,
    ipInfo.asn?.name,
    parsedOrg.name,
    ipInfo.org,
  );

  return {
    asn: formatDetail(asn),
    isp: formatDetail(isp),
  };
}

function isConsumerAccessIdentity(category: NetworkIdentityCategory) {
  return category === "Residential ISP" || category === "Mobile Network";
}

function isHostedInfrastructureIdentity(category: NetworkIdentityCategory) {
  return category === "Cloud Provider" || category === "Datacenter";
}

function formatLocation(ipInfo: IpInfoResponse) {
  const city = formatDetail(ipInfo.city);
  const country = formatDetail(pickDetail(ipInfo.country_name, ipInfo.country));
  const locationParts = [city, country].filter((value) => hasDetail(value));

  return locationParts.length > 0 ? locationParts.join(", ") : "Not identified";
}

function getReputationStatus(
  finalDecision: FinalDecision | null,
): EndUserReport["reputation"] {
  const verdict = finalDecision?.decision.overallVerdict;

  if (verdict === "Healthy") {
    return {
      status: "Good",
      tone: "good",
      fraudRisk: "",
      abuseSignals: "",
      confidence: "Pending",
    };
  }

  if (verdict === "Use with Caution") {
    return {
      status: "Fair",
      tone: "caution",
      fraudRisk: "",
      abuseSignals: "",
      confidence: "Pending",
    };
  }

  if (verdict === "Risky") {
    return {
      status: "Poor",
      tone: "risk",
      fraudRisk: "",
      abuseSignals: "",
      confidence: "Pending",
    };
  }

  return {
    status: "Pending",
    tone: "neutral",
    fraudRisk: "",
    abuseSignals: "",
    confidence: "Pending",
  };
}

function formatFraudRisk(ipqs?: IpqsResponse | null) {
  const fraudScore = getIpqsFraudScore(ipqs);

  if (ipqs?.status === "unavailable") {
    return "Unavailable";
  }

  if (fraudScore === null) {
    return "Not reported";
  }

  if (fraudScore < 25) {
    return `Low (${fraudScore}/100)`;
  }

  if (fraudScore < 60) {
    return `Moderate (${fraudScore}/100)`;
  }

  if (fraudScore < IPQS_STRONG_RISK_FRAUD_SCORE) {
    return `Elevated (${fraudScore}/100)`;
  }

  return `High (${fraudScore}/100)`;
}

function formatAbuseSignals(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "Not reported";
  }

  if (abuseConfidence === 0) {
    return "None detected";
  }

  if (abuseConfidence < 25) {
    return `Low (${abuseConfidence}%)`;
  }

  if (abuseConfidence < 60) {
    return `Moderate (${abuseConfidence}%)`;
  }

  if (abuseConfidence < 85) {
    return `High (${abuseConfidence}%)`;
  }

  return `Severe (${abuseConfidence}%)`;
}

function buildEndUserReport({
  ipInfo,
  abuseIpDb,
  ipqs,
  scamalytics,
  ipApiIs,
  cloudflare,
  finalDecision,
  hasAnalysis,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  scamalytics: ScamalyticsResponse | null;
  ipApiIs: IpApiIsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  finalDecision: FinalDecision | null;
  hasAnalysis: boolean;
}): EndUserReport {
  const reputation = getReputationStatus(finalDecision);
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const ipInfoPresentation = ipInfo as IpInfoPresentationFields;
  const identity = hasAnalysis
    ? classifyNetworkIdentity({ ipInfo, abuseIpDb, ipqs, cloudflare, ipApiIs })
    : ({
        networkIdentity: "Unknown",
        ipType: "Unknown",
        provider: "Not identified",
        identityConfidence: "Low",
        reason: "Run an analysis to identify network ownership.",
        detail: "Run an analysis to identify the network identity.",
        tone: "neutral" satisfies StatusTone,
      } satisfies EndUserReport["identity"]);

  return {
    reputation: {
      ...reputation,
      fraudRisk: hasAnalysis ? formatFraudRisk(ipqs) : "Pending",
      abuseSignals: hasAnalysis ? formatAbuseSignals(abuseIpDb) : "Pending",
      confidence: hasAnalysis
        ? buildRecommendationConfidence(
            ipInfo,
            abuseIpDb,
            ipqs,
            cloudflare,
            scamalytics,
            ipApiIs,
          )
        : "Pending",
    },
    identity,
    location: {
      countryCode: formatDetail(ipInfo.country),
      country: formatDetail(pickDetail(ipInfo.country_name, ipInfo.country)),
      region: formatDetail(ipInfo.region),
      city: formatDetail(ipInfo.city),
      isp: networkIdentity.isp,
      timezone: formatDetail(ipInfoPresentation.timezone),
    },
    sharingRisk: hasAnalysis
      ? buildNetworkSharingRisk({
          ipInfo,
          abuseIpDb,
          ipqs,
          cloudflare,
          scamalytics,
          ipApiIs,
          identity,
        })
      : {
          level: "Unknown",
          label: "Unknown",
          tone: "neutral" satisfies StatusTone,
          explanation: "Run an analysis to estimate network sharing risk.",
          reason: "Run an analysis to estimate network sharing risk.",
          evidence: ["Analysis not run"],
        },
  };
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "No abuse score";
  }

  if (abuseConfidence < 25) {
    return `Low, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 60) {
    return `Elevated, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 85) {
    return `High, ${abuseConfidence}%`;
  }

  return `Severe, ${abuseConfidence}%`;
}

function getAbuseIpDbHostname(abuseIpDb?: AbuseIpDbResponse | null) {
  const raw = abuseIpDb?.raw;

  if (!isObjectRecord(raw)) {
    return null;
  }

  const data = raw.data;

  if (!isObjectRecord(data)) {
    return null;
  }

  const hostnames = data.hostnames;

  if (!Array.isArray(hostnames)) {
    return null;
  }

  return typeof hostnames[0] === "string" ? hostnames[0] : null;
}

function getReverseDns(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return pickDetail(getAbuseIpDbHostname(abuseIpDb), ipInfo.hostname);
}

function getPrivacySignals(ipInfo: IpInfoResponse) {
  const privacy = ipInfo.privacy;

  return [
    privacy?.vpn === true ? "VPN" : null,
    privacy?.proxy === true ? "proxy" : null,
    privacy?.tor === true ? "Tor" : null,
    privacy?.relay === true ? "relay" : null,
  ].filter((signal): signal is string => Boolean(signal));
}

function hasNativeInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType)
  );
}

function hasInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return (
    hasNativeInfrastructureSignal(ipInfo, abuseIpDb) ||
    hasCloudflareColoSignal(ipInfo, cloudflare)
  );
}

function formatSignalList(signals: string[]) {
  if (signals.length === 0) {
    return "";
  }

  if (signals.length === 1) {
    return signals[0];
  }

  return `${signals.slice(0, -1).join(", ")} and ${signals.at(-1)}`;
}

function getScoreExplanationItems(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
  scamalytics: ScamalyticsResponse | null,
  ipApiIs: IpApiIsResponse | null,
  cloudflare: CloudflareTraceResponse | null,
  qualityReport: IpQualityReport,
) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const privacySignals = getPrivacySignals(ipInfo);
  const hasInfrastructure = hasInfrastructureSignal(
    ipInfo,
    abuseIpDb,
    cloudflare,
  );
  const usageType = formatUsageType(abuseIpDb?.usageType, ipInfo.privacy);
  const ownership = getNetworkIdentity(ipInfo, abuseIpDb);
  const identity = classifyNetworkIdentity({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    ipApiIs,
  });
  const identityCategory = identity.networkIdentity;
  const reverseDns = getReverseDns(ipInfo, abuseIpDb);
  const items = [
    `Overall score blends Reputation (${Math.round(
      qualityReport.weights.reputation * 100,
    )}%), Network Quality (${Math.round(
      qualityReport.weights.networkQuality * 100,
    )}%), and Compatibility (${Math.round(
      qualityReport.weights.compatibility * 100,
    )}%).`,
    `Confidence is ${qualityReport.confidence}. Evidence quality is ${qualityReport.dataQuality.level}: ${qualityReport.dataQuality.reason}`,
    `${qualityReport.dimensions.reputation.label}: ${qualityReport.dimensions.reputation.summary}.`,
    `${qualityReport.dimensions.networkQuality.label}: ${qualityReport.dimensions.networkQuality.summary}.`,
    `${qualityReport.dimensions.compatibility.label}: ${qualityReport.dimensions.compatibility.summary}.`,
  ];

  if (abuseConfidence === null) {
    items.push("No abuse database score was returned for this IP.");
  } else if (abuseConfidence === 0) {
    items.push("IP not found in recent abuse reports.");
  } else if (abuseConfidence < 25) {
    items.push(`Abuse history is low at ${abuseConfidence}% confidence.`);
  } else if (abuseConfidence < 60) {
    items.push(`Abuse history is elevated at ${abuseConfidence}% confidence.`);
  } else {
    items.push(`Abuse history is high at ${abuseConfidence}% confidence.`);
  }

  if (ipqs?.status === "unavailable") {
    items.push(
      "IPQS reputation data is unavailable, so analysis continued without it.",
    );
  } else if (ipqs?.fraudScore !== null && ipqs?.fraudScore !== undefined) {
    items.push(`IPQS fraud score is ${ipqs.fraudScore}/100.`);
  }

  if (scamalytics?.status === "unavailable") {
    items.push(
      "Scamalytics reputation data is unavailable, so analysis continued without it.",
    );
  } else if (scamalytics?.score !== null && scamalytics?.score !== undefined) {
    items.push(`Scamalytics risk score is ${scamalytics.score}/100.`);
  }

  if (ipApiIs?.status === "unavailable") {
    items.push(
      "ipapi.is data is unavailable, so analysis continued without it.",
    );
  } else if (ipApiIs?.vpn || ipApiIs?.proxy || ipApiIs?.tor) {
    if (identityCategory === "Tor Exit") {
      items.push("ipapi.is reported a Tor exit signal.");
    } else if (isConsumerAccessIdentity(identityCategory)) {
      items.push(
        "ipapi.is reported a secondary review signal; the primary classification remains a normal access network.",
      );
    } else if (identityCategory === "Enterprise Network") {
      items.push(
        "ipapi.is reported a secondary review signal; enterprise traffic can still receive extra checks on some platforms.",
      );
    } else {
      items.push("ipapi.is reported VPN, proxy, or Tor review signals.");
    }
  } else if (ipApiIs?.datacenter || ipApiIs?.hosting) {
    if (identityCategory === "Enterprise Network") {
      items.push(
        "ipapi.is reported a secondary infrastructure signal; the primary classification remains an enterprise network.",
      );
    } else if (identityCategory === "Public Infrastructure") {
      items.push(
        "ipapi.is reported service infrastructure, which is expected for public DNS, CDN, or edge networks.",
      );
    } else if (isConsumerAccessIdentity(identityCategory)) {
      items.push(
        "ipapi.is reported a secondary infrastructure signal; some checks may require review.",
      );
    } else {
      items.push("ipapi.is reported datacenter or hosting evidence.");
    }
  } else if (ipApiIs?.status === "available") {
    items.push("ipapi.is returned no VPN, proxy, Tor, or hosting signal.");
  }

  if (privacySignals.length === 0) {
    items.push("No VPN, proxy, Tor, or relay detected.");
  } else {
    items.push(`${formatSignalList(privacySignals)} detected.`);
  }

  if (isCloudflareWarpOn(cloudflare)) {
    items.push("Cloudflare WARP is active, which increases network risk.");
  } else if (cloudflare?.warp) {
    items.push("Cloudflare WARP is not active.");
  }

  if (hasInfrastructure) {
    if (isConsumerAccessIdentity(identityCategory)) {
      items.push(
        "Some infrastructure checks may require review, but network ownership still looks like a normal access network.",
      );
    } else if (identityCategory === "Enterprise Network") {
      items.push(
        "Enterprise networks are often clean, but some platforms may apply extra checks to large organization or shared corporate traffic.",
      );
    } else if (identityCategory === "Public Infrastructure") {
      items.push(
        "Public DNS, CDN, or edge infrastructure is normal for services, but not ideal as a personal browsing or account registration IP.",
      );
    } else if (isHostedInfrastructureIdentity(identityCategory)) {
      items.push(
        "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
      );
    } else {
      items.push(
        hasDetail(usageType)
          ? `Network usage looks like ${usageType.toLowerCase()}, which stricter services may review.`
          : "Network integrity signals suggest infrastructure routing, which stricter services may review.",
      );
    }
  } else {
    items.push("No hosting infrastructure signal was detected.");
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo agree on the visible IP.");
  } else if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo report different visible IPs.");
  }

  if (hasDetail(ownership.asn) || hasDetail(ownership.isp)) {
    items.push(
      `Network owner is visible: ${[ownership.asn, ownership.isp]
        .filter((value) => hasDetail(value))
        .join(" / ")}.`,
    );
  } else {
    items.push("ASN/ISP is unknown, so ownership confidence is lower.");
  }

  if (hasDetail(reverseDns)) {
    items.push("DNS is present and does not show an obvious conflict.");
  } else {
    items.push("DNS consistency could not be confirmed.");
  }

  return items;
}

function getRiskSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
  scamalytics: ScamalyticsResponse | null,
  ipApiIs: IpApiIsResponse | null,
  cloudflare: CloudflareTraceResponse | null,
): RiskSignal[] {
  const privacy = ipInfo.privacy;
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const ownership = getNetworkIdentity(ipInfo, abuseIpDb);
  const identity = classifyNetworkIdentity({
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    ipApiIs,
  });
  const identityCategory = identity.networkIdentity;
  const signals: RiskSignal[] = [];

  if (privacy?.proxy === true) {
    signals.push({
      label: "Proxy detected",
      detail: "Traffic appears to be routed through a proxy service.",
      tone: "risk",
    });
  }

  if (privacy?.vpn === true) {
    signals.push({
      label: "VPN detected",
      detail: "Traffic appears to be routed through a VPN service.",
      tone: "caution",
    });
  }

  if (privacy?.tor === true) {
    signals.push({
      label: "Tor detected",
      detail: "Tor exit traffic is a strong risk signal for many services.",
      tone: "risk",
    });
  }

  if (privacy?.relay === true) {
    signals.push({
      label: "Relay detected",
      detail: "Relay traffic can make the origin of activity harder to verify.",
      tone: "caution",
    });
  }

  if (isCloudflareWarpOn(cloudflare)) {
    signals.push({
      label: "WARP enabled",
      detail: "Cloudflare reports WARP is active for this network path.",
      tone: "risk",
    });
  }

  if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    signals.push({
      label: "IP mismatch",
      detail: "Cloudflare and IPinfo identify different visible IPs.",
      tone: "caution",
    });
  }

  if (abuseConfidence !== null && abuseConfidence > 0) {
    signals.push({
      label: "Abuse history",
      detail: `${formatAbuseConfidence(abuseIpDb)} confidence reported.`,
      tone: abuseConfidence >= 50 ? "risk" : "caution",
    });
  }

  const ipqsFraudScore = getIpqsFraudScore(ipqs);

  if (ipqsFraudScore !== null && ipqsFraudScore > 0) {
    signals.push({
      label: "IPQS fraud score",
      detail: `IPQualityScore reports ${ipqsFraudScore}/100 fraud risk.`,
      tone: ipqsFraudScore >= IPQS_STRONG_RISK_FRAUD_SCORE ? "risk" : "caution",
    });
  }

  const scamalyticsScore = getScamalyticsScore(scamalytics);

  if (scamalyticsScore !== null && scamalyticsScore > 0) {
    signals.push({
      label: "Scamalytics risk score",
      detail: `Scamalytics reports ${scamalyticsScore}/100 reputation risk.`,
      tone:
        scamalyticsScore >= SCAMALYTICS_STRONG_RISK_SCORE ? "risk" : "caution",
    });
  }

  if (ipApiIs?.tor === true) {
    signals.push({
      label: "ipapi.is Tor signal",
      detail: "ipapi.is marks this IP as Tor exit traffic.",
      tone: "risk",
    });
  }

  if (ipApiIs?.vpn === true || ipApiIs?.proxy === true) {
    if (isConsumerAccessIdentity(identityCategory)) {
      signals.push({
        label: "Minor review signal",
        detail:
          "A secondary provider reported a privacy review signal, but the primary classification remains a normal access network.",
        tone: "caution",
      });
    } else if (identityCategory === "Enterprise Network") {
      signals.push({
        label: "Enterprise network review signal",
        detail:
          "A secondary provider reported a privacy review signal. Large organization and shared corporate traffic can receive extra checks.",
        tone: "caution",
      });
    } else {
      signals.push({
        label: "ipapi.is VPN/proxy signal",
        detail: "ipapi.is marks this IP as VPN or proxy traffic.",
        tone: "caution",
      });
    }
  }

  if (ipApiIs?.abuser === true) {
    signals.push({
      label: "ipapi.is abuse signal",
      detail: "ipapi.is reports this IP is linked to abusive activity.",
      tone: "caution",
    });
  }

  if (hasNativeInfrastructureSignal(ipInfo, abuseIpDb)) {
    if (isConsumerAccessIdentity(identityCategory)) {
      signals.push({
        label: "Minor network review signal",
        detail:
          "Some infrastructure checks may require review, but network ownership still looks like a normal access network.",
        tone: "caution",
      });
    } else if (identityCategory === "Enterprise Network") {
      signals.push({
        label: "Enterprise network",
        detail:
          "Traffic comes from a large organization or shared corporate network, which some platforms review more closely.",
        tone: "caution",
      });
    } else if (identityCategory === "Public Infrastructure") {
      signals.push({
        label: "Public infrastructure",
        detail:
          "This is normal for public DNS, CDN, or edge services, but not ideal for personal browsing or account registration.",
        tone: "infrastructure",
      });
    } else if (isHostedInfrastructureIdentity(identityCategory)) {
      signals.push({
        label: "Hosted infrastructure",
        detail:
          "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
        tone: "infrastructure",
      });
    } else {
      signals.push({
        label: "Hosting infrastructure",
        detail: hasDetail(ownership.asn)
          ? "Network ownership appears to be hosting or infrastructure."
          : "Network appears to be hosting or infrastructure.",
        tone: "infrastructure",
      });
    }
  }

  if (ipApiIs?.datacenter === true || ipApiIs?.hosting === true) {
    if (isConsumerAccessIdentity(identityCategory)) {
      signals.push({
        label: "Minor review signal",
        detail:
          "A secondary provider reported an infrastructure review signal, but the primary classification remains a normal access network.",
        tone: "caution",
      });
    } else if (identityCategory === "Enterprise Network") {
      signals.push({
        label: "Enterprise network review signal",
        detail:
          "A secondary provider reported an infrastructure review signal. Enterprise traffic can receive extra checks because it comes from a shared corporate network.",
        tone: "caution",
      });
    } else if (identityCategory === "Public Infrastructure") {
      signals.push({
        label: "Public infrastructure",
        detail:
          "This is normal for public DNS, CDN, or edge services, but not ideal for personal browsing or account registration.",
        tone: "infrastructure",
      });
    } else if (isHostedInfrastructureIdentity(identityCategory)) {
      signals.push({
        label: "Hosted infrastructure",
        detail:
          "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
        tone: "infrastructure",
      });
    } else {
      signals.push({
        label: "ipapi.is hosting signal",
        detail: "ipapi.is reports datacenter or hosting infrastructure.",
        tone: "infrastructure",
      });
    }
  }

  if (hasCloudflareColoSignal(ipInfo, cloudflare)) {
    if (identityCategory === "Public Infrastructure") {
      signals.push({
        label: "Public edge infrastructure",
        detail: hasDetail(cloudflare?.colo)
          ? `Cloudflare reports edge routing through ${cloudflare?.colo}, which is expected for service infrastructure.`
          : "Cloudflare reported an edge routing signal, which is expected for service infrastructure.",
        tone: "infrastructure",
      });
    } else if (identityCategory === "Enterprise Network") {
      signals.push({
        label: "Enterprise network review signal",
        detail:
          "Cloudflare reported an edge routing signal. Enterprise traffic may receive extra checks when network paths are shared.",
        tone: "caution",
      });
    } else if (isConsumerAccessIdentity(identityCategory)) {
      signals.push({
        label: "Minor review signal",
        detail:
          "Cloudflare reported an edge routing signal. Some checks may require review, but the primary classification remains a normal access network.",
        tone: "caution",
      });
    } else {
      signals.push({
        label: "Infrastructure route",
        detail: hasDetail(cloudflare?.colo)
          ? `Cloudflare routed this IP through ${cloudflare?.colo}.`
          : "Cloudflare detected an edge routing signal.",
        tone: "infrastructure",
      });
    }
  }

  return signals;
}

const SERVICE_COMPATIBILITY_GROUPS = [
  {
    category: "GENERAL WEB",
    services: [
      "YouTube",
      "Reddit",
      "Wikipedia",
      "Facebook",
      "Instagram",
      "X",
      "TikTok",
    ],
  },
  {
    category: "AI SERVICES",
    services: ["ChatGPT", "Claude", "Gemini", "Perplexity", "Grok"],
  },
  {
    category: "STREAMING",
    services: ["Netflix", "Disney+", "Prime Video", "Max"],
  },
  {
    category: "DEVELOPER",
    services: ["GitHub", "GitLab", "Cloudflare", "Vercel"],
  },
  {
    category: "CLOUD",
    services: ["AWS", "Azure", "Google Cloud"],
  },
  {
    category: "GOOGLE",
    services: ["Google Voice", "Google Account", "Gmail", "Google Play"],
  },
  {
    category: "APPLE",
    services: ["Apple ID", "iCloud"],
  },
  {
    category: "COMMUNICATION",
    services: ["Discord", "Telegram"],
  },
  {
    category: "GAMING",
    services: ["Steam", "Epic Games", "PlayStation Network", "Xbox Live"],
  },
  {
    category: "FINANCE",
    services: ["PayPal", "Wise", "Stripe", "Revolut"],
  },
  {
    category: "CRYPTO",
    services: ["Binance", "Coinbase", "Kraken", "Bybit", "OKX"],
  },
] as const;

const DEFAULT_CONNECTIVITY = buildConnectivityProbeResult("not_verified");

const GOOGLE_CONNECTIVITY_SERVICES = new Set([
  "google account",
  "gmail",
  "google play",
  "google voice",
  "google cloud",
]);

const OPENAI_CONNECTIVITY_SERVICES = new Set(["chatgpt", "openai"]);

const UNVERIFIED_REGION_PROBABILITY_CAP = 0.69;
const UNVERIFIED_REGION_EXPLANATION =
  "Browser privacy and CORS restrictions may prevent full verification. When access cannot be strongly verified, IP Health shows Not Verified instead of Available.";
const IPQS_CAUTION_FRAUD_SCORE = 80;
const IPQS_STRONG_RISK_FRAUD_SCORE = 90;
const IPQS_STRONG_RISK_TRUST_CAP = 35;
const IPQS_CAUTION_TRUST_CAP = 79;
const SCAMALYTICS_CAUTION_SCORE = 75;
const SCAMALYTICS_STRONG_RISK_SCORE = 90;

function normalizeServiceName(service: string) {
  return service.trim().toLowerCase();
}

function getServiceConnectivityProbe(
  service: string,
): keyof ConnectivityProbeResult | null {
  const normalizedService = normalizeServiceName(service);

  if (normalizedService === "youtube") {
    return "youtube";
  }

  if (GOOGLE_CONNECTIVITY_SERVICES.has(normalizedService)) {
    return "google";
  }

  if (OPENAI_CONNECTIVITY_SERVICES.has(normalizedService)) {
    return "openai";
  }

  return null;
}

function getRegionAvailabilityVerification(
  service: string,
  connectivity: ConnectivityProbeResult,
): RegionAvailabilityVerification {
  const probe = getServiceConnectivityProbe(service);

  if (!probe) {
    return "not_probed";
  }

  if (isConnectivityProbeReachable(connectivity[probe])) {
    return "probe_passed";
  }

  if (isConnectivityProbeUnreachable(connectivity[probe])) {
    return "probe_failed";
  }

  return "not_probed";
}

function roundProbability(value: number) {
  return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
}

function roundSignalValue(value: number) {
  return Number(value.toFixed(4));
}

function getFinalRiskLevel(score: number): FinalDecisionRiskLevel {
  if (score >= 70) {
    return "low";
  }

  if (score >= 40) {
    return "medium";
  }

  return "high";
}

function getServiceStatusFromProbability(
  probability: number,
): ServiceCompatibilityStatus {
  if (probability >= 0.7) {
    return "Good";
  }

  if (probability >= 0.42) {
    return "Use with Caution";
  }

  return "High Risk";
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

function getStrongestReputationScore(
  ipqs?: IpqsResponse | null,
  scamalytics?: ScamalyticsResponse | null,
) {
  const scores = [
    getIpqsFraudScore(ipqs),
    getScamalyticsScore(scamalytics),
  ].filter((score): score is number => score !== null);

  return scores.length === 0 ? null : Math.max(...scores);
}

function getIpqsRiskProbability(fraudScore: number | null) {
  if (fraudScore === null || fraudScore < IPQS_CAUTION_FRAUD_SCORE) {
    return null;
  }

  return roundProbability((100 - Math.min(Math.max(fraudScore, 0), 100)) / 100);
}

function applyReputationDecisionTrustPolicy(
  trustScore: number,
  reputationScore: number | null,
) {
  if (
    reputationScore !== null &&
    reputationScore >= SCAMALYTICS_STRONG_RISK_SCORE
  ) {
    return Math.min(trustScore, IPQS_STRONG_RISK_TRUST_CAP);
  }

  if (
    reputationScore !== null &&
    reputationScore >= SCAMALYTICS_CAUTION_SCORE
  ) {
    return Math.min(trustScore, IPQS_CAUTION_TRUST_CAP);
  }

  return trustScore;
}

function getOverallVerdict({
  trustScore,
  hasHardRestriction,
  reputationRiskScore,
}: {
  trustScore: number;
  hasHardRestriction: boolean;
  reputationRiskScore: number | null;
}): OverallVerdict {
  if (
    trustScore < 40 ||
    (reputationRiskScore !== null &&
      reputationRiskScore >= SCAMALYTICS_STRONG_RISK_SCORE)
  ) {
    return "Risky";
  }

  if (trustScore >= 80 && !hasHardRestriction) {
    return "Healthy";
  }

  return "Use with Caution";
}

function getServiceStatus({
  probability,
  reputationRiskScore,
}: {
  probability: number;
  reputationRiskScore: number | null;
}): ServiceCompatibilityStatus {
  if (
    reputationRiskScore !== null &&
    reputationRiskScore >= SCAMALYTICS_STRONG_RISK_SCORE
  ) {
    return "High Risk";
  }

  return getServiceStatusFromProbability(probability);
}

function buildIpqsExternalSignal(
  ipqs?: IpqsResponse | null,
): IpqsExternalSignal {
  if (!ipqs || ipqs.status === "unavailable") {
    return {
      status: "unavailable",
      ...(ipqs?.error ? { error: ipqs.error } : {}),
    };
  }

  return {
    status: "available",
    fraud_score: ipqs.fraudScore ?? 0,
    country: ipqs.country ?? "",
    vpn: ipqs.vpn ?? false,
    proxy: ipqs.proxy ?? false,
    tor: ipqs.tor ?? false,
    bot_status: ipqs.bot ?? false,
  };
}

function buildScamalyticsExternalSignal(
  scamalytics?: ScamalyticsResponse | null,
): ScamalyticsExternalSignal {
  if (!scamalytics || scamalytics.status === "unavailable") {
    return {
      status: "unavailable",
      ...(scamalytics?.error ? { error: scamalytics.error } : {}),
    };
  }

  return {
    status: "available",
    score: scamalytics.score ?? 0,
    risk: scamalytics.risk ?? "",
    country: scamalytics.country ?? "",
    proxy: scamalytics.proxy ?? false,
    vpn: scamalytics.vpn ?? false,
    tor: scamalytics.tor ?? false,
    server: scamalytics.server ?? false,
  };
}

function buildIpApiIsExternalSignal(
  ipApiIs?: IpApiIsResponse | null,
): IpApiIsExternalSignal {
  if (!ipApiIs || ipApiIs.status === "unavailable") {
    return {
      status: "unavailable",
      ...(ipApiIs?.reason ? { reason: ipApiIs.reason } : {}),
      ...(ipApiIs?.providerStatus
        ? { providerStatus: ipApiIs.providerStatus }
        : {}),
      ...(ipApiIs?.error ? { error: ipApiIs.error } : {}),
    };
  }

  return {
    status: "available",
    providerStatus: ipApiIs.providerStatus,
    vpn: ipApiIs.vpn ?? false,
    proxy: ipApiIs.proxy ?? false,
    tor: ipApiIs.tor ?? false,
    datacenter: ipApiIs.datacenter ?? false,
    hosting: ipApiIs.hosting ?? false,
    asn: ipApiIs.asn ?? "",
    asnName: ipApiIs.asnName ?? "",
    organization: ipApiIs.organization ?? ipApiIs.isp ?? "",
    country: ipApiIs.country ?? "",
    countryCode: ipApiIs.countryCode ?? "",
    region: ipApiIs.region ?? "",
    city: ipApiIs.city ?? "",
    abuser: ipApiIs.abuser ?? false,
    companyAbuserScore: ipApiIs.companyAbuserScore ?? "",
    asnAbuserScore: ipApiIs.asnAbuserScore ?? "",
  };
}

function toScaledFinalDecisionSignal(
  signal: WeightedDecisionSignal,
  scale: number,
): FinalDecisionSignal {
  const contribution = roundSignalValue(signal.contribution * scale);
  const impact = roundSignalValue(signal.impact * scale);

  return {
    ...signal,
    weight: roundSignalValue(signal.weight * scale),
    impact,
    contribution,
  };
}

function buildProbabilitySignal(
  signalName: string,
  probability: number,
  weight: number,
): FinalDecisionSignal {
  const contribution = roundSignalValue((probability - 0.5) * weight);
  const impact = roundSignalValue(Math.abs(contribution));

  return {
    signalName,
    direction:
      contribution > 0.005
        ? "supports_availability"
        : contribution < -0.005
          ? "raises_risk"
          : "neutral",
    weight: roundSignalValue(weight),
    impact,
    contribution,
  };
}

function sortFinalDecisionSignals(signals: FinalDecisionSignal[]) {
  return [...signals].sort((signalA, signalB) => {
    if (signalB.impact !== signalA.impact) {
      return signalB.impact - signalA.impact;
    }

    return signalA.signalName.localeCompare(signalB.signalName);
  });
}

function getFinalServiceAvailability(
  finalDecision: FinalDecision,
): ServiceAvailabilityStatus {
  const { regionAvailability } = finalDecision.decision;
  const probe = getServiceConnectivityProbe(finalDecision.rawSignals.service);
  const verification = getRegionAvailabilityVerification(
    finalDecision.rawSignals.service,
    finalDecision.decision.connectivity,
  );
  const hasHardRestriction =
    regionAvailability.status === "likely_blocked" ||
    regionAvailability.restriction === "hard_region";

  if (probe && verification === "probe_failed") {
    return "Not Verified";
  }

  if (hasHardRestriction) {
    return "Restricted";
  }

  if (!probe || verification === "not_probed") {
    return "Not Verified";
  }

  if (verification !== "probe_passed") {
    return "Not Verified";
  }

  return "Verified";
}

function getServiceAvailabilitySummary(
  services: { finalAvailability: ServiceAvailabilityStatus }[],
) {
  return (Array.isArray(services) ? services : []).reduce<
    Record<ServiceAvailabilityStatus, number>
  >(
    (summary, service) => ({
      ...summary,
      [service.finalAvailability]: summary[service.finalAvailability] + 1,
    }),
    {
      Verified: 0,
      "Not Verified": 0,
      Restricted: 0,
    },
  );
}

function getServiceAvailabilitySummaryLabel(
  services: { finalAvailability: ServiceAvailabilityStatus }[],
) {
  const summary = getServiceAvailabilitySummary(services);
  const serviceCount = Array.isArray(services) ? services.length : 0;

  if (summary.Verified === 0 && summary.Restricted === 0) {
    return `${serviceCount} services`;
  }

  return `${summary.Verified} Verified - ${summary.Restricted} Restricted`;
}

export function applyConnectivityFinalGate(
  finalDecision: FinalDecision,
): FinalDecision {
  const verification = getRegionAvailabilityVerification(
    finalDecision.rawSignals.service,
    finalDecision.decision.connectivity,
  );
  const hasHardRestriction =
    finalDecision.decision.regionAvailability.status === "likely_blocked" ||
    finalDecision.decision.regionAvailability.restriction === "hard_region";
  const ipqsSignal = finalDecision.decision.externalSignals.ipqs;
  const scamalyticsSignal = finalDecision.decision.externalSignals.scamalytics;
  const reputationRiskScores = [
    ipqsSignal.status === "available" ? ipqsSignal.fraud_score : null,
    scamalyticsSignal.status === "available" ? scamalyticsSignal.score : null,
  ].filter((score): score is number => score !== null);
  const reputationRiskScore =
    reputationRiskScores.length === 0
      ? null
      : Math.max(...reputationRiskScores);

  if (verification === "probe_failed") {
    return createFinalDecisionV1({
      rawSignals: finalDecision.rawSignals,
      computedMetrics: {
        ...finalDecision.computedMetrics,
        regionAvailabilityProbability: 0,
        serviceCompatibilityProbability: 0,
      },
      decision: {
        ...finalDecision.decision,
        overallVerdict: getOverallVerdict({
          trustScore: finalDecision.decision.trustScore,
          hasHardRestriction: false,
          reputationRiskScore,
        }),
        regionAvailability: {
          ...finalDecision.decision.regionAvailability,
          status: "uncertain",
          probability: 0,
          restriction: "none",
          explanation: "Connectivity probe failed.",
          verification,
        },
        serviceCompatibility: {
          status: "High Risk",
          probability: 0,
        },
      },
    });
  }

  if (verification === "probe_passed") {
    return finalDecision;
  }

  const regionAvailabilityProbability = roundProbability(
    Math.min(
      finalDecision.decision.regionAvailability.probability,
      UNVERIFIED_REGION_PROBABILITY_CAP,
    ),
  );

  return createFinalDecisionV1({
    rawSignals: finalDecision.rawSignals,
    computedMetrics: {
      ...finalDecision.computedMetrics,
      regionAvailabilityProbability,
    },
    decision: {
      ...finalDecision.decision,
      regionAvailability: {
        ...finalDecision.decision.regionAvailability,
        status: hasHardRestriction ? "likely_blocked" : "uncertain",
        probability: regionAvailabilityProbability,
        explanation: hasHardRestriction
          ? finalDecision.decision.regionAvailability.explanation
          : UNVERIFIED_REGION_EXPLANATION,
        verification,
      },
    },
  });
}

function getHistoricalAccessConsistency(
  ipHistory: IpHistoryRecord[],
): HistoricalAccessConsistency {
  if (ipHistory.length < 2) {
    return "unavailable";
  }

  const trustScores = ipHistory.map(
    (historyRecord) => historyRecord.trustScore,
  );
  const scoreSpread = Math.max(...trustScores) - Math.min(...trustScores);
  const ipTypes = new Set(
    ipHistory.map((historyRecord) => historyRecord.ipType),
  );

  if (scoreSpread <= 10 && ipTypes.size <= 1) {
    return "stable";
  }

  if (scoreSpread >= 30 || ipTypes.size >= 3) {
    return "unstable";
  }

  return "mixed";
}

function buildRegionRiskLevel(
  serviceCompatibility: { services: { finalDecision: FinalDecision }[] }[],
  region: string | null,
) {
  if (!region) {
    return "unknown";
  }

  const lowestServiceRegionScore = serviceCompatibility
    .flatMap((category) =>
      category.services.map(
        (service) =>
          service.finalDecision.decision.regionAvailability.probability,
      ),
    )
    .reduce<number | null>(
      (lowestScore, score) =>
        lowestScore === null ? score : Math.min(lowestScore, score),
      null,
    );

  return getRegionRiskLevel(lowestServiceRegionScore);
}

function getReportFinalDecision(
  serviceCompatibility: { services: { finalDecision: FinalDecision }[] }[],
) {
  return serviceCompatibility
    .flatMap((category) =>
      category.services.map((service) => service.finalDecision),
    )
    .reduce<FinalDecision | null>((lowestDecision, decision) => {
      if (!lowestDecision) {
        return decision;
      }

      if (
        decision.decision.regionAvailability.probability !==
        lowestDecision.decision.regionAvailability.probability
      ) {
        return decision.decision.regionAvailability.probability <
          lowestDecision.decision.regionAvailability.probability
          ? decision
          : lowestDecision;
      }

      return decision.decision.serviceCompatibility.probability <
        lowestDecision.decision.serviceCompatibility.probability
        ? decision
        : lowestDecision;
    }, null);
}

function buildRegionInferenceInput({
  service,
  region,
  ipInfo,
  abuseIpDb,
  ipqs,
  scamalytics,
  ipApiIs,
  cloudflare,
  historicalAccessConsistency,
}: {
  service: string;
  region: string | null;
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  scamalytics: ScamalyticsResponse | null;
  ipApiIs: IpApiIsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  historicalAccessConsistency: HistoricalAccessConsistency;
}): RegionServiceInferenceInput {
  const compatibilitySignals = buildServiceCompatibilitySignals(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    scamalytics,
    ipApiIs,
  );

  return {
    service,
    region,
    usageType: abuseIpDb?.usageType ?? null,
    asnType: pickDetail(ipInfo.asn?.type, ipInfo.company?.type),
    ispName: pickDetail(
      ipInfo.company?.name,
      abuseIpDb?.isp,
      ipInfo.asn?.name,
      ipInfo.org,
    ),
    abuseConfidence: compatibilitySignals.abuseConfidence,
    fraudScore: getStrongestReputationScore(ipqs, scamalytics),
    recentAbuse:
      ipqs?.status === "unavailable" ? null : (ipqs?.recentAbuse ?? null),
    hostingStatus: compatibilitySignals.hosting,
    vpnStatus: compatibilitySignals.vpn,
    proxyStatus: compatibilitySignals.proxy,
    torStatus: compatibilitySignals.tor,
    relayStatus: compatibilitySignals.relay,
    cloudflareWarpStatus: isCloudflareWarpOn(cloudflare),
    cloudflareTraceMatch: hasCloudflareTraceMatch(ipInfo, cloudflare),
    cloudflareTraceMismatch: hasCloudflareTraceMismatch(ipInfo, cloudflare),
    historicalAccessConsistency,
  };
}

function buildFinalDecision({
  service,
  region,
  ipInfo,
  abuseIpDb,
  ipqs,
  scamalytics,
  ipApiIs,
  cloudflare,
  historicalAccessConsistency,
  connectivity,
}: {
  service: string;
  region: string | null;
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  scamalytics: ScamalyticsResponse | null;
  ipApiIs: IpApiIsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  historicalAccessConsistency: HistoricalAccessConsistency;
  connectivity: ConnectivityProbeResult;
}): FinalDecision {
  const baseTrustScore = calculateTrustScore(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    scamalytics,
    ipApiIs,
  );
  const ipqsFraudScore = getIpqsFraudScore(ipqs);
  const reputationRiskScore = getStrongestReputationScore(ipqs, scamalytics);
  const trustScore = applyReputationDecisionTrustPolicy(
    baseTrustScore,
    reputationRiskScore,
  );
  const trustProbability = roundProbability(trustScore / 100);
  const regionInference = inferRegionServiceCompatibility(
    buildRegionInferenceInput({
      service,
      region,
      ipInfo,
      abuseIpDb,
      ipqs,
      scamalytics,
      ipApiIs,
      cloudflare,
      historicalAccessConsistency,
    }),
  );
  const regionAvailabilityProbability = regionInference.probability;
  const serviceProbability = trustProbability;
  const ipqsRiskProbability = getIpqsRiskProbability(ipqsFraudScore);
  const scamalyticsRiskProbability = getIpqsRiskProbability(
    getScamalyticsScore(scamalytics),
  );
  const ipqsSignal =
    ipqsRiskProbability === null
      ? []
      : [buildProbabilitySignal("ipqs_fraud_score", ipqsRiskProbability, 0.75)];
  const scamalyticsSignal =
    scamalyticsRiskProbability === null
      ? []
      : [
          buildProbabilitySignal(
            "scamalytics_risk_score",
            scamalyticsRiskProbability,
            0.75,
          ),
        ];
  const hasHardRestriction =
    regionInference.status === "likely_blocked" ||
    regionInference.restriction === "hard_region";
  const signals = sortFinalDecisionSignals([
    buildProbabilitySignal("trust_score", trustProbability, 0.55),
    buildProbabilitySignal(
      "region_availability",
      regionAvailabilityProbability,
      0.45,
    ),
    ...ipqsSignal,
    ...scamalyticsSignal,
    ...regionInference.signals.map((signal) =>
      toScaledFinalDecisionSignal(signal, 0.45),
    ),
  ]);

  const finalDecision = createFinalDecisionV1({
    rawSignals: {
      ip: ipInfo.ip ?? "",
      region,
      service,
      signals: regionInference.signals,
    },
    computedMetrics: {
      trustScore,
      trustProbability,
      regionAvailabilityProbability,
      serviceCompatibilityProbability: serviceProbability,
    },
    decision: {
      ip: ipInfo.ip ?? "",
      trustScore,
      overallVerdict: getOverallVerdict({
        trustScore,
        hasHardRestriction,
        reputationRiskScore,
      }),
      riskLevel: getFinalRiskLevel(trustScore),
      connectivity,
      regionAvailability: {
        status: regionInference.status,
        probability: regionAvailabilityProbability,
        restriction: regionInference.restriction,
        explanation: regionInference.explanation,
        verification: getRegionAvailabilityVerification(service, connectivity),
      },
      serviceCompatibility: {
        status: getServiceStatus({
          probability: serviceProbability,
          reputationRiskScore,
        }),
        probability: serviceProbability,
      },
      externalSignals: {
        ipqs: buildIpqsExternalSignal(ipqs),
        scamalytics: buildScamalyticsExternalSignal(scamalytics),
        ipApiIs: buildIpApiIsExternalSignal(ipApiIs),
      },
      signals,
    },
  });

  return applyConnectivityFinalGate(finalDecision);
}

function buildServiceCompatibilityView(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
  scamalytics: ScamalyticsResponse | null,
  ipApiIs: IpApiIsResponse | null,
  cloudflare: CloudflareTraceResponse | null,
  ipHistory: IpHistoryRecord[],
  connectivity: ConnectivityProbeResult,
) {
  const region = detectRegionFromIpInfo(ipInfo);
  const historicalAccessConsistency = getHistoricalAccessConsistency(ipHistory);

  return SERVICE_COMPATIBILITY_GROUPS.map((category) => ({
    category: category.category,
    services: category.services.map((serviceName) => {
      const finalDecision = buildFinalDecision({
        service: serviceName,
        region,
        ipInfo,
        abuseIpDb,
        ipqs,
        scamalytics,
        ipApiIs,
        cloudflare,
        historicalAccessConsistency,
        connectivity,
      });
      const status = finalDecision.decision.serviceCompatibility.status;
      const finalAvailability = getFinalServiceAvailability(finalDecision);

      return {
        name: serviceName,
        status,
        finalAvailability,
        probability: finalDecision.decision.serviceCompatibility.probability,
        tone: getServiceCompatibilityTone(status),
        reason: finalDecision.display.summary,
        finalDecision,
      };
    }),
  })).map((category) => ({
    ...category,
    summary: getServiceAvailabilitySummaryLabel(category.services),
  }));
}

function formatCloudflareLocation(cloudflare?: CloudflareTraceResponse | null) {
  const country = formatDetail(cloudflare?.country);
  const colo = formatDetail(cloudflare?.colo);

  if (hasDetail(country) && hasDetail(colo)) {
    return `${country} (${colo})`;
  }

  if (hasDetail(country)) {
    return country;
  }

  if (hasDetail(colo)) {
    return colo;
  }

  return "Not identified";
}

function getWarpStatus(
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.warp) {
    return {
      label: "Not available",
      tone: "neutral",
      detail: "WARP status was not returned.",
    };
  }

  if (isCloudflareWarpOn(cloudflare)) {
    return {
      label: "WARP on",
      tone: "risk",
      detail: "Cloudflare WARP is active for this connection.",
    };
  }

  return {
    label: "No WARP detected",
    tone: "good",
    detail: "Cloudflare did not report WARP on this connection.",
  };
}

function getConsistencyStatus(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.ip || !ipInfo.ip) {
    return {
      label: "Not available",
      tone: "neutral",
      detail: "Unable to compare Cloudflare and IPinfo views.",
    };
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    return {
      label: "Consistent",
      tone: "good",
      detail: "Cloudflare and IPinfo identify the same IP.",
    };
  }

  return {
    label: "Needs review",
    tone: "caution",
    detail: "Cloudflare and IPinfo identify different IPs.",
  };
}

function getNetworkIntegrityTone(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): StatusTone {
  if (!cloudflare) {
    return "neutral";
  }

  if (
    isCloudflareWarpOn(cloudflare) ||
    hasCloudflareTraceMismatch(ipInfo, cloudflare)
  ) {
    return "caution";
  }

  return "good";
}

function buildNetworkIntegrity(
  ipInfo: IpInfoResponse,
  cloudflare: CloudflareTraceResponse | null,
): NetworkIntegrity {
  const warpStatus = getWarpStatus(cloudflare);
  const consistencyStatus = getConsistencyStatus(ipInfo, cloudflare);
  const tone = getNetworkIntegrityTone(ipInfo, cloudflare);

  return {
    label:
      tone === "good" ? "Clean" : tone === "caution" ? "Review" : "Unavailable",
    tone,
    hasCloudflare: Boolean(cloudflare),
    unavailableMessage: "Network integrity is unavailable right now.",
    items: [
      {
        label: "Real IP",
        value: formatDetail(cloudflare?.ip),
        detail: "Seen by Cloudflare trace.",
        tone: "neutral",
      },
      {
        label: "Location",
        value: formatCloudflareLocation(cloudflare),
        detail: "Cloudflare network view.",
        tone: "neutral",
      },
      {
        label: "VPN/WARP",
        value: warpStatus.label,
        detail: warpStatus.detail,
        tone: warpStatus.tone,
      },
      {
        label: "Consistency",
        value: consistencyStatus.label,
        detail: consistencyStatus.detail,
        tone: consistencyStatus.tone,
      },
    ],
  };
}

function buildIpHistoryRecord(
  result: ProviderAnalysisResult,
  fallbackIpAddress: string,
): IpHistoryRecord {
  const { ipInfo, abuseIpDb, ipqs, scamalytics, ipApiIs, cloudflare } = result;
  const baseTrustScore = calculateTrustScore(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
    scamalytics,
    ipApiIs,
  );
  const trustScore = applyReputationDecisionTrustPolicy(
    baseTrustScore,
    getStrongestReputationScore(ipqs, scamalytics),
  );

  return {
    ip: ipInfo.ip || fallbackIpAddress,
    timestamp: Date.now(),
    trustScore,
    recommendationLabel:
      trustScore >= 70
        ? "Recommended"
        : trustScore >= 40
          ? "Use with Caution"
          : "Not Recommended",
    confidence: buildRecommendationConfidence(
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
      scamalytics,
      ipApiIs,
    ),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    usageType: formatUsageType(abuseIpDb?.usageType, ipInfo.privacy),
    ipType: getIpTypeBadge(abuseIpDb?.usageType, ipInfo.privacy),
  };
}

function buildIpSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
) {
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);

  return {
    address: formatDetail(ipInfo.ip),
    facts: [
      { label: "Location", value: formatLocation(ipInfo) },
      hasDetail(networkIdentity.asn)
        ? { label: "ASN", value: networkIdentity.asn }
        : null,
      hasDetail(networkIdentity.isp)
        ? { label: "ISP", value: networkIdentity.isp }
        : null,
    ].filter((fact): fact is ResultFact => Boolean(fact)),
  };
}

function getRecommendationLabelFromServiceStatus(
  status: ServiceCompatibilityStatus,
) {
  if (status === "Good") {
    return "Recommended";
  }

  if (status === "Use with Caution") {
    return "Use with Caution";
  }

  return "Not Recommended";
}

function buildTrustScore(
  providerResult: ProviderAnalysisResult,
  hasAnalysis: boolean,
  finalDecision: FinalDecision | null,
  qualityReport: IpQualityReport,
): AnalysisResult["trustScore"] {
  const { ipInfo, abuseIpDb, ipqs, scamalytics, ipApiIs, cloudflare } =
    providerResult;

  if (!hasAnalysis) {
    return {
      value: null,
      displayValue: "--",
      riskLabel: "Pending",
      riskTone: "neutral" satisfies StatusTone,
      recommendationLabel: "Not analyzed",
      recommendationTone: "neutral" satisfies StatusTone,
      summary:
        "Enter an IP address or analyze your current IP to see IP quality and compatibility.",
      explanationIntro: "Score details will appear here after analysis.",
      explanationItems: ["Run an analysis to see score details."],
      hasAnalysis,
    };
  }

  const normalizedFinalDecision = finalDecision
    ? normalizeFinalDecision(finalDecision)
    : null;
  const value =
    qualityReport.overallScore ??
    normalizedFinalDecision?.decision.trustScore ??
    calculateTrustScore(
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
      scamalytics,
      ipApiIs,
    );
  const serviceStatus =
    normalizedFinalDecision?.decision.serviceCompatibility.status ??
    getServiceStatusFromProbability(value / 100);
  const recommendationLabel =
    getRecommendationLabelFromServiceStatus(serviceStatus);
  const serviceProbability = Math.round(
    (normalizedFinalDecision?.decision.serviceCompatibility.probability ??
      value / 100) * 100,
  );

  return {
    value,
    displayValue: String(value),
    riskLabel: qualityReport.assessment.label,
    riskTone: qualityReport.assessment.tone,
    recommendationLabel,
    recommendationTone: getRecommendationTone(recommendationLabel),
    summary: `${qualityReport.summary} Service compatibility probability is ${serviceProbability}%.`,
    explanationIntro: `Why this IP received a ${value}/100 IP Health Score.`,
    explanationItems: getScoreExplanationItems(
      ipInfo,
      abuseIpDb,
      ipqs,
      scamalytics,
      ipApiIs,
      cloudflare,
      qualityReport,
    ),
    hasAnalysis,
  };
}

export function buildAnalysisResult({
  providerResult,
  ipHistory = [],
  fallbackIpAddress = "",
  connectivity = null,
}: {
  providerResult: ProviderAnalysisResult | null;
  ipHistory?: IpHistoryRecord[];
  fallbackIpAddress?: string;
  connectivity?: ConnectivityProbeResult | null;
}): AnalysisResult {
  const hasAnalysis = Boolean(providerResult);
  const normalizedResult = normalizeProviderAnalysisResult(
    providerResult,
    fallbackIpAddress,
  );
  const { ipInfo, abuseIpDb, ipqs, scamalytics, ipApiIs, cloudflare } =
    normalizedResult;
  const normalizedIpHistory = normalizeIpHistory(ipHistory);
  const serviceCompatibility = hasAnalysis
    ? buildServiceCompatibilityView(
        ipInfo,
        abuseIpDb,
        ipqs,
        scamalytics,
        ipApiIs,
        cloudflare,
        normalizedIpHistory,
        connectivity ?? DEFAULT_CONNECTIVITY,
      )
    : [];
  const region = detectRegionFromIpInfo(ipInfo);
  const finalDecision = getReportFinalDecision(serviceCompatibility);
  const qualityReport = buildIpQualityReport({
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
  });

  return {
    ip: buildIpSummary(ipInfo, abuseIpDb),
    trustScore: buildTrustScore(
      normalizedResult,
      hasAnalysis,
      finalDecision,
      qualityReport,
    ),
    riskSignals: hasAnalysis
      ? getRiskSignals(
          ipInfo,
          abuseIpDb,
          ipqs,
          scamalytics,
          ipApiIs,
          cloudflare,
        )
      : [],
    finalDecision,
    serviceCompatibility,
    connectivity,
    regionRiskLevel: hasAnalysis
      ? buildRegionRiskLevel(serviceCompatibility, region)
      : "unknown",
    ipHistory: normalizedIpHistory,
    qualityReport,
    networkIntegrity: buildNetworkIntegrity(ipInfo, cloudflare),
    endUserReport: buildEndUserReport({
      ipInfo,
      abuseIpDb,
      ipqs,
      scamalytics,
      ipApiIs,
      cloudflare,
      finalDecision,
      hasAnalysis,
    }),
  };
}

export function getEmptyAnalysisResult(fallbackIpAddress = ""): AnalysisResult {
  return buildAnalysisResult({
    providerResult: null,
    fallbackIpAddress,
  });
}

export async function buildAnalysis(
  ipAddress: string,
  options?: AnalysisProgressOptions,
): Promise<AnalysisResult> {
  const trimmedIpAddress = ipAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  assertValidIpv4Address(trimmedIpAddress);
  options?.onProgress?.({ step: "detect_ip", status: "running" });
  options?.onProgress?.({ step: "detect_ip", status: "completed" });

  const [providerResult, connectivity] = await Promise.all([
    fetchProviderAnalysis(trimmedIpAddress, options),
    probeConnectivity(),
  ]);
  options?.onProgress?.({ step: "trust_score", status: "running" });
  const storedIpHistory = loadIpHistory();
  const historyRecord = buildIpHistoryRecord(providerResult, trimmedIpAddress);
  const nextIpHistory = getNextIpHistory(storedIpHistory, historyRecord);

  if (!options?.qaMode) {
    persistIpHistory(nextIpHistory);
  }
  options?.onProgress?.({ step: "trust_score", status: "completed" });
  options?.onProgress?.({ step: "report", status: "running" });

  const result = buildAnalysisResult({
    providerResult,
    ipHistory: getHistoryForIp(nextIpHistory, historyRecord.ip),
    fallbackIpAddress: trimmedIpAddress,
    connectivity,
  });

  options?.onProgress?.({ step: "report", status: "completed" });

  return result;
}

export async function analyzeIpAddress(
  ipAddress: string,
): Promise<AnalysisResult> {
  return buildAnalysis(ipAddress);
}
