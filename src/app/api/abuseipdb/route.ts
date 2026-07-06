import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import { isProviderLookupError } from "@/lib/providers/errors";
import { lookup } from "@/lib/providers/abuseipdb";

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
  } catch (error) {
    if (isProviderLookupError(error)) {
      if (error.raw !== undefined) {
        return NextResponse.json(
          { error: error.message, raw: error.raw },
          { status: error.status },
        );
      }

      return errorResponse(error.message, error.status);
    }

    return errorResponse("Unable to fetch AbuseIPDB data.", 502);
  }
}
