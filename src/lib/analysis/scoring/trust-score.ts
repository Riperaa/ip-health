import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  IpInfoResponse,
  IpqsResponse,
  ScamalyticsResponse,
} from "@/lib/analysis/types";

import { parseOrg } from "../normalize/common";

function isInfrastructureUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase() ?? "";

  return (
    normalized.includes("data center") ||
    normalized.includes("web hosting") ||
    normalized.includes("transit") ||
    normalized.includes("hosting") ||
    normalized.includes("infrastructure") ||
    normalized.includes("cloud")
  );
}

function normalizeIpAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isCloudflareWarpOn(cloudflare?: CloudflareTraceResponse | null) {
  return cloudflare?.warp?.trim().toLowerCase() === "on";
}

function hasCloudflareTraceMatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = normalizeIpAddress(cloudflare?.ip);
  const ipInfoIp = normalizeIpAddress(ipInfo.ip);

  return Boolean(traceIp && ipInfoIp && traceIp === ipInfoIp);
}

function hasCloudflareTraceMismatch(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  const traceIp = normalizeIpAddress(cloudflare?.ip);
  const ipInfoIp = normalizeIpAddress(ipInfo.ip);

  return Boolean(traceIp && ipInfoIp && traceIp !== ipInfoIp);
}

function hasCloudflareColoSignal(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return Boolean(
    cloudflare?.colo?.trim() && hasCloudflareTraceMatch(ipInfo, cloudflare),
  );
}

function getAbuseIpDbPenalties(abuseIpDb?: AbuseIpDbResponse | null) {
  if (!abuseIpDb) {
    return [];
  }

  const abuseConfidence = abuseIpDb.abuseConfidence ?? null;

  return [
    abuseConfidence !== null && abuseConfidence >= 80 ? 30 : 0,
    abuseConfidence !== null && abuseConfidence >= 50 && abuseConfidence < 80
      ? 15
      : 0,
    isInfrastructureUsage(abuseIpDb.usageType) ? 20 : 0,
  ];
}

function getIpqsPenalties(ipqs?: IpqsResponse | null) {
  if (!ipqs) {
    return [];
  }

  const fraudScore = ipqs.fraudScore ?? null;

  return [
    fraudScore !== null && fraudScore >= 85 ? 30 : 0,
    fraudScore !== null && fraudScore >= 60 && fraudScore < 85 ? 20 : 0,
    ipqs.vpn === true ? 25 : 0,
    ipqs.proxy === true ? 25 : 0,
  ];
}

function getScamalyticsPenalties(scamalytics?: ScamalyticsResponse | null) {
  if (!scamalytics || scamalytics.status === "unavailable") {
    return [];
  }

  const score = scamalytics.score ?? null;

  return [
    score !== null && score >= 85 ? 30 : 0,
    score !== null && score >= 60 && score < 85 ? 20 : 0,
    scamalytics.vpn === true ? 20 : 0,
    scamalytics.proxy === true ? 20 : 0,
    scamalytics.tor === true ? 35 : 0,
    scamalytics.server === true ? 15 : 0,
  ];
}

function getCloudflarePenalties(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
) {
  if (!cloudflare) {
    return [];
  }

  return [
    isCloudflareWarpOn(cloudflare) ? 25 : 0,
    hasCloudflareTraceMismatch(ipInfo, cloudflare) ? 15 : 0,
    hasCloudflareColoSignal(ipInfo, cloudflare) ? 10 : 0,
  ];
}

function getIpInfoSignals(ipInfo: IpInfoResponse) {
  const parsedOrg = parseOrg(ipInfo.org);

  return {
    hasAsn: Boolean(ipInfo.asn?.asn ?? parsedOrg.asn),
    hasIspOrOrg: Boolean(
      ipInfo.company?.name ?? ipInfo.asn?.name ?? parsedOrg.name ?? ipInfo.org,
    ),
  };
}

export function calculateTrustScore(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
  scamalytics?: ScamalyticsResponse | null,
) {
  const { hasAsn, hasIspOrOrg } = getIpInfoSignals(ipInfo);
  const privacy = ipInfo.privacy;
  const penalties = [
    privacy?.hosting === true ? 20 : 0,
    privacy?.vpn === true ? 25 : 0,
    privacy?.proxy === true ? 25 : 0,
    privacy?.tor === true ? 40 : 0,
    privacy?.relay === true ? 15 : 0,
    hasAsn ? 0 : 10,
    hasIspOrOrg ? 0 : 5,
    ...getAbuseIpDbPenalties(abuseIpDb),
    ...getIpqsPenalties(ipqs),
    ...getScamalyticsPenalties(scamalytics),
    ...getCloudflarePenalties(ipInfo, cloudflare),
  ];

  return Math.max(
    0,
    Math.min(
      100,
      100 - penalties.reduce((total, penalty) => total + penalty, 0),
    ),
  );
}
