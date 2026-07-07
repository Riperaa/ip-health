import {
  hasCloudflareColoSignal,
  hasCloudflareTraceMismatch,
  isCloudflareWarpOn,
  isInfrastructureUsage,
} from "@/lib/trust-engine";
import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  EndUserReport,
  IpApiIsResponse,
  IpInfoResponse,
  IpqsResponse,
  ScamalyticsResponse,
} from "@/lib/analysis/types";

type SharingRiskLevel = EndUserReport["sharingRisk"]["level"];

type SharingRiskInput = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  scamalytics: ScamalyticsResponse | null;
  ipApiIs: IpApiIsResponse | null;
  identity: EndUserReport["identity"];
};

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function hasText(value?: string | null) {
  return normalizeText(value).length > 0;
}

function includesNetworkType(ipInfo: IpInfoResponse, keywords: string[]) {
  return [
    ipInfo.asn?.type,
    ipInfo.company?.type,
    ipInfo.asn?.name,
    ipInfo.company?.name,
    ipInfo.org,
  ].some((value) => {
    const normalizedValue = normalizeText(value);

    return keywords.some((keyword) => normalizedValue.includes(keyword));
  });
}

function addEvidence(evidence: string[], label: string) {
  if (!evidence.includes(label)) {
    evidence.push(label);
  }
}

function createSharingRisk({
  level,
  reason,
  evidence,
}: {
  level: SharingRiskLevel;
  reason: string;
  evidence: string[];
}): EndUserReport["sharingRisk"] {
  const toneByLevel: Record<SharingRiskLevel, EndUserReport["sharingRisk"]["tone"]> =
    {
      Low: "good",
      Medium: "caution",
      High: "risk",
      Unknown: "neutral",
    };

  return {
    level,
    label: level,
    tone: toneByLevel[level],
    explanation: reason,
    reason,
    evidence: evidence.slice(0, 4),
  };
}

export function buildNetworkSharingRisk({
  ipInfo,
  abuseIpDb,
  ipqs,
  cloudflare,
  scamalytics,
  ipApiIs,
  identity,
}: SharingRiskInput): EndUserReport["sharingRisk"] {
  const evidence: string[] = [];
  const privacy = ipInfo.privacy;
  const hasTorSignal =
    privacy?.tor === true ||
    ipqs?.tor === true ||
    scamalytics?.tor === true ||
    ipApiIs?.tor === true;
  const hasVpnProxySignal =
    privacy?.vpn === true ||
    privacy?.proxy === true ||
    privacy?.relay === true ||
    ipqs?.vpn === true ||
    ipqs?.activeVpn === true ||
    ipqs?.proxy === true ||
    scamalytics?.vpn === true ||
    scamalytics?.proxy === true ||
    ipApiIs?.vpn === true ||
    ipApiIs?.proxy === true ||
    isCloudflareWarpOn(cloudflare);
  const hasDatacenterSignal =
    ipApiIs?.datacenter === true ||
    identity.networkIdentity === "Datacenter" ||
    identity.networkIdentity === "Cloud Provider" ||
    includesNetworkType(ipInfo, ["datacenter", "data center"]);
  const hasHostingSignal =
    privacy?.hosting === true ||
    ipApiIs?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType) ||
    includesNetworkType(ipInfo, [
      "hosting",
      "cloud",
      "infrastructure",
      "server",
    ]);
  const hasPublicOrManagedSignal =
    identity.networkIdentity === "Public Infrastructure" ||
    identity.networkIdentity === "Enterprise Network" ||
    includesNetworkType(ipInfo, ["managed", "cdn", "dns", "edge"]);
  const hasInfrastructureRoute = hasCloudflareColoSignal(ipInfo, cloudflare);
  const hasMismatchSignal = hasCloudflareTraceMismatch(ipInfo, cloudflare);
  const isResidentialOrMobile =
    identity.networkIdentity === "Residential ISP" ||
    identity.networkIdentity === "Mobile Network";
  const hasOwnershipData =
    hasText(ipInfo.asn?.asn) ||
    hasText(ipInfo.asn?.name) ||
    hasText(ipInfo.company?.name) ||
    hasText(ipInfo.org) ||
    hasText(abuseIpDb?.isp);
  const missingProviderData =
    ipqs?.status === "unavailable" &&
    scamalytics?.status === "unavailable" &&
    ipApiIs?.status === "unavailable";

  if (hasTorSignal) {
    addEvidence(evidence, "Tor exit signal detected");

    return createSharingRisk({
      level: "High",
      reason: "This IP is likely used by many users or services.",
      evidence,
    });
  }

  if (hasVpnProxySignal) {
    addEvidence(evidence, "VPN/proxy signal detected");

    if (hasDatacenterSignal || hasHostingSignal) {
      addEvidence(evidence, "Datacenter or hosting network");
    }

    return createSharingRisk({
      level: "High",
      reason: "VPN or proxy infrastructure is commonly shared by many users or services.",
      evidence,
    });
  }

  if ((hasDatacenterSignal || hasHostingSignal) && hasMismatchSignal) {
    addEvidence(evidence, "Datacenter or hosting network");
    addEvidence(evidence, "Network mismatch signal");

    return createSharingRisk({
      level: "High",
      reason: "Hosting infrastructure with mismatch signals is likely shared or relayed.",
      evidence,
    });
  }

  if (
    identity.networkIdentity === "Unknown" ||
    (!hasOwnershipData && missingProviderData)
  ) {
    addEvidence(evidence, "Network identity unknown");
    addEvidence(evidence, "Provider data limited");

    return createSharingRisk({
      level: "Unknown",
      reason: "Sharing level could not be confidently determined.",
      evidence,
    });
  }

  if (hasDatacenterSignal || hasHostingSignal || hasPublicOrManagedSignal) {
    if (hasDatacenterSignal) {
      addEvidence(evidence, "Datacenter network detected");
    }

    if (hasHostingSignal) {
      addEvidence(evidence, "Hosting infrastructure signal");
    }

    if (hasPublicOrManagedSignal) {
      addEvidence(evidence, "Public or managed network");
    }

    if (hasInfrastructureRoute) {
      addEvidence(evidence, "Infrastructure route detected");
    }

    return createSharingRisk({
      level: "Medium",
      reason: "Datacenter infrastructure often serves many unrelated users or services.",
      evidence,
    });
  }

  if (isResidentialOrMobile) {
    addEvidence(evidence, identity.networkIdentity);
    addEvidence(evidence, "No VPN/proxy/hosting signal");

    return createSharingRisk({
      level: "Low",
      reason: "This IP appears less likely to be heavily shared.",
      evidence,
    });
  }

  addEvidence(evidence, "No strong sharing signal detected");

  return createSharingRisk({
    level: "Low",
    reason: "This IP appears less likely to be heavily shared.",
    evidence,
  });
}
