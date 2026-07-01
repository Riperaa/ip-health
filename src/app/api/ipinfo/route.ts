import { NextRequest, NextResponse } from "next/server";

import { lookupWithStatus } from "@/lib/providers/ipinfo";

export async function GET(request: NextRequest) {
  const ip = request.nextUrl.searchParams.get("ip")?.trim();
  const { data, status } = await lookupWithStatus(ip || undefined);

  return NextResponse.json(data, { status });
}
