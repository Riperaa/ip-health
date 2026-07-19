import { NextRequest, NextResponse } from "next/server";

import { buildAnalysisResult } from "@/lib/analysis-engine";
import { fetchServerProviderAnalysis } from "@/lib/analysis/server-provider-analysis";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/api-protection";
import { buildPresentationSnapshot } from "@/lib/analysis/final-decision";
import { isValidIpv4Address } from "@/lib/analysis/validation";

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit({
    request,
    namespace: "analysis:presentation-snapshot",
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const ip = request.nextUrl.searchParams.get("ip")?.trim();

  if (!ip) {
    return NextResponse.json(
      { error: "Missing ip query parameter." },
      { status: 400 },
    );
  }

  if (!isValidIpv4Address(ip)) {
    return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
  }

  const providerResult = await fetchServerProviderAnalysis(ip);
  const analysisResult = buildAnalysisResult({
    providerResult,
    fallbackIpAddress: ip,
  });
  const finalDecisionSnapshot = analysisResult.finalDecision
    ? buildPresentationSnapshot(analysisResult.finalDecision)
    : null;
  const serviceSnapshots = analysisResult.serviceCompatibility.map(
    (category) => ({
      category: category.category,
      services: category.services.map((service) => ({
        name: service.name,
        snapshot: buildPresentationSnapshot(service.finalDecision),
      })),
    }),
  );

  return NextResponse.json({
    consistent:
      Boolean(finalDecisionSnapshot?.consistent) &&
      serviceSnapshots.every((category) =>
        category.services.every((service) => service.snapshot.consistent),
      ),
    finalDecisionSnapshot,
    serviceSnapshots,
  });
}
