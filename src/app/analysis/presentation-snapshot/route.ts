import { NextRequest, NextResponse } from "next/server";

import {
  buildAnalysisResult,
  fetchProviderAnalysis,
} from "@/lib/analysis-engine";
import { buildPresentationSnapshot } from "@/lib/analysis/final-decision";

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
