import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import {
  enforceProviderRateLimit,
  getProviderCachedValue,
  providerJsonResponse,
  setProviderCachedValue,
} from "@/lib/api-protection";
import {
  createUnavailableScamalyticsResult,
  lookup,
  type ProviderResult,
} from "@/lib/providers/scamalytics";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceProviderRateLimit(request, "scamalytics");

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

  const cached = getProviderCachedValue<ProviderResult>("scamalytics", ip);

  if (cached) {
    return providerJsonResponse(cached, "HIT");
  }

  try {
    const result = await lookup(ip);
    setProviderCachedValue("scamalytics", ip, result);

    return providerJsonResponse(result, "MISS");
  } catch {
    return NextResponse.json(
      createUnavailableScamalyticsResult({ reason: "api_error" }),
    );
  }
}
