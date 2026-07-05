import type {
  AbuseIpDbResponse,
  IpInfoResponse,
  IpqsResponse,
} from "@/lib/trust-engine";

export type AnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
};

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

  return data;
}

async function fetchAbuseIpDb(nextIpAddress: string) {
  const url = new URL("/api/abuseipdb", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AbuseIpDbResponse | null;
  } catch {
    return null;
  }
}

export async function fetchIpAnalysis(
  nextIpAddress: string,
): Promise<AnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const [ipInfo, abuseIpDb] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    ipqs: null,
  };
}

export async function fetchPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error("Unable to detect IP address.");
  }

  const data = (await response.json()) as { ip?: string };

  if (!data.ip) {
    throw new Error("Missing IP address.");
  }

  return data.ip;
}
