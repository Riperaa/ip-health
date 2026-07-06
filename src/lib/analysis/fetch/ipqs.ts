import type { IpqsResponse } from "@/lib/analysis/types";

import { normalizeIpqs } from "../normalize/providers";

function createUnavailableIpqsResult(error: string): IpqsResponse {
  return {
    status: "unavailable",
    fraudScore: null,
    country: null,
    vpn: null,
    proxy: null,
    tor: null,
    bot: null,
    activeVpn: null,
    recentAbuse: null,
    error,
  };
}

export async function fetchIpqs(nextIpAddress: string) {
  const url = new URL("/api/ipqs", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return createUnavailableIpqsResult("Provider lookup failed.");
    }

    return normalizeIpqs((await response.json()) as IpqsResponse | null);
  } catch {
    return createUnavailableIpqsResult("Provider lookup failed.");
  }
}
