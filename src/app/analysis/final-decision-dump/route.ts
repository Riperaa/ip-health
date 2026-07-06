import { NextRequest, NextResponse } from "next/server";

import {
  buildAnalysisResult,
  fetchProviderAnalysis,
} from "@/lib/analysis-engine";
import {
  FINAL_DECISION_VERSION,
  normalizeFinalDecision,
} from "@/lib/analysis/final-decision";
import { isValidIpv4Address } from "@/lib/analysis/validation";

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get("ip")?.trim();
  const requestedVersion =
    request.nextUrl.searchParams.get("version")?.trim() ?? "latest";

  if (!ip) {
    return NextResponse.json(
      { error: "Missing ip query parameter." },
      { status: 400 },
    );
  }

  if (!isValidIpv4Address(ip)) {
    return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
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
      { status: 400 },
    );
  }

  const providerResult = await fetchProviderAnalysis(ip);
  const analysisResult = buildAnalysisResult({
    providerResult,
    fallbackIpAddress: ip,
  });
  const finalDecision = analysisResult.finalDecision
    ? normalizeFinalDecision(analysisResult.finalDecision)
    : null;

  return NextResponse.json({
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
  });
}
