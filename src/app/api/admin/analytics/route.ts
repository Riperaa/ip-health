import { NextResponse, type NextRequest } from "next/server";

import {
  AnalyticsSupabaseConfigurationError,
  getAnalyticsSummary,
} from "@/lib/analytics-storage";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;

  if (!adminToken) {
    return true;
  }

  return request.nextUrl.searchParams.get("token") === adminToken;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const summary = await getAnalyticsSummary();

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AnalyticsSupabaseConfigurationError) {
      return NextResponse.json(
        { error: "Analytics storage is not configured" },
        { status: 503 },
      );
    }

    console.error("[admin analytics] summary failed", error);

    return NextResponse.json(
      { error: "Unable to load analytics summary" },
      { status: 500 },
    );
  }
}
