"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  fetchIpAnalysis,
  fetchPublicIp,
  type AnalysisResult,
  type ReputationSourceStatuses,
  type ReputationSourceStatus,
} from "@/lib/client-ip-analysis";
import {
  buildReasons,
  buildRecommendation,
  buildRecommendationConfidence,
  buildRiskSummary,
  buildServiceCompatibility,
  buildServiceCompatibilityReason,
  buildServiceCompatibilitySignals,
  calculateTrustScore,
  isInfrastructureUsage,
  type AbuseIpDbResponse,
  type IpInfoResponse,
  type IpqsResponse,
  type RecommendationConfidence,
  type RecommendationLabel,
  type ServiceCompatibilityStatus,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  getServiceCompatibilityTone,
  getTrustScoreStatusLabel,
  getTrustScoreTone,
  getUsageTypeTone,
  type StatusTone,
} from "@/lib/status-colors";

type ResultCard = {
  label: string;
  value: string;
};

type RecentCheck = {
  ip: string;
  timestamp: number;
};

type IpHistoryRecord = {
  ip: string;
  timestamp: number;
  trustScore: number;
  recommendationLabel: RecommendationLabel;
  confidence: RecommendationConfidence;
  abuseConfidence: number | null;
  usageType: string;
  ipType: IpTypeBadge;
};

type ReputationSourceRow = {
  name: string;
  status: ReputationSourceStatus;
  contribution: string;
};

type ServiceCompatibilitySummary = Record<ServiceCompatibilityStatus, number>;

type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;
const IP_HISTORY_STORAGE_KEY = "ip-health:ip-history";
const MAX_IP_HISTORY_RECORDS = 20;
const IP_HISTORY_PREVIEW_LIMIT = 5;

function getTrustScoreStatus(score: number) {
  return {
    label: getTrustScoreStatusLabel(score),
    tone: getTrustScoreTone(score),
  };
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

function getServiceStatusLabel(status: ServiceCompatibilityStatus) {
  if (status === "Good") {
    return "✓ Good";
  }

  if (status === "Use with Caution") {
    return "⚠ Use with Caution";
  }

  return "✕ High Risk";
}

function getServiceCompatibilitySummary(
  services: { status: ServiceCompatibilityStatus }[],
): ServiceCompatibilitySummary {
  const summary: ServiceCompatibilitySummary = {
    Good: 0,
    "Use with Caution": 0,
    "High Risk": 0,
  };

  services.forEach((service) => {
    summary[service.status] += 1;
  });

  return summary;
}

function ServiceCompatibilitySummaryBadges({
  summary,
}: {
  summary: ServiceCompatibilitySummary;
}) {
  const summaryBadges = (
    [
      { count: summary.Good, label: "Good", tone: "good" },
      {
        count: summary["Use with Caution"],
        label: "Caution",
        tone: "caution",
      },
      { count: summary["High Risk"], label: "High Risk", tone: "risk" },
    ] satisfies { count: number; label: string; tone: StatusTone }[]
  ).filter((badge) => badge.count > 0);

  return (
    <span className="flex flex-wrap gap-1.5 sm:justify-end">
      {summaryBadges.map((badge) => (
        <StatusBadge key={badge.label} tone={badge.tone} variant="quiet">
          {badge.count} {badge.label}
        </StatusBadge>
      ))}
    </span>
  );
}

function getReputationSourceTone(
  status: ReputationSourceStatus,
): StatusTone {
  if (status === "Available") {
    return "good";
  }

  if (status === "Error") {
    return "caution";
  }

  return "neutral";
}

function parseOrg(org?: string) {
  if (!org) {
    return {};
  }

  const [asn, ...nameParts] = org.split(" ");

  return {
    asn,
    name: nameParts.join(" "),
  };
}

function formatDetail(value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "unknown") {
    return "Not identified";
  }

  return trimmedValue;
}

function pickDetail(...values: (string | null | undefined)[]) {
  return values.find((value) => formatDetail(value) !== "Not identified");
}

function hasDetail(value?: string | null) {
  return formatDetail(value) !== "Not identified";
}

function isDataCenterHostingTransitUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase().replace(/\s+/g, "") ?? "";

  return normalized.includes("datacenter/webhosting/transit");
}

function getIpTypeBadge(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
): IpTypeBadge {
  const normalized = usageType?.toLowerCase() ?? "";

  if (isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  if (normalized.includes("residential")) {
    return "Residential";
  }

  if (normalized.includes("mobile")) {
    return "Mobile";
  }

  if (normalized.includes("business")) {
    return "Business";
  }

  if (privacy?.hosting === true) {
    return "Infrastructure";
  }

  return "Unknown";
}

function normalizeRecentChecks(value: unknown): RecentCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is RecentCheck => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const recentCheck = item as RecentCheck;

      return (
        typeof recentCheck.ip === "string" &&
        recentCheck.ip.trim().length > 0 &&
        typeof recentCheck.timestamp === "number" &&
        Number.isFinite(recentCheck.timestamp)
      );
    })
    .sort((first, second) => second.timestamp - first.timestamp)
    .slice(0, MAX_RECENT_CHECKS);
}

function loadRecentChecks(): RecentCheck[] {
  try {
    const storedValue = window.localStorage.getItem(RECENT_CHECKS_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    return normalizeRecentChecks(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

function persistRecentChecks(recentChecks: RecentCheck[]) {
  try {
    window.localStorage.setItem(
      RECENT_CHECKS_STORAGE_KEY,
      JSON.stringify(recentChecks),
    );
  } catch {
    return;
  }
}

function getNextRecentChecks(recentChecks: RecentCheck[], ipAddress: string) {
  const trimmedIpAddress = ipAddress.trim();
  const normalizedIpAddress = trimmedIpAddress.toLowerCase();

  return [
    {
      ip: trimmedIpAddress,
      timestamp: Date.now(),
    },
    ...recentChecks.filter(
      (recentCheck) => recentCheck.ip.toLowerCase() !== normalizedIpAddress,
    ),
  ].slice(0, MAX_RECENT_CHECKS);
}

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

function normalizeIpHistory(value: unknown): IpHistoryRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is IpHistoryRecord => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const historyRecord = item as IpHistoryRecord;

      return (
        typeof historyRecord.ip === "string" &&
        historyRecord.ip.trim().length > 0 &&
        typeof historyRecord.timestamp === "number" &&
        Number.isFinite(historyRecord.timestamp) &&
        typeof historyRecord.trustScore === "number" &&
        Number.isFinite(historyRecord.trustScore) &&
        isRecommendationLabel(historyRecord.recommendationLabel) &&
        isRecommendationConfidence(historyRecord.confidence) &&
        ((typeof historyRecord.abuseConfidence === "number" &&
          Number.isFinite(historyRecord.abuseConfidence)) ||
          historyRecord.abuseConfidence === null) &&
        typeof historyRecord.usageType === "string" &&
        isIpTypeBadge(historyRecord.ipType)
      );
    })
    .sort((first, second) => second.timestamp - first.timestamp)
    .slice(0, MAX_IP_HISTORY_RECORDS);
}

function loadIpHistory(): IpHistoryRecord[] {
  try {
    const storedValue = window.localStorage.getItem(IP_HISTORY_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    return normalizeIpHistory(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

function persistIpHistory(historyRecords: IpHistoryRecord[]) {
  try {
    window.localStorage.setItem(
      IP_HISTORY_STORAGE_KEY,
      JSON.stringify(historyRecords),
    );
  } catch {
    return;
  }
}

function getHistoryForIp(historyRecords: IpHistoryRecord[], ipAddress: string) {
  const normalizedIpAddress = ipAddress.trim().toLowerCase();

  return historyRecords.filter(
    (historyRecord) =>
      historyRecord.ip.trim().toLowerCase() === normalizedIpAddress,
  );
}

function getNextIpHistory(
  historyRecords: IpHistoryRecord[],
  historyRecord: IpHistoryRecord,
) {
  return [historyRecord, ...historyRecords].slice(0, MAX_IP_HISTORY_RECORDS);
}

function buildIpHistoryRecord(
  result: AnalysisResult,
  fallbackIpAddress: string,
): IpHistoryRecord {
  const { ipInfo, abuseIpDb, ipqs } = result;
  const recommendation = buildRecommendation(ipInfo, abuseIpDb, ipqs);

  return {
    ip: ipInfo.ip || fallbackIpAddress,
    timestamp: Date.now(),
    trustScore: calculateTrustScore(ipInfo, abuseIpDb, ipqs),
    recommendationLabel: recommendation.label,
    confidence: buildRecommendationConfidence(ipInfo, abuseIpDb, ipqs),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    usageType: formatUsageType(abuseIpDb?.usageType, ipInfo.privacy),
    ipType: getIpTypeBadge(abuseIpDb?.usageType, ipInfo.privacy),
  };
}

function formatHistoryTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatHistoryAbuseConfidence(abuseConfidence: number | null) {
  return abuseConfidence === null ? "No abuse score" : `${abuseConfidence}%`;
}

function formatHistorySummaryAbuseConfidence(abuseConfidence: number | null) {
  return abuseConfidence === null
    ? "No abuse score"
    : `${abuseConfidence}% abuse`;
}

function getIpHistorySummary(historyRecords: IpHistoryRecord[]) {
  if (historyRecords.length === 0) {
    return "Saved in this browser only · No local history for this IP";
  }

  const latestHistoryRecord = historyRecords[0];
  const checkLabel = historyRecords.length === 1 ? "check" : "checks";

  return [
    "Saved in this browser only",
    `${historyRecords.length} ${checkLabel}`,
    `Latest: ${latestHistoryRecord.trustScore}/100`,
    latestHistoryRecord.recommendationLabel,
    formatHistorySummaryAbuseConfidence(latestHistoryRecord.abuseConfidence),
  ].join(" · ");
}

function getReputationSourceRows(
  sourceStatuses: ReputationSourceStatuses,
): ReputationSourceRow[] {
  return [
    {
      name: "IPinfo",
      status: sourceStatuses.ipinfo,
      contribution: "Location, ASN, ISP, privacy signals",
    },
    {
      name: "AbuseIPDB",
      status: sourceStatuses.abuseipdb,
      contribution: "Abuse confidence, usage type, reports",
    },
    {
      name: "IPQualityScore",
      status: sourceStatuses.ipqs,
      contribution: "Fraud score, VPN/proxy/bot signals",
    },
  ];
}

function formatHosting(value?: boolean, usageType?: string | null) {
  if (value === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  if (value === false) {
    return "Not detected";
  }

  return "No hosting signal";
}

function getPrivacySummary(
  privacy?: IpInfoResponse["privacy"],
  ipqs?: IpqsResponse | null,
) {
  if (privacy?.vpn === true || ipqs?.vpn === true || ipqs?.activeVpn === true) {
    return "VPN";
  }

  if (privacy?.proxy === true || ipqs?.proxy === true) {
    return "Proxy";
  }

  if (privacy?.tor === true || ipqs?.tor === true) {
    return "Tor";
  }

  if (privacy?.relay === true) {
    return "Relay";
  }

  return "No VPN/Proxy detected";
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "No abuse score";
  }

  if (abuseConfidence < 25) {
    return `Low · ${abuseConfidence}%`;
  }

  if (abuseConfidence < 60) {
    return `Elevated · ${abuseConfidence}%`;
  }

  if (abuseConfidence < 85) {
    return `High · ${abuseConfidence}%`;
  }

  return `Severe · ${abuseConfidence}%`;
}

function formatUsageType(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
) {
  if (hasDetail(usageType)) {
    if (isDataCenterHostingTransitUsage(usageType)) {
      return "Infrastructure";
    }

    return formatDetail(usageType);
  }

  if (privacy?.hosting === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  return "Not identified";
}

function getAbuseIpDbHostname(abuseIpDb?: AbuseIpDbResponse | null) {
  const raw = abuseIpDb?.raw;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = (raw as { data?: unknown }).data;

  if (!data || typeof data !== "object") {
    return null;
  }

  const hostnames = (data as { hostnames?: unknown }).hostnames;

  if (!Array.isArray(hostnames)) {
    return null;
  }

  return typeof hostnames[0] === "string" ? hostnames[0] : null;
}

function formatReverseDns(
  result: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const reverseDns = pickDetail(getAbuseIpDbHostname(abuseIpDb), result.hostname);

  if (!reverseDns) {
    return "No PTR record";
  }

  return formatDetail(reverseDns);
}

function getResultCards(
  result: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
): ResultCard[] {
  const parsedOrg = parseOrg(result.org);
  const asn = pickDetail(result.asn?.asn, parsedOrg.asn);
  const isp = pickDetail(
    result.company?.name,
    abuseIpDb?.isp,
    result.asn?.name,
    parsedOrg.name,
  );
  const organization = pickDetail(
    parsedOrg.name,
    result.org,
    result.company?.name,
    result.asn?.name,
    isp,
  );
  const country = pickDetail(result.country_name, result.country);

  return [
    { label: "IP", value: formatDetail(result.ip) },
    { label: "Country", value: formatDetail(country) },
    { label: "Region / State", value: formatDetail(result.region) },
    { label: "City", value: formatDetail(result.city) },
    { label: "ISP", value: formatDetail(isp) },
    { label: "Organization", value: formatDetail(organization) },
    { label: "ASN", value: formatDetail(asn) },
    {
      label: "Usage Type",
      value: formatUsageType(abuseIpDb?.usageType, result.privacy),
    },
    {
      label: "Hosting",
      value: formatHosting(result.privacy?.hosting, abuseIpDb?.usageType),
    },
    { label: "Privacy", value: getPrivacySummary(result.privacy, ipqs) },
    { label: "Reverse DNS", value: formatReverseDns(result, abuseIpDb) },
    { label: "Abuse Confidence", value: formatAbuseConfidence(abuseIpDb) },
  ];
}

function TrustScoreCard({
  ipInfo,
  abuseIpDb,
  ipqs,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
}) {
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs);
  const riskSummary = buildRiskSummary(ipInfo, abuseIpDb, ipqs);
  const recommendation = buildRecommendation(ipInfo, abuseIpDb, ipqs);
  const recommendationConfidence = buildRecommendationConfidence(
    ipInfo,
    abuseIpDb,
    ipqs,
  );
  const status = getTrustScoreStatus(score);
  const ipType = getIpTypeBadge(abuseIpDb?.usageType, ipInfo.privacy);

  return (
    <div className="surface-card rounded-[28px] border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Trust Score
          </p>
          <p className="mt-2 text-5xl font-semibold leading-none text-neutral-950">
            {score}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge tone={status.tone} className="px-3 text-sm">
            {status.label}
          </StatusBadge>
          <StatusBadge tone={getUsageTypeTone(ipType)}>
            {ipType}
          </StatusBadge>
        </div>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Risk Summary</p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{riskSummary}</p>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Recommendation</p>
        <StatusBadge
          tone={getRecommendationTone(recommendation.label)}
          className="mt-2"
        >
          {recommendation.label}
        </StatusBadge>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {recommendation.summary}
        </p>
        <p className="mt-2 text-sm font-medium text-neutral-500">
          Confidence: {recommendationConfidence}
        </p>
      </div>
    </div>
  );
}

function ServiceCompatibilitySection({
  ipInfo,
  abuseIpDb,
  ipqs,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
}) {
  const [expandedServiceKey, setExpandedServiceKey] = useState<string | null>(
    null,
  );
  const [expandedServiceCategories, setExpandedServiceCategories] = useState<
    string[]
  >([]);
  const [isServiceCompatibilityVisible, setIsServiceCompatibilityVisible] =
    useState(false);
  const serviceCompatibility = buildServiceCompatibility(ipInfo, abuseIpDb, ipqs);
  const compatibilitySignals = buildServiceCompatibilitySignals(
    ipInfo,
    abuseIpDb,
    ipqs,
  );

  return (
    <div>
      <div className="disclosure-card overflow-hidden rounded-2xl border bg-white">
        <button
          type="button"
          aria-expanded={isServiceCompatibilityVisible}
          onClick={() =>
            setIsServiceCompatibilityVisible(
              (currentVisibility) => !currentVisibility,
            )
          }
          className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <span className="w-4 text-xs text-neutral-400" aria-hidden="true">
            {isServiceCompatibilityVisible ? "▾" : "▸"}
          </span>
          <span>Service Compatibility</span>
        </button>
      </div>
      {isServiceCompatibilityVisible ? (
        <div className="surface-card-soft mt-3 overflow-hidden rounded-2xl border bg-white">
          <div className="divide-y divide-neutral-100">
            {serviceCompatibility.map((category) => {
              const summary = getServiceCompatibilitySummary(
                category.services,
              );
              const isCategoryExpanded = expandedServiceCategories.includes(
                category.category,
              );

              return (
                <div key={category.category}>
                  <button
                    type="button"
                    aria-expanded={isCategoryExpanded}
                    onClick={() => {
                      setExpandedServiceCategories((currentCategories) =>
                        isCategoryExpanded
                          ? currentCategories.filter(
                              (currentCategory) =>
                                currentCategory !== category.category,
                            )
                          : [...currentCategories, category.category],
                      );

                      if (isCategoryExpanded) {
                        setExpandedServiceKey((currentServiceKey) =>
                          currentServiceKey?.startsWith(
                            `${category.category}:`,
                          )
                            ? null
                            : currentServiceKey,
                        );
                      }
                    }}
                    className="flex min-h-12 w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="w-4 shrink-0 text-xs text-neutral-400"
                        aria-hidden="true"
                      >
                        {isCategoryExpanded ? "▾" : "▸"}
                      </span>
                      <span className="min-w-0 text-xs font-semibold uppercase tracking-normal text-neutral-500">
                        {category.category}
                      </span>
                    </span>
                    <span className="pl-6 sm:pl-0">
                      <ServiceCompatibilitySummaryBadges summary={summary} />
                    </span>
                  </button>
                  {isCategoryExpanded ? (
                    <ul className="space-y-1 border-t border-neutral-100 bg-neutral-50/50 px-3 py-3 sm:px-4">
                      {category.services.map((service) => {
                        const serviceKey = `${category.category}:${service.name}`;
                        const isExpanded = expandedServiceKey === serviceKey;

                        return (
                          <li key={service.name} className="text-sm">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedServiceKey(
                                  isExpanded ? null : serviceKey,
                                )
                              }
                              className="w-full rounded-xl border border-neutral-200/70 bg-white px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                            >
                              <span className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                <span className="font-medium text-neutral-950">
                                  {service.name}
                                </span>
                                <StatusBadge
                                  tone={getServiceCompatibilityTone(
                                    service.status,
                                  )}
                                  className="sm:shrink-0"
                                >
                                  {getServiceStatusLabel(service.status)}
                                </StatusBadge>
                              </span>
                              {isExpanded ? (
                                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                                  {buildServiceCompatibilityReason(
                                    service.name,
                                    category.category,
                                    service.status,
                                    compatibilitySignals,
                                  )}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-500">
            These recommendations are based on IP reputation and infrastructure
            signals. Services may also consider account history, device
            reputation, browser fingerprint, and behavior.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ScoreDetailsSection({
  ipInfo,
  abuseIpDb,
  ipqs,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
}) {
  const [isScoreDetailsVisible, setIsScoreDetailsVisible] = useState(false);
  const reasons = buildReasons(ipInfo, abuseIpDb, ipqs);

  return (
    <div>
      <div className="disclosure-card overflow-hidden rounded-2xl border bg-white">
        <button
          type="button"
          aria-expanded={isScoreDetailsVisible}
          onClick={() =>
            setIsScoreDetailsVisible(
              (currentVisibility) => !currentVisibility,
            )
          }
          className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <span className="w-4 text-xs text-neutral-400" aria-hidden="true">
            {isScoreDetailsVisible ? "▾" : "▸"}
          </span>
          <span>Why this score?</span>
        </button>
      </div>
      {isScoreDetailsVisible ? (
        <ul className="surface-card-soft mt-3 list-disc space-y-1 rounded-2xl border bg-white p-4 pl-9 text-sm text-neutral-600">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReputationSourcesSection({
  sourceStatuses,
}: {
  sourceStatuses: ReputationSourceStatuses;
}) {
  const reputationSourceRows = getReputationSourceRows(sourceStatuses);
  const hasAvailableReputationData = reputationSourceRows.some(
    (source) => source.status === "Available",
  );

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-950">
        Reputation Sources
      </p>
      <div className="surface-card-soft mt-3 divide-y divide-neutral-100 rounded-2xl border bg-white">
        {hasAvailableReputationData ? (
          reputationSourceRows.map((source) => (
            <div
              key={source.name}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div>
                <p className="text-sm font-medium text-neutral-950">
                  {source.name}
                </p>
                {source.status === "Available" ? (
                  <p className="mt-1 text-sm text-neutral-500">
                    {source.contribution}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0">
                <StatusBadge tone={getReputationSourceTone(source.status)}>
                  {source.status}
                </StatusBadge>
              </p>
            </div>
          ))
        ) : (
          <p className="px-4 py-3 text-sm text-neutral-500">
            No reputation data available.
          </p>
        )}
      </div>
    </div>
  );
}

function IpHistorySection({
  ipHistoryRecords,
}: {
  ipHistoryRecords: IpHistoryRecord[];
}) {
  const [isIpHistoryVisible, setIsIpHistoryVisible] = useState(false);
  const visibleIpHistoryRecords = ipHistoryRecords.slice(
    0,
    IP_HISTORY_PREVIEW_LIMIT,
  );

  return (
    <div>
      <div className="disclosure-card overflow-hidden rounded-2xl border bg-white">
        <button
          type="button"
          aria-expanded={isIpHistoryVisible}
          onClick={() =>
            setIsIpHistoryVisible((currentVisibility) => !currentVisibility)
          }
          className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <span className="w-4 text-xs text-neutral-400" aria-hidden="true">
            {isIpHistoryVisible ? "▾" : "▸"}
          </span>
          <span>IP History</span>
        </button>
      </div>
      {isIpHistoryVisible ? (
        <div className="surface-card-soft mt-3 overflow-hidden rounded-2xl border bg-white">
          {ipHistoryRecords.length > IP_HISTORY_PREVIEW_LIMIT ? (
            <p className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-500">
              Showing latest {IP_HISTORY_PREVIEW_LIMIT} of{" "}
              {ipHistoryRecords.length} checks.
            </p>
          ) : null}
          {visibleIpHistoryRecords.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {visibleIpHistoryRecords.map((historyRecord) => (
                <li
                  key={`${historyRecord.timestamp}:${historyRecord.ip}`}
                  className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1.2fr_0.8fr_1fr_1fr] sm:gap-3"
                >
                  <span className="font-medium text-neutral-950">
                    {formatHistoryTime(historyRecord.timestamp)}
                  </span>
                  <span className="text-neutral-600">
                    {historyRecord.trustScore}/100
                  </span>
                  <span>
                    <StatusBadge
                      tone={getRecommendationTone(
                        historyRecord.recommendationLabel,
                      )}
                    >
                      {historyRecord.recommendationLabel}
                    </StatusBadge>
                  </span>
                  <span className="text-neutral-600">
                    {formatHistoryAbuseConfidence(
                      historyRecord.abuseConfidence,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-neutral-500">
              No local history for this IP.
            </p>
          )}
        </div>
      ) : (
        <p className="surface-card-soft mt-3 rounded-2xl border bg-white px-4 py-3 text-sm leading-6 text-neutral-500">
          {getIpHistorySummary(ipHistoryRecords)}
        </p>
      )}
    </div>
  );
}

export function IpAnalyzer() {
  const [ipAddress, setIpAddress] = useState("");
  const [error, setError] = useState("");
  const [analysisErrorIp, setAnalysisErrorIp] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [currentIpHistory, setCurrentIpHistory] = useState<IpHistoryRecord[]>(
    [],
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);
  const isAnalysisInFlight = useRef(false);

  const saveRecentCheck = useCallback((nextIpAddress: string) => {
    setRecentChecks((currentRecentChecks) => {
      const nextRecentChecks = getNextRecentChecks(
        currentRecentChecks,
        nextIpAddress,
      );
      persistRecentChecks(nextRecentChecks);

      return nextRecentChecks;
    });
  }, []);

  const analyzeIpAddress = useCallback(async (nextIpAddress: string) => {
    if (isAnalysisInFlight.current) {
      return;
    }

    const trimmedIpAddress = nextIpAddress.trim();

    if (!trimmedIpAddress) {
      setError("Unable to detect your IP.");
      setAnalysisErrorIp("");
      return;
    }

    isAnalysisInFlight.current = true;
    setError("");
    setAnalysisErrorIp("");
    setResult(null);
    setCurrentIpHistory([]);
    setIsAnalyzing(true);

    try {
      const nextResult = await fetchIpAnalysis(trimmedIpAddress);
      const storedIpHistory = loadIpHistory();
      const historyRecord = buildIpHistoryRecord(nextResult, trimmedIpAddress);
      const previousIpHistory = getHistoryForIp(
        storedIpHistory,
        historyRecord.ip,
      );
      const nextIpHistory = getNextIpHistory(storedIpHistory, historyRecord);

      persistIpHistory(nextIpHistory);
      setCurrentIpHistory(previousIpHistory);
      setResult(nextResult);
      saveRecentCheck(trimmedIpAddress);
    } catch {
      setResult(null);
      setCurrentIpHistory([]);
      setAnalysisErrorIp(trimmedIpAddress);
    } finally {
      isAnalysisInFlight.current = false;
      setIsAnalyzing(false);
    }
  }, [saveRecentCheck]);

  const detectPublicIp = useCallback(async () => {
    setError("");
    setAnalysisErrorIp("");
    setIsDetecting(true);

    try {
      const detectedIp = await fetchPublicIp();
      setIpAddress(detectedIp);
    } catch {
      setError("Unable to detect your IP.");
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    void detectPublicIp();
  }, [detectPublicIp]);

  useEffect(() => {
    setRecentChecks(loadRecentChecks());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyzeIpAddress(ipAddress);
  }

  function handleRecentCheckClick(nextIpAddress: string) {
    setIpAddress(nextIpAddress);
    void analyzeIpAddress(nextIpAddress);
  }

  function handleRetry() {
    void analyzeIpAddress(analysisErrorIp || ipAddress);
  }

  return (
    <div className="mx-auto mt-8 flex w-full max-w-xl flex-col items-center gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col items-center gap-3"
      >
        <div className="surface-card flex w-full flex-col gap-3 rounded-[28px] border bg-white p-2 transition focus-within:border-neutral-300 sm:flex-row sm:items-center">
          <label htmlFor="ip-address" className="sr-only">
            IP address
          </label>
          <input
            id="ip-address"
            name="ip-address"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="Enter an IPv4 or IPv6 address"
            className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-base text-neutral-950 outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={isAnalyzing}
            className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isAnalyzing ? (
              <>
                <LoadingSpinner />
                <span>Analyzing...</span>
              </>
            ) : (
              "Analyze"
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={detectPublicIp}
            disabled={isDetecting}
            className="h-10 rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDetecting ? "Detecting..." : "Auto Detect My IP"}
          </button>
          <Link
            href="/compare"
            className="flex h-10 items-center rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            Compare IPs
          </Link>
        </div>
      </form>

      {analysisErrorIp ? (
        <div className="w-full rounded-2xl border border-red-100 bg-red-50 p-4 text-left">
          <p className="text-sm font-semibold text-red-700">Analysis failed</p>
          <p className="mt-1 text-sm leading-6 text-red-600">
            Unable to retrieve IP information.
            <br />
            Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isAnalyzing}
            className="mt-3 h-10 rounded-full bg-red-700 px-5 text-sm font-semibold text-white shadow-sm shadow-red-950/10 transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Retry
          </button>
        </div>
      ) : error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      <div className="w-full text-left">
        <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
          Recent Checks
        </p>
        {recentChecks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {recentChecks.map((recentCheck) => (
              <button
                key={recentCheck.ip}
                type="button"
                onClick={() => handleRecentCheckClick(recentCheck.ip)}
                disabled={isAnalyzing}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.02] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recentCheck.ip}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-400">
            No recent checks yet.
          </p>
        )}
      </div>

      {result && !isAnalyzing ? (
        <div className="mt-5 flex w-full flex-col gap-3 text-left">
          <TrustScoreCard
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
            ipqs={result.ipqs}
          />

          <ServiceCompatibilitySection
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
            ipqs={result.ipqs}
          />

          <ScoreDetailsSection
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
            ipqs={result.ipqs}
          />

          <p className="text-sm font-semibold text-neutral-950">IP Details</p>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {getResultCards(
              result.ipInfo,
              result.abuseIpDb,
              result.ipqs,
            ).map((card) => (
              <div
                key={card.label}
                className="surface-card-soft rounded-2xl border bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                  {card.label}
                </p>
                {card.label === "Usage Type" || card.label === "Hosting" ? (
                  <StatusBadge
                    tone={getUsageTypeTone(card.value)}
                    className="mt-2"
                  >
                    {card.value}
                  </StatusBadge>
                ) : (
                  <p className="mt-1 break-words text-base font-medium text-neutral-950">
                    {card.value}
                  </p>
                )}
              </div>
            ))}
          </div>

          <ReputationSourcesSection sourceStatuses={result.sourceStatuses} />

          <IpHistorySection ipHistoryRecords={currentIpHistory} />

          <p className="text-xs leading-5 text-neutral-400">
            IP Health provides reputation-based guidance only. Services may also
            consider account history, device signals, payment method, browser
            fingerprint, and behavior.
          </p>
        </div>
      ) : null}
    </div>
  );
}
