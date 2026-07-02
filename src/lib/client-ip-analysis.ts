import type {
  AbuseIpDbResponse,
  IpInfoResponse,
  IpqsResponse,
} from "@/lib/trust-engine";

export type ReputationSourceStatus =
  | "Available"
  | "Unavailable"
  | "Not configured"
  | "Error";

export type ReputationSourceKey = "ipinfo" | "abuseipdb" | "ipqs";

export type ReputationSourceStatuses = Record<
  ReputationSourceKey,
  ReputationSourceStatus
>;

export type AnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
  sourceStatuses: ReputationSourceStatuses;
};

type OptionalProviderResult<T> = {
  data: T | null;
  status: ReputationSourceStatus;
};

async function parseErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown };

    return typeof data.error === "string" ? data.error : "";
  } catch {
    return "";
  }
}

function getUnavailableProviderStatus(message: string): ReputationSourceStatus {
  if (message.toLowerCase().includes("api key is not configured")) {
    return "Not configured";
  }

  return message ? "Error" : "Unavailable";
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

  return data;
}

async function fetchAbuseIpDb(
  nextIpAddress: string,
): Promise<OptionalProviderResult<AbuseIpDbResponse>> {
  const url = new URL("/api/abuseipdb", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        data: null,
        status: getUnavailableProviderStatus(await parseErrorMessage(response)),
      };
    }

    const data = (await response.json()) as AbuseIpDbResponse | null;

    return {
      data,
      status: data ? "Available" : "Unavailable",
    };
  } catch {
    return { data: null, status: "Error" };
  }
}

async function fetchIpqs(
  nextIpAddress: string,
): Promise<OptionalProviderResult<IpqsResponse>> {
  const url = new URL("/api/ipqs", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        data: null,
        status: getUnavailableProviderStatus(await parseErrorMessage(response)),
      };
    }

    const data = (await response.json()) as IpqsResponse | null;

    return {
      data,
      status: data ? "Available" : "Unavailable",
    };
  } catch {
    return { data: null, status: "Error" };
  }
}

export async function fetchIpAnalysis(
  nextIpAddress: string,
): Promise<AnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const [ipInfo, abuseIpDb, ipqs] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
    fetchIpqs(trimmedIpAddress),
  ]);

  return {
    ipInfo,
    abuseIpDb: abuseIpDb.data,
    ipqs: ipqs.data,
    sourceStatuses: {
      ipinfo: "Available",
      abuseipdb: abuseIpDb.status,
      ipqs: ipqs.status,
    },
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
