"use client";

import { useEffect, useState } from "react";

import {
  type AnalysisContext,
  type FeedbackReason,
  trackAnalyticsEvent,
} from "@/lib/analytics";

const negativeReasons: FeedbackReason[] = [
  "Wrong IP type",
  "Wrong location",
  "Score not convincing",
  "Missing information",
  "Other",
];

type FeedbackState = "idle" | "helpful" | "not-helpful";

export function ResultFeedback({ context }: { context: AnalysisContext }) {
  const [feedbackState, setFeedbackState] =
    useState<FeedbackState>("idle");
  const [selectedReason, setSelectedReason] =
    useState<FeedbackReason | null>(null);

  useEffect(() => {
    setFeedbackState("idle");
    setSelectedReason(null);
  }, [
    context.countryCode,
    context.evidenceQuality,
    context.networkIdentityCategory,
  ]);

  function handleHelpfulClick() {
    setFeedbackState("helpful");
    setSelectedReason(null);
    trackAnalyticsEvent("feedback_helpful", context);
  }

  function handleNotHelpfulClick() {
    setFeedbackState("not-helpful");
  }

  function handleReasonClick(reason: FeedbackReason) {
    setSelectedReason(reason);
    trackAnalyticsEvent("feedback_not_helpful", {
      ...context,
      reason,
    });
  }

  return (
    <section className="surface-card-soft w-full rounded-[24px] border bg-white p-5 text-left">
      <p className="text-sm font-semibold text-neutral-950">
        Was this result useful?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleHelpfulClick}
          aria-pressed={feedbackState === "helpful"}
          className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-pressed:border-emerald-200 aria-pressed:bg-emerald-50 aria-pressed:text-emerald-700"
        >
          Helpful
        </button>
        <button
          type="button"
          onClick={handleNotHelpfulClick}
          aria-pressed={feedbackState === "not-helpful"}
          className="h-10 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-pressed:border-red-200 aria-pressed:bg-red-50 aria-pressed:text-red-700"
        >
          Not helpful
        </button>
      </div>

      {feedbackState === "not-helpful" ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Reason
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {negativeReasons.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => handleReasonClick(reason)}
                aria-pressed={selectedReason === reason}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.02] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 aria-pressed:border-neutral-950 aria-pressed:bg-neutral-950 aria-pressed:text-white"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {feedbackState === "helpful" || selectedReason ? (
        <p className="mt-3 text-sm text-neutral-500">Thanks for the feedback.</p>
      ) : null}
    </section>
  );
}
