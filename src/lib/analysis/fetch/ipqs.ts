import type { IpqsResponse } from "@/lib/analysis/types";
import type {
  IpqsDebugInfo,
  IpqsUnavailableReason,
} from "@/lib/providers/ipqs";

import { normalizeIpqs } from "../normalize/providers";

const USER_SAFE_UNAVAILABLE_ERROR = "IPQualityScore data is unavailable.";

function createDebugInfo(): IpqsDebugInfo {
  return {
    requestExecuted: false,
    responseStatusCode: null,
    success: null,
    message: null,
  };
}

function createUnavailableIpqsResult(
  reason: IpqsUnavailableReason,
): IpqsResponse {
  return {
    status: "unavailable",
    reason,
    fraudScore: null,
    country: null,
    vpn: null,
    proxy: null,
    tor: null,
    bot: null,
    activeVpn: null,
    recentAbuse: null,
    debug: createDebugInfo(),
    error: USER_SAFE_UNAVAILABLE_ERROR,
  };
}

async function parseIpqsResponse(response: Response) {
  try {
    return (await response.json()) as IpqsResponse | null;
  } catch {
    return null;
  }
}

export async function fetchIpqs(nextIpAddress: string) {
  const url = new URL("/api/ipqs", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);
    const data = await parseIpqsResponse(response);
    const normalizedIpqs = normalizeIpqs(data);

    if (!response.ok) {
      return normalizedIpqs?.status === "unavailable"
        ? normalizedIpqs
        : createUnavailableIpqsResult("api_error");
    }

    return normalizedIpqs;
  } catch {
    return createUnavailableIpqsResult("network_error");
  }
}
