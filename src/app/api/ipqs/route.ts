import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import { createUnavailableIpqsResult, lookup } from "@/lib/providers/ipqs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get("ip")?.trim();

  if (!ip) {
    return errorResponse("Missing ip query parameter.", 400);
  }

  if (!isValidIpv4Address(ip)) {
    return errorResponse("Invalid IP address", 400);
  }

  try {
    return NextResponse.json(await lookup(ip));
  } catch {
    return NextResponse.json(
      createUnavailableIpqsResult({ reason: "api_error" }),
    );
  }
}
