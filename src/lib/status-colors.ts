import type {
  RecommendationLabel,
  ServiceCompatibilityStatus,
} from "@/lib/trust-engine";

export type StatusTone =
  | "good"
  | "caution"
  | "risk"
  | "infrastructure"
  | "neutral";

const STATUS_TONE_CLASS_NAMES: Record<StatusTone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-200",
  caution: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-200",
  risk: "border-rose-200 bg-rose-50 text-rose-700 ring-rose-200",
  infrastructure: "border-slate-200 bg-slate-50 text-slate-600 ring-slate-200",
  neutral:
    "border-neutral-200 bg-neutral-50 text-neutral-600 ring-neutral-200",
};

const STATUS_BADGE_BASE_CLASS_NAME =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ring-1";

export function getStatusBadgeClassName(
  tone: StatusTone,
  className?: string,
) {
  return [
    STATUS_BADGE_BASE_CLASS_NAME,
    STATUS_TONE_CLASS_NAMES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function getTrustScoreTone(score: number): StatusTone {
  if (score >= 70) {
    return "good";
  }

  if (score >= 40) {
    return "caution";
  }

  return "risk";
}

export function getTrustScoreStatusLabel(score: number) {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 40) {
    return "Use with Caution";
  }

  return "High Risk";
}

export function getRecommendationTone(
  recommendation: RecommendationLabel,
): StatusTone {
  if (recommendation === "Recommended") {
    return "good";
  }

  if (recommendation === "Use with Caution") {
    return "caution";
  }

  return "risk";
}

export function getServiceCompatibilityTone(
  status: ServiceCompatibilityStatus,
): StatusTone {
  if (status === "Good") {
    return "good";
  }

  if (status === "Use with Caution") {
    return "caution";
  }

  return "risk";
}

export function getUsageTypeTone(value?: string | null): StatusTone {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (
    !normalized ||
    normalized === "unknown" ||
    normalized === "not identified" ||
    normalized.startsWith("no ")
  ) {
    return "neutral";
  }

  if (
    normalized.includes("infrastructure") ||
    normalized.includes("hosting") ||
    normalized.includes("cdn") ||
    normalized.includes("data center") ||
    normalized.includes("datacenter") ||
    normalized.includes("transit")
  ) {
    return "infrastructure";
  }

  if (normalized.includes("residential") || normalized.includes("mobile")) {
    return "good";
  }

  return "neutral";
}
