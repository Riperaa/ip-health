import type {
  IpHistoryRecord,
  IpTypeBadge,
  RecentCheck,
  RecommendationConfidence,
  RecommendationLabel,
} from "@/lib/analysis/types";

import { isObjectRecord } from "./common";

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;
const IP_HISTORY_STORAGE_KEY = "ip-health:ip-history";
const MAX_IP_HISTORY_RECORDS = 20;

export const IP_HISTORY_PREVIEW_LIMIT = 5;

function isRecommendationLabel(value: unknown): value is RecommendationLabel {
  return (
    value === "Recommended" ||
    value === "Use with Caution" ||
    value === "Not Recommended"
  );
}

function isRecommendationConfidence(
  value: unknown,
): value is RecommendationConfidence {
  return value === "High" || value === "Medium" || value === "Low";
}

function isIpTypeBadge(value: unknown): value is IpTypeBadge {
  return (
    value === "Residential" ||
    value === "Mobile" ||
    value === "Business" ||
    value === "Infrastructure" ||
    value === "Hosting" ||
    value === "Unknown"
  );
}

export function normalizeRecentChecks(value: unknown): RecentCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is RecentCheck => {
      if (!isObjectRecord(item)) {
        return false;
      }

      return (
        typeof item.ip === "string" &&
        item.ip.trim().length > 0 &&
        typeof item.timestamp === "number" &&
        Number.isFinite(item.timestamp)
      );
    })
    .sort((first, second) => second.timestamp - first.timestamp)
    .slice(0, MAX_RECENT_CHECKS);
}

export function loadRecentChecks(): RecentCheck[] {
  try {
    const storedValue = window.localStorage.getItem(RECENT_CHECKS_STORAGE_KEY);

    return storedValue ? normalizeRecentChecks(JSON.parse(storedValue)) : [];
  } catch {
    return [];
  }
}

export function persistRecentChecks(recentChecks: RecentCheck[]) {
  try {
    window.localStorage.setItem(
      RECENT_CHECKS_STORAGE_KEY,
      JSON.stringify(recentChecks),
    );
  } catch {
    return;
  }
}

export function getNextRecentChecks(
  recentChecks: RecentCheck[],
  ipAddress: string,
) {
  const trimmedIpAddress = ipAddress.trim();
  const normalizedIpAddress = trimmedIpAddress.toLowerCase();

  return normalizeRecentChecks([
    {
      ip: trimmedIpAddress,
      timestamp: Date.now(),
    },
    ...recentChecks.filter(
      (recentCheck) => recentCheck.ip.toLowerCase() !== normalizedIpAddress,
    ),
  ]);
}

export function saveRecentCheck(ipAddress: string): RecentCheck[] {
  const nextRecentChecks = getNextRecentChecks(loadRecentChecks(), ipAddress);

  persistRecentChecks(nextRecentChecks);

  return nextRecentChecks;
}

export function normalizeIpHistory(value: unknown): IpHistoryRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is IpHistoryRecord => {
      if (!isObjectRecord(item)) {
        return false;
      }

      return (
        typeof item.ip === "string" &&
        item.ip.trim().length > 0 &&
        typeof item.timestamp === "number" &&
        Number.isFinite(item.timestamp) &&
        typeof item.trustScore === "number" &&
        Number.isFinite(item.trustScore) &&
        isRecommendationLabel(item.recommendationLabel) &&
        isRecommendationConfidence(item.confidence) &&
        ((typeof item.abuseConfidence === "number" &&
          Number.isFinite(item.abuseConfidence)) ||
          item.abuseConfidence === null) &&
        typeof item.usageType === "string" &&
        isIpTypeBadge(item.ipType)
      );
    })
    .sort((first, second) => second.timestamp - first.timestamp)
    .slice(0, MAX_IP_HISTORY_RECORDS);
}

export function loadIpHistory(): IpHistoryRecord[] {
  try {
    const storedValue = window.localStorage.getItem(IP_HISTORY_STORAGE_KEY);

    return storedValue ? normalizeIpHistory(JSON.parse(storedValue)) : [];
  } catch {
    return [];
  }
}

export function persistIpHistory(historyRecords: IpHistoryRecord[]) {
  try {
    window.localStorage.setItem(
      IP_HISTORY_STORAGE_KEY,
      JSON.stringify(historyRecords),
    );
  } catch {
    return;
  }
}

export function getHistoryForIp(
  historyRecords: IpHistoryRecord[],
  ipAddress: string,
) {
  const normalizedIpAddress = ipAddress.trim().toLowerCase();

  return normalizeIpHistory(historyRecords).filter(
    (historyRecord) =>
      historyRecord.ip.trim().toLowerCase() === normalizedIpAddress,
  );
}

export function getNextIpHistory(
  historyRecords: IpHistoryRecord[],
  historyRecord: IpHistoryRecord,
) {
  return normalizeIpHistory([historyRecord, ...historyRecords]);
}
