import { NextResponse } from "next/server";

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
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
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
  if (!isRecord(body) || !hasOnlyKeys(body, ["name", "payload", "timestamp"])) {
    return null;
  }

  if (
    !isAllowedAnalyticsEventName(body.name) ||
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

  const record = buildAnalyticsRecord(body);

  if (!record) {
    console.error("[analytics] invalid analytics event payload");
    logAnalyticsResponse(400);

    return NextResponse.json(
      { error: "Invalid analytics event" },
      { status: 400 },
    );
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
