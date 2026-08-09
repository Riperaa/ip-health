import { NextResponse, type NextRequest } from "next/server";

import { getRequestCountry, getRequestIp } from "@/lib/request-ip";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);

  if (!ip) {
    return errorResponse("Unable to identify the client network.", 400);
  }

  return NextResponse.json(
    {
      ip,
      colo: null,
      country: getRequestCountry(request),
      warp: null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
