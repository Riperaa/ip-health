"use client";

import { useMemo } from "react";

import type {
  AnalysisProgressStepId,
  AnalysisProgressStepStatus,
} from "@/lib/analysis";
import { messages, type Locale } from "@/lib/localization";

type LoadingStepDefinition = {
  id: AnalysisProgressStepId;
  label: string;
  status: string;
};

export const ANALYSIS_LOADING_STEPS = [
  {
    id: "detect_ip",
    label: "Detecting your IP",
    status: "Preparing IP check...",
  },
  {
    id: "abuseipdb",
    label: "Querying AbuseIPDB",
    status: "Checking AbuseIPDB...",
  },
  {
    id: "ipinfo",
    label: "Querying IPinfo",
    status: "Querying IPinfo...",
  },
  {
    id: "cloudflare",
    label: "Querying Cloudflare",
    status: "Querying Cloudflare...",
  },
  {
    id: "ipqs",
    label: "Querying IPQualityScore",
    status: "Checking IPQualityScore...",
  },
  {
    id: "scamalytics",
    label: "Querying Scamalytics",
    status: "Checking Scamalytics...",
  },
  {
    id: "ipapi_is",
    label: "Querying ipapi.is",
    status: "Checking ipapi.is...",
  },
  {
    id: "trust_score",
    label: "Calculating Trust Score",
    status: "Calculating reputation...",
  },
  {
    id: "report",
    label: "Generating Report",
    status: "Generating recommendations...",
  },
] satisfies LoadingStepDefinition[];

type AnalysisLoadingProps = {
  completedSteps: readonly AnalysisProgressStepId[];
  errorSteps: readonly AnalysisProgressStepId[];
  isComplete: boolean;
  locale?: Locale;
};

type LoadingStepProps = {
  label: string;
  status: AnalysisProgressStepStatus;
};

type ProgressBarProps = {
  value: number;
};

type StatusMessageProps = {
  message: string;
};

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
    >
      <path
        d="M3.5 8.4 6.5 11 12.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
    >
      <path
        d="M8 4.5v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 11.5h.01"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeaderIcon({ isComplete }: { isComplete: boolean }) {
  if (isComplete) {
    return (
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-colors duration-300 ease-out motion-reduce:transition-none">
        <CheckIcon />
      </span>
    );
  }

  return (
    <span className="relative inline-flex size-9 shrink-0 items-center justify-center text-neutral-950">
      <span className="absolute size-9 rounded-full bg-neutral-100 opacity-80 animate-pulse motion-reduce:animate-none" />
      <span className="relative inline-block size-5 animate-spin rounded-full border-2 border-neutral-950 border-r-transparent motion-reduce:animate-none" />
    </span>
  );
}

function StepIcon({ status }: { status: AnalysisProgressStepStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex size-5 shrink-0 scale-100 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 opacity-100 transition-all duration-300 ease-out motion-reduce:transition-none">
        <CheckIcon />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 transition-all duration-300 ease-out motion-reduce:transition-none">
        <WarningIcon />
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-neutral-950 border-r-transparent motion-reduce:animate-none" />
    );
  }

  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white" />
  );
}

export function LoadingStep({ label, status }: LoadingStepProps) {
  const isActive = status === "running";
  const isCompleted = status === "completed";
  const isError = status === "error";

  return (
    <li
      className={`flex min-w-0 items-center gap-2.5 py-1.5 text-sm transition-colors duration-300 ease-out motion-reduce:transition-none ${
        isActive
          ? "text-neutral-950"
          : isCompleted
            ? "text-neutral-700"
            : isError
              ? "text-red-700"
              : "text-neutral-500"
      }`}
    >
      <StepIcon status={status} />
      <span className={`min-w-0 ${isActive ? "font-medium" : "font-normal"}`}>
        {label}
      </span>
    </li>
  );
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-neutral-950 transition-all duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function StatusMessage({ message }: StatusMessageProps) {
  return (
    <p
      aria-live="polite"
      role="status"
      className="min-h-5 text-sm font-medium text-neutral-500 transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      {message}
    </p>
  );
}

export function AnalysisLoading({
  completedSteps,
  errorSteps,
  isComplete,
  locale = "en",
}: AnalysisLoadingProps) {
  const t = messages(locale);
  const completedStepSet = useMemo(
    () => new Set(completedSteps),
    [completedSteps],
  );
  const errorStepSet = useMemo(() => new Set(errorSteps), [errorSteps]);
  const activeStep = isComplete
    ? null
    : ANALYSIS_LOADING_STEPS.find(
        (step) => !completedStepSet.has(step.id) && !errorStepSet.has(step.id),
      ) ?? null;
  const completedCount = ANALYSIS_LOADING_STEPS.filter((step) =>
    completedStepSet.has(step.id),
  ).length;
  const progressValue = isComplete
    ? 100
    : Math.min(
        96,
        Math.max(
          activeStep ? 8 : 0,
          Math.round((completedCount / ANALYSIS_LOADING_STEPS.length) * 100),
        ),
      );
  const statusMessage = isComplete
    ? t("Analysis complete. Preparing your report...")
    : t(activeStep?.status ?? "Finishing analysis...");

  function getStepStatus(
    stepId: AnalysisProgressStepId,
  ): AnalysisProgressStepStatus {
    if (isComplete || completedStepSet.has(stepId)) {
      return "completed";
    }

    if (errorStepSet.has(stepId)) {
      return "error";
    }

    return activeStep?.id === stepId ? "running" : "waiting";
  }

  return (
    <div className="w-full">
      <div className="surface-card-soft w-full rounded-2xl border bg-white px-4 py-4 text-left transition-colors duration-300 ease-out motion-reduce:transition-none sm:px-5">
        <div className="flex items-start gap-3">
          <HeaderIcon isComplete={isComplete} />

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-normal text-neutral-950">
              {isComplete ? t("Analysis complete") : t("Analyzing your IP...")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-500">
              {t("Checking reputation and network identity.")}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ProgressBar value={progressValue} />
          <StatusMessage message={statusMessage} />
        </div>

        <ol className="mt-3 grid gap-x-5 gap-y-0.5 sm:grid-cols-2">
          {ANALYSIS_LOADING_STEPS.map((step) => (
            <LoadingStep
              key={step.id}
              label={t(step.label)}
              status={getStepStatus(step.id)}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
