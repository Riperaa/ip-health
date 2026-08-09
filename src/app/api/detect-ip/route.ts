import { NextRequest, NextResponse } from "next/server";

import { getRequestPublicIpv4 } from "@/lib/request-ip";

function errorResponse() {
  return NextResponse.json(
    { error: "Unable to detect public IP" },
    { status: 400, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const ip = getRequestPublicIpv4(request);

  if (!ip) {
    return errorResponse();
  }

  return NextResponse.json(
    { ip },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
