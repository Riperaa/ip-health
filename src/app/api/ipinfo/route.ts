import { NextRequest, NextResponse } from "next/server";

import { isValidIpv4Address } from "@/lib/analysis/validation";
import { lookupWithStatus } from "@/lib/providers/ipinfo";

export async function GET(request: NextRequest) {
  const ipQuery = request.nextUrl.searchParams.get("ip");
  const ip = ipQuery?.trim();

  if (ipQuery !== null && (!ip || !isValidIpv4Address(ip))) {
    return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
  }

  const { data, status } = await lookupWithStatus(ip || undefined);

  return NextResponse.json(data, { status });
}
