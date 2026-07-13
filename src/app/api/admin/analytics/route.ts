import { NextResponse, type NextRequest } from "next/server";

import {
  AnalyticsSupabaseConfigurationError,
  getAnalyticsSummary,
} from "@/lib/analytics-storage";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAnalyticsConfigured,
  isAdminRequestAuthorized,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminAnalyticsConfigured()) {
    return NextResponse.json(
      { error: "Admin analytics is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    !isAdminRequestAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      sessionCookie: request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    })
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
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
