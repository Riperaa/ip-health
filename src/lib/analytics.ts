"use client";

import type {
  AnalysisResult,
  IpQualityConfidence,
  NetworkIdentityCategory,
} from "@/lib/analysis";

type AnalyticsEventName =
  | "analyze_started"
  | "analyze_completed"
  | "compare_started"
  | "feedback_helpful"
  | "feedback_not_helpful";

type AnalyticsEventPayload = {
  analyze_started: Record<string, never>;
  analyze_completed: AnalysisContext & {
    success: boolean;
  };
  compare_started: Record<string, never>;
  feedback_helpful: AnalysisContext;
  feedback_not_helpful: AnalysisContext & {
    reason: FeedbackReason;
  };
};

export type AnalyticsEvent = {
  [EventName in AnalyticsEventName]: {
    name: EventName;
    payload: AnalyticsEventPayload[EventName];
    timestamp: string;
  };
}[AnalyticsEventName];

export type AnalyticsProvider = {
  track: (event: AnalyticsEvent) => void | Promise<void>;
};

export type AnalysisContext = {
  networkIdentityCategory: NetworkIdentityCategory;
  countryCode: string;
  evidenceQuality: IpQualityConfidence;
};

export type FeedbackReason =
  | "Wrong IP type"
  | "Wrong location"
  | "Score not convincing"
  | "Missing information"
  | "Other";

const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;

const noopAnalyticsProvider: AnalyticsProvider = {
  track: () => undefined,
};

const endpointAnalyticsProvider: AnalyticsProvider = {
  async track(event) {
    if (!ANALYTICS_ENDPOINT) {
      return;
    }

    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify(event),
    });
  },
};

let analyticsProvider: AnalyticsProvider = ANALYTICS_ENDPOINT
  ? endpointAnalyticsProvider
  : noopAnalyticsProvider;

export function setAnalyticsProvider(provider: AnalyticsProvider) {
  analyticsProvider = provider;
}

export function trackAnalyticsEvent<EventName extends AnalyticsEventName>(
  name: EventName,
  payload: AnalyticsEventPayload[EventName],
) {
  const event = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  } as AnalyticsEvent;

  void Promise.resolve(analyticsProvider.track(event)).catch(() => {
    // Analytics must never interrupt the user flow.
  });
}

export function getAnalysisContext(
  result: AnalysisResult | null | undefined,
): AnalysisContext {
  return {
    networkIdentityCategory:
      result?.endUserReport.identity.networkIdentity ?? "Unknown",
    countryCode: normalizeCountryCode(
      result?.endUserReport.location.countryCode,
    ),
    evidenceQuality: result?.qualityReport.dataQuality.level ?? "Pending",
  };
}

function normalizeCountryCode(countryCode?: string | null) {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();

  if (!normalizedCountryCode || normalizedCountryCode === "NOT IDENTIFIED") {
    return "Unknown";
  }

  return normalizedCountryCode;
}
