import { NextRequest, NextResponse } from "next/server";

import { buildAnalysisResult } from "@/lib/analysis-engine";
import { fetchServerProviderAnalysis } from "@/lib/analysis/server-provider-analysis";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAnalyticsConfigured,
  isAdminRequestAuthorized,
} from "@/lib/admin-auth";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/api-protection";
import {
  FINAL_DECISION_VERSION,
  normalizeFinalDecision,
} from "@/lib/analysis/final-decision";
import { isValidIpv4Address } from "@/lib/analysis/validation";

export const dynamic = "force-dynamic";

const protectedResponseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit({
    request,
    namespace: "analysis:final-decision-dump",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          ...getRateLimitHeaders(rateLimit),
          ...protectedResponseHeaders,
        },
      },
    );
  }

  if (
    !isAdminAnalyticsConfigured() ||
    !isAdminRequestAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      sessionCookie: request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    })
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: protectedResponseHeaders },
    );
  }

  const ip = request.nextUrl.searchParams.get("ip")?.trim();
  const requestedVersion =
    request.nextUrl.searchParams.get("version")?.trim() ?? "latest";

  if (!ip) {
    return NextResponse.json(
      { error: "Missing ip query parameter." },
      { status: 400, headers: protectedResponseHeaders },
    );
  }

  if (!isValidIpv4Address(ip)) {
    return NextResponse.json(
      { error: "Invalid IP address" },
      { status: 400, headers: protectedResponseHeaders },
    );
  }

  if (
    requestedVersion !== "latest" &&
    requestedVersion !== FINAL_DECISION_VERSION
  ) {
    return NextResponse.json(
      {
        error: "Unsupported FinalDecision version.",
        latestVersion: FINAL_DECISION_VERSION,
      },
      { status: 400, headers: protectedResponseHeaders },
    );
  }

  const providerResult = await fetchServerProviderAnalysis(ip);
  const analysisResult = buildAnalysisResult({
    providerResult,
    fallbackIpAddress: ip,
  });
  const finalDecision = analysisResult.finalDecision
    ? normalizeFinalDecision(analysisResult.finalDecision)
    : null;

  return NextResponse.json(
    {
      requestedVersion,
      latestVersion: FINAL_DECISION_VERSION,
      finalDecision,
      serviceDecisions: analysisResult.serviceCompatibility.map((category) => ({
        category: category.category,
        services: category.services.map((service) => ({
          name: service.name,
          finalDecision: normalizeFinalDecision(service.finalDecision),
        })),
      })),
    },
    { headers: protectedResponseHeaders },
  );
}
