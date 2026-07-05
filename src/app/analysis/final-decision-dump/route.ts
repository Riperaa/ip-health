import { NextRequest, NextResponse } from "next/server";

import {
  buildAnalysisResult,
  fetchProviderAnalysis,
} from "@/lib/analysis-engine";

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get("ip")?.trim();

  if (!ip) {
    return NextResponse.json(
      { error: "Missing ip query parameter." },
      { status: 400 },
    );
  }

  const providerResult = await fetchProviderAnalysis(ip);
  const analysisResult = buildAnalysisResult({
    providerResult,
    fallbackIpAddress: ip,
  });

  return NextResponse.json({
    finalDecision: analysisResult.finalDecision,
    serviceDecisions: analysisResult.serviceCompatibility.map((category) => ({
      category: category.category,
      services: category.services.map((service) => ({
        name: service.name,
        finalDecision: service.finalDecision,
      })),
    })),
  });
}
