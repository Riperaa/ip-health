import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import {
  enforceProviderRateLimit,
  getProviderCachedValue,
  providerJsonResponse,
  setProviderCachedValue,
} from "@/lib/api-protection";
import { lookupWithStatus, type ProviderResult } from "@/lib/providers/ipinfo";

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceProviderRateLimit(request, "ipinfo");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const ipQuery = request.nextUrl.searchParams.get("ip");
  const ip = ipQuery?.trim();

  if (ipQuery !== null && (!ip || !isValidIpv4Address(ip))) {
    return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
  }

  const cached = getProviderCachedValue<ProviderResult>("ipinfo", ip);

  if (cached) {
    return providerJsonResponse(cached, "HIT");
  }

  const { data, status } = await lookupWithStatus(ip || undefined);

  if (status >= 200 && status < 300) {
    setProviderCachedValue("ipinfo", ip, data);

    return providerJsonResponse(data, "MISS");
  }

  return NextResponse.json(data, { status });
}
