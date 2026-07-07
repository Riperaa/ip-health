import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  IpInfoResponse,
  IpqsResponse,
  ProviderAnalysisResult,
  ScamalyticsResponse,
} from "@/lib/analysis/types";

export const EMPTY_IP_INFO: IpInfoResponse = {
  ip: "",
  asn: {},
  company: {},
  privacy: {},
};

export function normalizeIpInfo(
  data: IpInfoResponse,
  fallbackIpAddress?: string,
): IpInfoResponse {
  return {
    ...data,
    ip: data.ip || fallbackIpAddress || "",
    asn: data.asn ?? {},
    company: data.company ?? {},
    privacy: data.privacy ?? {},
  };
}

export function normalizeAbuseIpDb(
  data: AbuseIpDbResponse | null,
): AbuseIpDbResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    abuseConfidence: data.abuseConfidence ?? null,
    usageType: data.usageType ?? null,
    isp: data.isp ?? null,
    domain: data.domain ?? null,
    isWhitelisted: data.isWhitelisted ?? null,
  };
}

export function normalizeCloudflareTrace(
  data: CloudflareTraceResponse | null,
): CloudflareTraceResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    ip: data.ip ?? null,
    colo: data.colo ?? null,
    country: data.country ?? null,
    warp: data.warp ?? null,
    raw: data.raw ?? {},
  };
}

export function normalizeIpqs(data: IpqsResponse | null): IpqsResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    status: data.status ?? "available",
    fraudScore: data.fraudScore ?? null,
    country: data.country ?? null,
    vpn: data.vpn ?? null,
    proxy: data.proxy ?? null,
    tor: data.tor ?? null,
    bot: data.bot ?? null,
    activeVpn: data.activeVpn ?? null,
    recentAbuse: data.recentAbuse ?? null,
  };
}

export function normalizeScamalytics(
  data: ScamalyticsResponse | null,
): ScamalyticsResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    status: data.status ?? "available",
    score: data.score ?? null,
    risk: data.risk ?? null,
    country: data.country ?? null,
    isp: data.isp ?? null,
    proxy: data.proxy ?? null,
    vpn: data.vpn ?? null,
    tor: data.tor ?? null,
    server: data.server ?? null,
  };
}

export function normalizeProviderAnalysisResult(
  result: ProviderAnalysisResult | null,
  fallbackIpAddress: string,
): ProviderAnalysisResult {
  const ipInfo = result?.ipInfo ?? EMPTY_IP_INFO;

  return {
    ipInfo: normalizeIpInfo(ipInfo, fallbackIpAddress),
    abuseIpDb: normalizeAbuseIpDb(result?.abuseIpDb ?? null),
    cloudflare: normalizeCloudflareTrace(result?.cloudflare ?? null),
    ipqs: normalizeIpqs(result?.ipqs ?? null),
    scamalytics: normalizeScamalytics(result?.scamalytics ?? null),
  };
}
