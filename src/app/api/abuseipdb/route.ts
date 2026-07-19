import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import {
  enforceProviderRateLimit,
  getProviderCachedValue,
  providerJsonResponse,
  setProviderCachedValue,
} from "@/lib/api-protection";
import { isProviderLookupError } from "@/lib/providers/errors";
import { lookup, type ProviderResult } from "@/lib/providers/abuseipdb";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceProviderRateLimit(request, "abuseipdb");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const ip = request.nextUrl.searchParams.get("ip")?.trim();

  if (!ip) {
    return errorResponse("Missing ip query parameter.", 400);
  }

  if (!isValidIpv4Address(ip)) {
    return errorResponse("Invalid IP address", 400);
  }

  const cached = getProviderCachedValue<ProviderResult>("abuseipdb", ip);

  if (cached) {
    return providerJsonResponse(cached, "HIT");
  }

  try {
    const result = await lookup(ip);
    setProviderCachedValue("abuseipdb", ip, result);

    return providerJsonResponse(result, "MISS");
  } catch (error) {
    if (isProviderLookupError(error)) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse("Unable to fetch AbuseIPDB data.", 502);
  }
}
