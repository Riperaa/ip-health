import type { AbuseIpDbResponse } from "@/lib/analysis/types";

import { normalizeAbuseIpDb } from "../normalize/providers";

export async function fetchAbuseIpDb(nextIpAddress: string) {
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
