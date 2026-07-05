import type {
  AbuseIpDbResponse,
  CloudflareTraceResponse,
  IpInfoResponse,
  IpqsResponse,
} from "@/lib/trust-engine";

export type AnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  ipqs: IpqsResponse | null;
};

function normalizeIpInfo(
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

function normalizeAbuseIpDb(
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

function normalizeCloudflareTrace(
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

async function fetchIpInfo(nextIpAddress?: string) {
  const url = new URL("/api/ipinfo", window.location.origin);

  if (nextIpAddress) {
    url.searchParams.set("ip", nextIpAddress);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to fetch IP information.");
  }

  const data = (await response.json()) as IpInfoResponse;

  if (!data) {
    throw new Error("IP information was unavailable.");
  }

  return normalizeIpInfo(data, nextIpAddress);
}

async function fetchAbuseIpDb(nextIpAddress: string) {
  const url = new URL("/api/abuseipdb", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return normalizeAbuseIpDb(
      (await response.json()) as AbuseIpDbResponse | null,
    );
  } catch {
    return null;
  }
}

async function fetchCloudflareTrace() {
  try {
    const response = await fetch("/api/cloudflare");

    if (!response.ok) {
      return null;
    }

    return normalizeCloudflareTrace(
      (await response.json()) as CloudflareTraceResponse,
    );
  } catch {
    return null;
  }
}

async function fetchDetectedIp() {
  try {
    const response = await fetch("/api/detect-ip");

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { ip?: string | null };
    const ip = data.ip?.trim();

    return ip || null;
  } catch {
    return null;
  }
}

async function fetchIpifyPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error("Missing IP address.");
  }

  const data = (await response.json()) as { ip?: string | null };
  const ip = data.ip?.trim();

  if (!ip) {
    throw new Error("Missing IP address.");
  }

  return ip;
}

export async function fetchIpAnalysis(
  nextIpAddress: string,
): Promise<AnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const [ipInfo, abuseIpDb, cloudflare] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
    fetchCloudflareTrace(),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare,
    ipqs: null,
  };
}

export async function fetchPublicIp() {
  const [detectedIp, cloudflare] = await Promise.all([
    fetchDetectedIp(),
    fetchCloudflareTrace(),
  ]);
  const mergedIp = detectedIp ?? cloudflare?.ip?.trim() ?? null;

  if (mergedIp) {
    return mergedIp;
  }

  return fetchIpifyPublicIp();
}
