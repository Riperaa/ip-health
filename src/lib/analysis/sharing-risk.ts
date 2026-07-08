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

function isResidentialOrMobileIdentity(identity: EndUserReport["identity"]) {
  return (
    identity.networkIdentity === "Residential ISP" ||
    identity.networkIdentity === "Mobile Network"
  );
}

function isHostedInfrastructureIdentity(identity: EndUserReport["identity"]) {
  return (
    identity.networkIdentity === "Cloud Provider" ||
    identity.networkIdentity === "Datacenter"
  );
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
  const toneByLevel: Record<
    SharingRiskLevel,
    EndUserReport["sharingRisk"]["tone"]
  > = {
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
  const hasStrongVpnProxySignal =
    privacy?.vpn === true ||
    privacy?.proxy === true ||
    privacy?.relay === true ||
    ipqs?.vpn === true ||
    ipqs?.activeVpn === true ||
    ipqs?.proxy === true ||
    ipApiIs?.vpn === true ||
    ipApiIs?.proxy === true ||
    isCloudflareWarpOn(cloudflare);
  const hasReviewVpnProxySignal =
    scamalytics?.vpn === true || scamalytics?.proxy === true;
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
      reason:
        "Tor exit traffic is high risk and is not recommended for account registration, verification, banking, payments, or sensitive login.",
      evidence,
    });
  }

  if (hasStrongVpnProxySignal) {
    addEvidence(evidence, "Strong VPN/proxy signal confirmed");

    if (hasDatacenterSignal || hasHostingSignal) {
      addEvidence(evidence, "Datacenter or hosting network");
    }

    return createSharingRisk({
      level: "High",
      reason:
        "VPN or proxy infrastructure is commonly shared by many users or services.",
      evidence,
    });
  }

  if (hasReviewVpnProxySignal) {
    addEvidence(evidence, "Secondary privacy review signal");
  }

  if ((hasDatacenterSignal || hasHostingSignal) && hasMismatchSignal) {
    if (isResidentialOrMobileIdentity(identity)) {
      addEvidence(evidence, "Minor review signal");
    } else if (identity.networkIdentity === "Enterprise Network") {
      addEvidence(evidence, "Enterprise network");
    } else if (identity.networkIdentity === "Public Infrastructure") {
      addEvidence(evidence, "Public or edge infrastructure");
    } else {
      addEvidence(evidence, "Datacenter or hosting network");
    }

    addEvidence(evidence, "Network mismatch signal");

    if (isResidentialOrMobileIdentity(identity)) {
      return createSharingRisk({
        level: "Low",
        reason:
          "This appears to be a normal access network. Some checks may require review, but no strong sharing signal is confirmed.",
        evidence,
      });
    }

    if (identity.networkIdentity === "Enterprise Network") {
      return createSharingRisk({
        level: "Medium",
        reason:
          "Enterprise networks are often clean, but some platforms may apply extra checks because traffic comes from a large organization or shared corporate network.",
        evidence,
      });
    }

    if (identity.networkIdentity === "Public Infrastructure") {
      return createSharingRisk({
        level: "Medium",
        reason:
          "Public DNS, CDN, and edge infrastructure is normal for services, but it is not ideal as a personal browsing or account registration IP.",
        evidence,
      });
    }

    if (isHostedInfrastructureIdentity(identity)) {
      return createSharingRisk({
        level: "High",
        reason:
          "Hosted infrastructure with mismatch signals is likely shared or relayed.",
        evidence,
      });
    }

    return createSharingRisk({
      level: "High",
      reason:
        "Hosting infrastructure with mismatch signals is likely shared or relayed.",
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

    if (isResidentialOrMobileIdentity(identity)) {
      return createSharingRisk({
        level: "Low",
        reason:
          "This appears to be a normal access network. Minor review signals may still require extra checks on stricter platforms.",
        evidence,
      });
    }

    if (identity.networkIdentity === "Enterprise Network") {
      return createSharingRisk({
        level: "Medium",
        reason:
          "Enterprise networks are often clean, but some platforms may apply extra checks because traffic comes from a large organization or shared corporate network.",
        evidence,
      });
    }

    if (identity.networkIdentity === "Public Infrastructure") {
      return createSharingRisk({
        level: "Medium",
        reason:
          "Public DNS, CDN, and edge infrastructure is normal for services, but it is not ideal as a personal browsing or account registration IP.",
        evidence,
      });
    }

    if (isHostedInfrastructureIdentity(identity)) {
      return createSharingRisk({
        level: "Medium",
        reason:
          "Reputation may be clean, but hosted infrastructure is often treated as less trustworthy than residential ISP traffic.",
        evidence,
      });
    }

    return createSharingRisk({
      level: "Medium",
      reason:
        "Datacenter infrastructure often serves many unrelated users or services.",
      evidence,
    });
  }

  if (isResidentialOrMobile) {
    addEvidence(evidence, identity.networkIdentity);
    addEvidence(evidence, "No strong privacy or infrastructure signal");

    return createSharingRisk({
      level: "Low",
      reason:
        "This looks like a normal access network and is less likely to be heavily shared.",
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
