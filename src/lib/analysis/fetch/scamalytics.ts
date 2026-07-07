import type {
  ScamalyticsResponse,
  ScamalyticsUnavailableReason,
} from "@/lib/analysis/types";

import { normalizeScamalytics } from "../normalize/providers";

const USER_SAFE_UNAVAILABLE_ERROR = "Scamalytics data is unavailable.";

function createUnavailableScamalyticsResult(
  reason: ScamalyticsUnavailableReason,
): ScamalyticsResponse {
  return {
    status: "unavailable",
    reason,
    score: null,
    risk: null,
    country: null,
    isp: null,
    proxy: null,
    vpn: null,
    tor: null,
    server: null,
    error: USER_SAFE_UNAVAILABLE_ERROR,
  };
}

async function parseScamalyticsResponse(response: Response) {
  try {
    return (await response.json()) as ScamalyticsResponse | null;
  } catch {
    return null;
  }
}

export async function fetchScamalytics(nextIpAddress: string) {
  const url = new URL("/api/scamalytics", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);
    const data = await parseScamalyticsResponse(response);
    const normalizedScamalytics = normalizeScamalytics(data);

    if (!response.ok) {
      return normalizedScamalytics?.status === "unavailable"
        ? normalizedScamalytics
        : createUnavailableScamalyticsResult("api_error");
    }

    return normalizedScamalytics;
  } catch {
    return createUnavailableScamalyticsResult("network_error");
  }
}
