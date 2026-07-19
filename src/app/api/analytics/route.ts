import { NextResponse } from "next/server";

import {
  checkRateLimit,
  getRateLimitHeaders,
  registerIdempotencyKey,
} from "@/lib/api-protection";
import {
  getAnalyticsSupabaseEnvStatus,
  insertAnalyticsEvent,
  isAllowedAnalyticsEventName,
  isAllowedCountryCode,
  isAllowedEvidenceQuality,
  isAllowedFeedbackReason,
  isAllowedNetworkIdentityCategory,
  type AnalyticsEventRecord,
  type AnalyticsEventName,
  type AnalyticsEvidenceQuality,
  type AnalyticsNetworkIdentityCategory,
} from "@/lib/analytics-storage";

type AnalysisContext = {
  networkIdentityCategory: AnalyticsNetworkIdentityCategory;
  countryCode: string;
  evidenceQuality: AnalyticsEvidenceQuality;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isAllowedTimestamp(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return false;
  }

  const timestamp = new Date(value);
  const skewMs = Math.abs(Date.now() - timestamp.getTime());

  return timestamp.toISOString() === value && skewMs <= 10 * 60 * 1000;
}

function isAllowedEventId(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isAllowedAnalysisContext(
  payload: Record<string, unknown>,
): payload is AnalysisContext {
  return (
    isAllowedNetworkIdentityCategory(payload.networkIdentityCategory) &&
    isAllowedCountryCode(payload.countryCode) &&
    isAllowedEvidenceQuality(payload.evidenceQuality)
  );
}

function buildAnalyticsRecord(body: unknown): AnalyticsEventRecord | null {
  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, ["eventId", "name", "payload", "timestamp"])
  ) {
    return null;
  }

  if (
    !isAllowedAnalyticsEventName(body.name) ||
    !isAllowedEventId(body.eventId) ||
    !isAllowedTimestamp(body.timestamp) ||
    !isRecord(body.payload)
  ) {
    return null;
  }

  const eventName: AnalyticsEventName = body.name;

  if (eventName === "analyze_started" || eventName === "compare_started") {
    if (!hasOnlyKeys(body.payload, [])) {
      return null;
    }

    return {
      event_name: eventName,
      success: null,
      country_code: null,
      network_identity_category: null,
      evidence_quality: null,
      feedback_reason: null,
    };
  }

  if (eventName === "analyze_completed") {
    const success = body.payload.success;

    if (
      !hasOnlyKeys(body.payload, [
        "success",
        "networkIdentityCategory",
        "countryCode",
        "evidenceQuality",
      ]) ||
      typeof success !== "boolean" ||
      !isAllowedAnalysisContext(body.payload)
    ) {
      return null;
    }

    return {
      event_name: eventName,
      success,
      country_code: body.payload.countryCode,
      network_identity_category: body.payload.networkIdentityCategory,
      evidence_quality: body.payload.evidenceQuality,
      feedback_reason: null,
    };
  }

  if (eventName === "feedback_helpful") {
    if (
      !hasOnlyKeys(body.payload, [
        "networkIdentityCategory",
        "countryCode",
        "evidenceQuality",
      ]) ||
      !isAllowedAnalysisContext(body.payload)
    ) {
      return null;
    }

    return {
      event_name: eventName,
      success: null,
      country_code: body.payload.countryCode,
      network_identity_category: body.payload.networkIdentityCategory,
      evidence_quality: body.payload.evidenceQuality,
      feedback_reason: null,
    };
  }

  const reason = body.payload.reason;

  if (
    !hasOnlyKeys(body.payload, [
      "networkIdentityCategory",
      "countryCode",
      "evidenceQuality",
      "reason",
    ]) ||
    !isAllowedAnalysisContext(body.payload) ||
    !isAllowedFeedbackReason(reason)
  ) {
    return null;
  }

  return {
    event_name: eventName,
    success: null,
    country_code: body.payload.countryCode,
    network_identity_category: body.payload.networkIdentityCategory,
    evidence_quality: body.payload.evidenceQuality,
    feedback_reason: reason,
  };
}

function logAnalyticsResponse(status: number) {
  console.info("[analytics] returning response", { status });
}

export async function POST(request: Request) {
  let body: unknown;

  const rateLimit = checkRateLimit({
    request,
    namespace: "analytics",
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many analytics events" },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return NextResponse.json(
      { error: "Analytics event is too large" },
      { status: 413 },
    );
  }

  console.info("[analytics] request received", {
    method: request.method,
    path: "/api/analytics",
  });
  console.info("[analytics] Supabase environment variables", {
    ...getAnalyticsSupabaseEnvStatus(),
  });

  try {
    body = await request.json();
  } catch (error) {
    console.error("[analytics] invalid request body", error);
    logAnalyticsResponse(400);

    return NextResponse.json(
      { error: "Invalid analytics event" },
      { status: 400 },
    );
  }

  if (isRecord(body) && body.qaMode === true) {
    console.info("[analytics] QA event skipped");
    logAnalyticsResponse(202);

    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const record = buildAnalyticsRecord(body);

  if (!record) {
    console.error("[analytics] invalid analytics event payload");
    logAnalyticsResponse(400);

    return NextResponse.json(
      { error: "Invalid analytics event" },
      { status: 400 },
    );
  }

  const eventId = isRecord(body) ? body.eventId : null;

  if (
    typeof eventId !== "string" ||
    !registerIdempotencyKey("analytics", eventId, 24 * 60 * 60 * 1000)
  ) {
    logAnalyticsResponse(202);

    return NextResponse.json({ ok: true }, { status: 202 });
  }

  try {
    await insertAnalyticsEvent(record);
  } catch (error) {
    console.error("[analytics] Supabase insert failed", error);
    logAnalyticsResponse(202);

    return NextResponse.json({ ok: true }, { status: 202 });
  }

  console.info("[analytics] Supabase insert succeeded", {
    eventName: record.event_name,
  });
  logAnalyticsResponse(202);

  return NextResponse.json({ ok: true }, { status: 202 });
}
