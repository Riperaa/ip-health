import type {
  IpApiIsResponse,
  IpApiIsUnavailableReason,
} from "@/lib/analysis/types";

import { normalizeIpApiIs } from "../normalize/providers";

const USER_SAFE_UNAVAILABLE_ERROR = "ipapi.is data is unavailable.";

function createUnavailableIpApiIsResult(
  reason: IpApiIsUnavailableReason,
): IpApiIsResponse {
  return {
    status: "unavailable",
    reason,
    providerStatus: {
      httpStatusCode: null,
      providerError: null,
    },
    vpn: null,
    proxy: null,
    tor: null,
    datacenter: null,
    hosting: null,
    asn: null,
    asnName: null,
    organization: null,
    isp: null,
    country: null,
    countryCode: null,
    region: null,
    city: null,
    abuser: null,
    companyAbuserScore: null,
    asnAbuserScore: null,
    error: USER_SAFE_UNAVAILABLE_ERROR,
  };
}

async function parseIpApiIsResponse(response: Response) {
  try {
    return (await response.json()) as IpApiIsResponse | null;
  } catch {
    return null;
  }
}

export async function fetchIpApiIs(nextIpAddress: string) {
  const url = new URL("/api/ipapi-is", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);
    const data = await parseIpApiIsResponse(response);
    const normalizedIpApiIs = normalizeIpApiIs(data);

    if (!response.ok) {
      return normalizedIpApiIs?.status === "unavailable"
        ? normalizedIpApiIs
        : createUnavailableIpApiIsResult("api_error");
    }

    return normalizedIpApiIs;
  } catch {
    return createUnavailableIpApiIsResult("network_error");
  }
}
