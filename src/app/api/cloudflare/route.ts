import { NextResponse, type NextRequest } from "next/server";

import {
  getCloudflareColo,
  getRequestCountry,
  getRequestIp,
} from "@/lib/request-ip";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);

  if (!ip) {
    return errorResponse("Unable to identify the client network.", 400);
  }

  return NextResponse.json(
    {
      ip,
      colo: getCloudflareColo(request),
      country: getRequestCountry(request),
      warp: null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
