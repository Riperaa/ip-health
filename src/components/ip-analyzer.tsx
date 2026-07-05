"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  fetchIpAnalysis,
  fetchPublicIp,
  type AnalysisResult,
} from "@/lib/client-ip-analysis";
import {
  buildRecommendationConfidence,
  buildRecommendation,
  buildServiceCompatibility,
  buildServiceCompatibilityReason,
  buildServiceCompatibilitySignals,
  calculateTrustScore,
  hasCloudflareColoSignal,
  hasCloudflareTraceMatch,
  hasCloudflareTraceMismatch,
  isCloudflareWarpOn,
  isInfrastructureUsage,
  type AbuseIpDbResponse,
  type CloudflareTraceResponse,
  type IpInfoResponse,
  type RecommendationConfidence,
  type RecommendationLabel,
  type ServiceCompatibilityStatus,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  getServiceCompatibilityTone,
  type StatusTone,
} from "@/lib/status-colors";

type RecentCheck = {
  ip: string;
  timestamp: number;
};

type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

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

type RiskLevel = "Low" | "Medium" | "High";

type RiskSignal = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type ServiceCompatibilityItem = {
  name: string;
  status: ServiceCompatibilityStatus;
};

type SafeServiceCompatibilityCategory = {
  category: string;
  services: ServiceCompatibilityItem[];
};

type NetworkIntegrityItem = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

type IntegrityStatus = {
  label: string;
  detail: string;
  tone: StatusTone;
};

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;
const IP_HISTORY_STORAGE_KEY = "ip-health:ip-history";
const MAX_IP_HISTORY_RECORDS = 20;
const IP_HISTORY_PREVIEW_LIMIT = 5;
const SERVICE_COMPATIBILITY_STATUSES = [
  "Good",
  "Use with Caution",
  "High Risk",
] as const;
const EMPTY_IP_INFO: IpInfoResponse = {
  ip: "",
  asn: {},
  company: {},
  privacy: {},
};
const EMPTY_ANALYSIS_RESULT: AnalysisResult = {
  ipInfo: EMPTY_IP_INFO,
  abuseIpDb: null,
  cloudflare: null,
  ipqs: null,
};

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

function DisclosureSection({
  title,
  summary,
  isExpanded,
  onToggle,
  contentId,
  children,
}: {
  title: string;
  summary?: string;
  isExpanded: boolean;
  onToggle: () => void;
  contentId: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="disclosure-card overflow-hidden rounded-2xl border bg-white">
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex min-h-12 w-full flex-col gap-1 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-[#f3f4f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="w-4 shrink-0 text-xs text-neutral-400"
              aria-hidden="true"
            >
              {isExpanded ? "v" : ">"}
            </span>
            <span>{title}</span>
          </span>
          {summary ? (
            <span className="pl-6 text-xs font-medium leading-5 text-neutral-400 sm:pl-0 sm:text-right">
              {summary}
            </span>
          ) : null}
        </button>
      </div>

      <div id={contentId} hidden={!isExpanded}>
        {children}
      </div>
    </section>
  );
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
  const normalizedValue = trimmedValue?.toLowerCase();

  if (
    !trimmedValue ||
    normalizedValue === "unknown" ||
    normalizedValue === "not identified"
  ) {
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

function normalizeAnalysisResult(
  result: AnalysisResult | null,
  fallbackIpAddress: string,
): AnalysisResult {
  const ipInfo = result?.ipInfo ?? EMPTY_ANALYSIS_RESULT.ipInfo;

  return {
    ipInfo: {
      ...EMPTY_IP_INFO,
      ...ipInfo,
      ip: ipInfo.ip || fallbackIpAddress.trim(),
      asn: ipInfo.asn ?? {},
      company: ipInfo.company ?? {},
      privacy: ipInfo.privacy ?? {},
    },
    abuseIpDb: result?.abuseIpDb ?? null,
    cloudflare: result?.cloudflare ?? null,
    ipqs: result?.ipqs ?? null,
  };
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

function isServiceCompatibilityStatus(
  value: unknown,
): value is ServiceCompatibilityStatus {
  return SERVICE_COMPATIBILITY_STATUSES.some((status) => status === value);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isServiceCompatibilityItem(
  value: unknown,
): value is ServiceCompatibilityItem {
  return isObjectRecord(value) && isServiceCompatibilityStatus(value.status);
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

  return normalizeIpHistory(historyRecords).filter(
    (historyRecord) =>
      historyRecord.ip.trim().toLowerCase() === normalizedIpAddress,
  );
}

function getNextIpHistory(
  historyRecords: IpHistoryRecord[],
  historyRecord: IpHistoryRecord,
) {
  return normalizeIpHistory([historyRecord, ...historyRecords]).slice(
    0,
    MAX_IP_HISTORY_RECORDS,
  );
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

function buildIpHistoryRecord(
  result: AnalysisResult,
  fallbackIpAddress: string,
): IpHistoryRecord {
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = result;
  const recommendation = buildRecommendation(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );

  return {
    ip: ipInfo.ip || fallbackIpAddress,
    timestamp: Date.now(),
    trustScore: calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare),
    recommendationLabel: recommendation.label,
    confidence: buildRecommendationConfidence(
      ipInfo,
      abuseIpDb,
      ipqs,
      cloudflare,
    ),
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
  const safeHistoryRecords = normalizeIpHistory(historyRecords);

  if (safeHistoryRecords.length === 0) {
    return "Saved in this browser only - No local history for this IP";
  }

  const latestHistoryRecord = safeHistoryRecords[0];
  const checkLabel = safeHistoryRecords.length === 1 ? "check" : "checks";

  return [
    "Saved in this browser only",
    `${safeHistoryRecords.length} ${checkLabel}`,
    `Latest: ${latestHistoryRecord.trustScore}/100`,
    latestHistoryRecord.recommendationLabel,
    formatHistorySummaryAbuseConfidence(latestHistoryRecord.abuseConfidence),
  ].join(" - ");
}

function normalizeServiceCompatibility(
  serviceCompatibility: unknown,
): SafeServiceCompatibilityCategory[] {
  if (!Array.isArray(serviceCompatibility)) {
    return [];
  }

  return serviceCompatibility.filter(isObjectRecord).map((category) => {
    const services = Array.isArray(category.services)
      ? category.services.filter(isServiceCompatibilityItem).map((service) => ({
          name:
            typeof service.name === "string" && service.name.trim()
              ? service.name
              : "Unknown service",
          status: service.status,
        }))
      : [];

    return {
      category:
        typeof category.category === "string" && category.category.trim()
          ? category.category
          : "UNCATEGORIZED",
      services,
    };
  });
}

function getServiceCompatibilitySummary(services: ServiceCompatibilityItem[]) {
  return (Array.isArray(services) ? services : []).reduce<
    Record<ServiceCompatibilityStatus, number>
  >(
    (summary, service) => ({
      ...summary,
      [service.status]: summary[service.status] + 1,
    }),
    {
      Good: 0,
      "Use with Caution": 0,
      "High Risk": 0,
    },
  );
}

function getServiceCompatibilitySummaryLabel(
  serviceCompatibility: SafeServiceCompatibilityCategory[],
) {
  const safeServiceCompatibility = Array.isArray(serviceCompatibility)
    ? serviceCompatibility
    : [];
  const summary = safeServiceCompatibility.reduce<
    Record<ServiceCompatibilityStatus, number>
  >(
    (currentSummary, category) => {
      const categorySummary = getServiceCompatibilitySummary(category.services);

      return {
        Good: currentSummary.Good + categorySummary.Good,
        "Use with Caution":
          currentSummary["Use with Caution"] +
          categorySummary["Use with Caution"],
        "High Risk": currentSummary["High Risk"] + categorySummary["High Risk"],
      };
    },
    {
      Good: 0,
      "Use with Caution": 0,
      "High Risk": 0,
    },
  );

  return `${summary.Good} Good - ${summary["Use with Caution"]} Caution - ${summary["High Risk"]} High Risk`;
}

function getDomId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isDataCenterHostingTransitUsage(usageType?: string | null) {
  const normalized = usageType?.toLowerCase().replace(/\s+/g, "") ?? "";

  return normalized.includes("datacenter/webhosting/transit");
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

function getNetworkIdentity(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const parsedOrg = parseOrg(ipInfo.org);
  const asn = pickDetail(ipInfo.asn?.asn, parsedOrg.asn);
  const isp = pickDetail(
    ipInfo.company?.name,
    abuseIpDb?.isp,
    ipInfo.asn?.name,
    parsedOrg.name,
    ipInfo.org,
  );

  return {
    asn: formatDetail(asn),
    isp: formatDetail(isp),
  };
}

function formatLocation(ipInfo: IpInfoResponse) {
  const city = formatDetail(ipInfo.city);
  const country = formatDetail(pickDetail(ipInfo.country_name, ipInfo.country));
  const locationParts = [city, country].filter((value) => hasDetail(value));

  return locationParts.length > 0 ? locationParts.join(", ") : "Not identified";
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "Low";
  }

  if (score >= 40) {
    return "Medium";
  }

  return "High";
}

function getRiskLevelTone(riskLevel: RiskLevel): StatusTone {
  if (riskLevel === "Low") {
    return "good";
  }

  if (riskLevel === "Medium") {
    return "caution";
  }

  return "risk";
}

function getRiskLevelSummary(riskLevel: RiskLevel) {
  if (riskLevel === "Low") {
    return "No major risk signals were found in the available data.";
  }

  if (riskLevel === "Medium") {
    return "Some risk signals need review before using this IP for sensitive accounts.";
  }

  return "Strong risk signals were found. Avoid this IP for sensitive accounts.";
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "No abuse score";
  }

  if (abuseConfidence < 25) {
    return `Low, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 60) {
    return `Elevated, ${abuseConfidence}%`;
  }

  if (abuseConfidence < 85) {
    return `High, ${abuseConfidence}%`;
  }

  return `Severe, ${abuseConfidence}%`;
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

function getReverseDns(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return pickDetail(getAbuseIpDbHostname(abuseIpDb), ipInfo.hostname);
}

function getPrivacySignals(ipInfo: IpInfoResponse) {
  const privacy = ipInfo.privacy;

  return [
    privacy?.vpn === true ? "VPN" : null,
    privacy?.proxy === true ? "proxy" : null,
    privacy?.tor === true ? "Tor" : null,
    privacy?.relay === true ? "relay" : null,
  ].filter((signal): signal is string => Boolean(signal));
}

function hasNativeInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType)
  );
}

function hasInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  cloudflare?: CloudflareTraceResponse | null,
) {
  return (
    hasNativeInfrastructureSignal(ipInfo, abuseIpDb) ||
    hasCloudflareColoSignal(ipInfo, cloudflare)
  );
}

function formatSignalList(signals: string[]) {
  if (signals.length === 0) {
    return "";
  }

  if (signals.length === 1) {
    return signals[0];
  }

  return `${signals.slice(0, -1).join(", ")} and ${signals.at(-1)}`;
}

function formatCloudflareLocation(cloudflare?: CloudflareTraceResponse | null) {
  const country = formatDetail(cloudflare?.country);
  const colo = formatDetail(cloudflare?.colo);

  if (hasDetail(country) && hasDetail(colo)) {
    return `${country} (${colo})`;
  }

  if (hasDetail(country)) {
    return country;
  }

  if (hasDetail(colo)) {
    return colo;
  }

  return "Not identified";
}

function getWarpStatus(
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.warp) {
    return {
      label: "Not available",
      tone: "neutral" satisfies StatusTone,
      detail: "WARP status was not returned.",
    };
  }

  if (isCloudflareWarpOn(cloudflare)) {
    return {
      label: "WARP on",
      tone: "risk" satisfies StatusTone,
      detail: "Cloudflare WARP is active for this connection.",
    };
  }

  return {
    label: "No WARP detected",
    tone: "good" satisfies StatusTone,
    detail: "Cloudflare did not report WARP on this connection.",
  };
}

function getConsistencyStatus(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): IntegrityStatus {
  if (!cloudflare?.ip || !ipInfo.ip) {
    return {
      label: "Not available",
      tone: "neutral" satisfies StatusTone,
      detail: "Unable to compare Cloudflare and IPinfo views.",
    };
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    return {
      label: "Consistent",
      tone: "good" satisfies StatusTone,
      detail: "Cloudflare and IPinfo identify the same IP.",
    };
  }

  return {
    label: "Needs review",
    tone: "caution" satisfies StatusTone,
    detail: "Cloudflare and IPinfo identify different IPs.",
  };
}

function getNetworkIntegrityTone(
  ipInfo: IpInfoResponse,
  cloudflare?: CloudflareTraceResponse | null,
): StatusTone {
  if (!cloudflare) {
    return "neutral";
  }

  if (
    isCloudflareWarpOn(cloudflare) ||
    hasCloudflareTraceMismatch(ipInfo, cloudflare)
  ) {
    return "caution";
  }

  return "good";
}

function getScoreExplanationItems(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  cloudflare: CloudflareTraceResponse | null,
  score: number,
) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const privacySignals = getPrivacySignals(ipInfo);
  const hasInfrastructure = hasInfrastructureSignal(
    ipInfo,
    abuseIpDb,
    cloudflare,
  );
  const usageType = formatUsageType(abuseIpDb?.usageType, ipInfo.privacy);
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const reverseDns = getReverseDns(ipInfo, abuseIpDb);
  const items: string[] = [];

  if (score >= 85) {
    items.push(
      "The trust score is high because no major abuse or privacy signals were found.",
    );
  } else if (score >= 70) {
    items.push(
      "The trust score is strong, with only minor caution signals in the available data.",
    );
  } else if (score >= 40) {
    items.push(
      "The trust score is medium because one or more risk signals need review.",
    );
  } else {
    items.push(
      "The trust score is low because stronger abuse, privacy, or network signals were detected.",
    );
  }

  if (abuseConfidence === null) {
    items.push("No abuse database score was returned for this IP.");
  } else if (abuseConfidence === 0) {
    items.push("IP not found in recent abuse reports.");
  } else if (abuseConfidence < 25) {
    items.push(`Abuse history is low at ${abuseConfidence}% confidence.`);
  } else if (abuseConfidence < 60) {
    items.push(`Abuse history is elevated at ${abuseConfidence}% confidence.`);
  } else {
    items.push(`Abuse history is high at ${abuseConfidence}% confidence.`);
  }

  if (privacySignals.length === 0) {
    items.push("No VPN, proxy, Tor, or relay detected.");
  } else {
    items.push(`${formatSignalList(privacySignals)} detected.`);
  }

  if (isCloudflareWarpOn(cloudflare)) {
    items.push("Cloudflare WARP is active, which increases network risk.");
  } else if (cloudflare?.warp) {
    items.push("Cloudflare WARP is not active.");
  }

  if (hasInfrastructure) {
    items.push(
      hasDetail(usageType)
        ? `Network usage looks like ${usageType.toLowerCase()}, which stricter services may review.`
        : "Network integrity signals suggest infrastructure routing, which stricter services may review.",
    );
  } else {
    items.push("No hosting infrastructure signal was detected.");
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo agree on the visible IP.");
  } else if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    items.push("Cloudflare and IPinfo report different visible IPs.");
  }

  if (hasDetail(networkIdentity.asn) || hasDetail(networkIdentity.isp)) {
    items.push(
      `Network owner is visible: ${[networkIdentity.asn, networkIdentity.isp]
        .filter((value) => hasDetail(value))
        .join(" / ")}.`,
    );
  } else {
    items.push("ASN/ISP is unknown, so ownership confidence is lower.");
  }

  if (hasDetail(reverseDns)) {
    items.push("DNS is present and does not show an obvious conflict.");
  } else {
    items.push("DNS consistency could not be confirmed.");
  }

  return items;
}

function getRiskSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  cloudflare: CloudflareTraceResponse | null,
): RiskSignal[] {
  const privacy = ipInfo.privacy;
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const signals: RiskSignal[] = [];

  if (privacy?.proxy === true) {
    signals.push({
      label: "Proxy detected",
      detail: "Traffic appears to be routed through a proxy service.",
      tone: "risk",
    });
  }

  if (privacy?.vpn === true) {
    signals.push({
      label: "VPN detected",
      detail: "Traffic appears to be routed through a VPN service.",
      tone: "caution",
    });
  }

  if (privacy?.tor === true) {
    signals.push({
      label: "Tor detected",
      detail: "Tor exit traffic is a strong risk signal for many services.",
      tone: "risk",
    });
  }

  if (privacy?.relay === true) {
    signals.push({
      label: "Relay detected",
      detail: "Relay traffic can make the origin of activity harder to verify.",
      tone: "caution",
    });
  }

  if (isCloudflareWarpOn(cloudflare)) {
    signals.push({
      label: "WARP enabled",
      detail: "Cloudflare reports WARP is active for this network path.",
      tone: "risk",
    });
  }

  if (hasCloudflareTraceMismatch(ipInfo, cloudflare)) {
    signals.push({
      label: "IP mismatch",
      detail: "Cloudflare and IPinfo identify different visible IPs.",
      tone: "caution",
    });
  }

  if (abuseConfidence !== null && abuseConfidence > 0) {
    signals.push({
      label: "Abuse history",
      detail: `${formatAbuseConfidence(abuseIpDb)} confidence reported.`,
      tone: abuseConfidence >= 50 ? "risk" : "caution",
    });
  }

  if (hasNativeInfrastructureSignal(ipInfo, abuseIpDb)) {
    signals.push({
      label: "Suspicious ASN",
      detail: hasDetail(networkIdentity.asn)
        ? `${networkIdentity.asn} appears to be hosting or infrastructure.`
        : "Network appears to be hosting or infrastructure.",
      tone: "infrastructure",
    });
  }

  if (hasCloudflareColoSignal(ipInfo, cloudflare)) {
    signals.push({
      label: "Infrastructure route",
      detail: hasDetail(cloudflare?.colo)
        ? `Cloudflare routed this IP through ${cloudflare?.colo}.`
        : "Cloudflare detected an edge routing signal.",
      tone: "infrastructure",
    });
  }

  return signals;
}

function MainRiskReport({
  ipInfo,
  abuseIpDb,
  cloudflare,
  hasAnalysis,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  hasAnalysis: boolean;
}) {
  const score = hasAnalysis
    ? calculateTrustScore(ipInfo, abuseIpDb, null, cloudflare)
    : 0;
  const riskLevel = getRiskLevel(score);
  const recommendation = buildRecommendation(
    ipInfo,
    abuseIpDb,
    null,
    cloudflare,
  );
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);
  const facts = [
    { label: "Location", value: formatLocation(ipInfo) },
    hasDetail(networkIdentity.asn)
      ? { label: "ASN", value: networkIdentity.asn }
      : null,
    hasDetail(networkIdentity.isp)
      ? { label: "ISP", value: networkIdentity.isp }
      : null,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const safeFacts = Array.isArray(facts) ? facts : [];
  const scoreLabel = hasAnalysis ? score : "--";

  return (
    <section className="surface-card-primary rounded-[28px] border bg-white p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            IP Risk Report
          </p>
          <h2 className="mt-2 break-all text-3xl font-semibold leading-tight text-neutral-950 sm:text-4xl">
            {formatDetail(ipInfo.ip)}
          </h2>
          <dl className="mt-5 grid gap-3 text-left sm:grid-cols-3">
            {safeFacts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                  {fact.label}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium leading-6 text-neutral-800">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Trust Score
          </p>
          <p className="mt-2 flex items-end gap-1 text-7xl font-semibold leading-none text-neutral-950 sm:justify-end">
            {scoreLabel}
            <span className="pb-2 text-xl font-semibold text-neutral-400">
              /100
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            <StatusBadge
              tone={hasAnalysis ? getRiskLevelTone(riskLevel) : "neutral"}
              className="px-3 py-1.5 text-sm"
            >
              {hasAnalysis ? `${riskLevel} Risk` : "Pending"}
            </StatusBadge>
            <StatusBadge
              tone={
                hasAnalysis
                  ? getRecommendationTone(recommendation.label)
                  : "neutral"
              }
              variant="quiet"
            >
              {hasAnalysis ? recommendation.label : "Not analyzed"}
            </StatusBadge>
          </div>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-100 pt-4 text-sm leading-6 text-neutral-600">
        {hasAnalysis
          ? `${getRiskLevelSummary(riskLevel)} ${recommendation.summary}`
          : "Run an analysis to populate this report."}
      </p>
    </section>
  );
}

function ScoreExplanationSection({
  ipInfo,
  abuseIpDb,
  cloudflare,
  hasAnalysis,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  hasAnalysis: boolean;
}) {
  const score = hasAnalysis
    ? calculateTrustScore(ipInfo, abuseIpDb, null, cloudflare)
    : 0;
  const explanationItems = hasAnalysis
    ? getScoreExplanationItems(ipInfo, abuseIpDb, cloudflare, score)
    : ["Run an analysis to see score details."];
  const safeExplanationItems = Array.isArray(explanationItems)
    ? explanationItems
    : [];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          Score Explanation
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          {hasAnalysis
            ? `Why this IP received a ${score}/100 trust score.`
            : "Score details will appear here after analysis."}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {safeExplanationItems.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900"
            />
            <span className="text-neutral-600">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IpHistorySection({
  ipHistoryRecords,
}: {
  ipHistoryRecords: IpHistoryRecord[];
}) {
  const [isIpHistoryVisible, setIsIpHistoryVisible] = useState(false);
  const safeIpHistory = Array.isArray(ipHistoryRecords)
    ? normalizeIpHistory(ipHistoryRecords)
    : [];
  const visibleIpHistoryRecords = safeIpHistory.slice(
    0,
    IP_HISTORY_PREVIEW_LIMIT,
  );

  return (
    <DisclosureSection
      title="IP History"
      summary={getIpHistorySummary(safeIpHistory)}
      isExpanded={isIpHistoryVisible}
      onToggle={() =>
        setIsIpHistoryVisible((currentVisibility) => !currentVisibility)
      }
      contentId="ip-history-content"
    >
      <div className="surface-card mt-3 overflow-hidden rounded-2xl border bg-white">
        <p
          hidden={safeIpHistory.length <= IP_HISTORY_PREVIEW_LIMIT}
          className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-500"
        >
          Showing latest {IP_HISTORY_PREVIEW_LIMIT} of {safeIpHistory.length}{" "}
          checks.
        </p>
        <ul
          hidden={visibleIpHistoryRecords.length === 0}
          className="divide-y divide-neutral-100"
        >
          {visibleIpHistoryRecords.map((historyRecord) => (
            <li
              key={`${historyRecord.timestamp}:${historyRecord.ip}`}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1.2fr_0.7fr_1fr_0.8fr] sm:gap-3"
            >
              <span className="font-medium text-neutral-950">
                {formatHistoryTime(historyRecord.timestamp)}
              </span>
              <span className="text-neutral-600">
                {historyRecord.trustScore}/100
              </span>
              <span className="text-neutral-600">
                {historyRecord.recommendationLabel}
              </span>
              <span className="text-neutral-600">
                {formatHistoryAbuseConfidence(historyRecord.abuseConfidence)}
              </span>
            </li>
          ))}
        </ul>
        <p
          hidden={visibleIpHistoryRecords.length > 0}
          className="px-4 py-3 text-sm text-neutral-500"
        >
          No local history for this IP.
        </p>
      </div>
    </DisclosureSection>
  );
}

function ServiceCompatibilitySection({
  ipInfo,
  abuseIpDb,
  cloudflare,
  hasAnalysis,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  hasAnalysis: boolean;
}) {
  const [isServiceCompatibilityVisible, setIsServiceCompatibilityVisible] =
    useState(false);
  const [expandedServiceCategories, setExpandedServiceCategories] = useState<
    string[]
  >([]);
  const [expandedServiceKey, setExpandedServiceKey] = useState<string | null>(
    null,
  );
  const serviceCompatibility = normalizeServiceCompatibility(
    hasAnalysis
      ? buildServiceCompatibility(ipInfo, abuseIpDb, null, cloudflare)
      : [],
  );
  const safeServiceCompatibility = Array.isArray(serviceCompatibility)
    ? serviceCompatibility
    : [];
  const compatibilitySignals = buildServiceCompatibilitySignals(
    ipInfo,
    abuseIpDb,
    null,
    cloudflare,
  );

  return (
    <DisclosureSection
      title="Service Compatibility"
      summary={getServiceCompatibilitySummaryLabel(safeServiceCompatibility)}
      isExpanded={isServiceCompatibilityVisible}
      onToggle={() =>
        setIsServiceCompatibilityVisible(
          (currentVisibility) => !currentVisibility,
        )
      }
      contentId="service-compatibility-content"
    >
      <div className="surface-card mt-3 overflow-hidden rounded-2xl border bg-white">
        <div className="divide-y divide-neutral-100">
          {safeServiceCompatibility.map((category) => {
            const safeServices = Array.isArray(category.services)
              ? category.services
              : [];
            const summary = getServiceCompatibilitySummary(safeServices);
            const isCategoryExpanded = expandedServiceCategories.includes(
              category.category,
            );
            const categoryContentId = `service-compatibility-${getDomId(
              category.category,
            )}`;

            return (
              <div key={category.category}>
                <button
                  type="button"
                  aria-controls={categoryContentId}
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
                        currentServiceKey?.startsWith(`${category.category}:`)
                          ? null
                          : currentServiceKey,
                      );
                    }
                  }}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="w-4 shrink-0 text-xs text-neutral-400"
                      aria-hidden="true"
                    >
                      {isCategoryExpanded ? "v" : ">"}
                    </span>
                    <span className="min-w-0 text-xs font-semibold uppercase tracking-normal text-neutral-500">
                      {category.category}
                    </span>
                  </span>
                  <span className="pl-6 text-sm font-medium leading-5 text-neutral-600 sm:pl-0 sm:text-right">
                    {summary.Good} Good - {summary["Use with Caution"]} Caution
                    - {summary["High Risk"]} High Risk
                  </span>
                </button>
                <ul
                  id={categoryContentId}
                  hidden={!isCategoryExpanded}
                  className="space-y-1 border-t border-neutral-100 bg-neutral-50/50 px-3 py-3 sm:px-4"
                >
                  {safeServices.map((service) => {
                    const serviceKey = `${category.category}:${service.name}`;
                    const isExpanded = expandedServiceKey === serviceKey;
                    const serviceContentId = `service-compatibility-${getDomId(
                      serviceKey,
                    )}`;

                    return (
                      <li key={service.name} className="text-sm">
                        <button
                          type="button"
                          aria-controls={serviceContentId}
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedServiceKey(
                              isExpanded ? null : serviceKey,
                            )
                          }
                          className="w-full rounded-xl bg-white px-3 py-2 text-left transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                        >
                          <span className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <span className="font-medium text-neutral-950">
                              {service.name}
                            </span>
                            <StatusBadge
                              tone={getServiceCompatibilityTone(service.status)}
                              variant="quiet"
                            >
                              {service.status}
                            </StatusBadge>
                          </span>
                          <span
                            id={serviceContentId}
                            hidden={!isExpanded}
                            className="mt-2 block text-xs leading-5 text-neutral-500"
                          >
                            {buildServiceCompatibilityReason(
                              service.name,
                              category.category,
                              service.status,
                              compatibilitySignals,
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p
          hidden={safeServiceCompatibility.length > 0}
          className="px-4 py-3 text-sm text-neutral-500"
        >
          No service compatibility data available.
        </p>
        <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-500">
          These recommendations are based on IP reputation and infrastructure
          signals. Services may also consider account history, device
          reputation, browser fingerprint, and behavior.
        </p>
      </div>
    </DisclosureSection>
  );
}

function RiskSignalsSection({
  ipInfo,
  abuseIpDb,
  cloudflare,
  hasAnalysis,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  hasAnalysis: boolean;
}) {
  const [isRiskSignalsVisible, setIsRiskSignalsVisible] = useState(true);
  const riskSignals = hasAnalysis
    ? getRiskSignals(ipInfo, abuseIpDb, cloudflare)
    : [];
  const safeRiskSignals = Array.isArray(riskSignals) ? riskSignals : [];

  return (
    <DisclosureSection
      title="Risk Signals"
      summary={
        !hasAnalysis
          ? "Awaiting analysis"
          : safeRiskSignals.length === 0
            ? "Clear"
            : `${safeRiskSignals.length} found`
      }
      isExpanded={isRiskSignalsVisible}
      onToggle={() =>
        setIsRiskSignalsVisible((currentVisibility) => !currentVisibility)
      }
      contentId="risk-signals-content"
    >
      <div className="surface-card mt-3 rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm leading-6 text-neutral-500">
            Detected issues that may affect account access or verification.
          </p>
          {!hasAnalysis ? (
            <StatusBadge tone="neutral" className="mt-1 sm:mt-0">
              Pending
            </StatusBadge>
          ) : safeRiskSignals.length === 0 ? (
            <StatusBadge tone="good" className="mt-1 sm:mt-0">
              Clear
            </StatusBadge>
          ) : (
            <StatusBadge tone="caution" className="mt-1 sm:mt-0">
              {safeRiskSignals.length} found
            </StatusBadge>
          )}
        </div>

        <ul
          hidden={safeRiskSignals.length === 0}
          className="mt-4 divide-y divide-neutral-100"
        >
          {safeRiskSignals.map((signal) => (
            <li
              key={signal.label}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div>
                <p className="text-sm font-medium text-neutral-950">
                  {signal.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  {signal.detail}
                </p>
              </div>
              <StatusBadge tone={signal.tone} variant="quiet">
                Detected
              </StatusBadge>
            </li>
          ))}
        </ul>
        <p
          hidden={safeRiskSignals.length > 0}
          className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          {hasAnalysis
            ? "No active proxy, abuse, or suspicious ASN signal was found in the available data."
            : "Risk signals will appear here after analysis."}
        </p>
      </div>
    </DisclosureSection>
  );
}

function NetworkIntegritySection({
  ipInfo,
  cloudflare,
}: {
  ipInfo: IpInfoResponse;
  cloudflare: CloudflareTraceResponse | null;
}) {
  const warpStatus = getWarpStatus(cloudflare);
  const consistencyStatus = getConsistencyStatus(ipInfo, cloudflare);
  const integrityTone = getNetworkIntegrityTone(ipInfo, cloudflare);
  const integrityLabel =
    integrityTone === "good"
      ? "Clean"
      : integrityTone === "caution"
        ? "Review"
        : "Unavailable";
  const integrityItems: NetworkIntegrityItem[] = [
    {
      label: "Real IP",
      value: formatDetail(cloudflare?.ip),
      detail: "Seen by Cloudflare trace.",
      tone: "neutral",
    },
    {
      label: "Location",
      value: formatCloudflareLocation(cloudflare),
      detail: "Cloudflare network view.",
      tone: "neutral",
    },
    {
      label: "VPN/WARP",
      value: warpStatus.label,
      detail: warpStatus.detail,
      tone: warpStatus.tone,
    },
    {
      label: "Consistency",
      value: consistencyStatus.label,
      detail: consistencyStatus.detail,
      tone: consistencyStatus.tone,
    },
  ];
  const safeIntegrityItems = Array.isArray(integrityItems)
    ? integrityItems
    : [];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            Network Integrity
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Cloudflare view of this network path.
          </p>
        </div>
        <StatusBadge tone={integrityTone} className="mt-1 sm:mt-0">
          {integrityLabel}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {safeIntegrityItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4"
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
              {item.label}
            </dt>
            <dd className="mt-2">
              <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
            </dd>
            <dd className="mt-2 text-sm leading-6 text-neutral-500">
              {item.detail}
            </dd>
          </div>
        ))}
      </dl>

      <p
        hidden={Boolean(cloudflare)}
        className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500"
      >
        Network integrity is unavailable right now.
      </p>
    </section>
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

  const analyzeIpAddress = useCallback(
    async (nextIpAddress: string) => {
      if (isAnalysisInFlight.current) {
        return;
      }

      const trimmedIpAddress = nextIpAddress.trim();

      if (!trimmedIpAddress) {
        setError("Unable to detect your IP. You can enter it manually.");
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
        const historyRecord = buildIpHistoryRecord(
          nextResult,
          trimmedIpAddress,
        );
        const nextIpHistory = getNextIpHistory(storedIpHistory, historyRecord);

        persistIpHistory(nextIpHistory);
        setCurrentIpHistory(getHistoryForIp(nextIpHistory, historyRecord.ip));
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
    },
    [saveRecentCheck],
  );

  const detectPublicIp = useCallback(async () => {
    setError("");
    setAnalysisErrorIp("");
    setIsDetecting(true);

    try {
      const detectedIp = await fetchPublicIp();
      setIpAddress(detectedIp);
    } catch {
      setError("Unable to detect your IP. You can enter it manually.");
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

  const safeRecentChecks = Array.isArray(recentChecks) ? recentChecks : [];
  const hasAnalysis = Boolean(result) && !isAnalyzing;
  const safeResult = normalizeAnalysisResult(result, ipAddress);

  return (
    <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center gap-4">
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
        <p className="text-sm font-medium text-neutral-500">{error}</p>
      ) : null}

      <div className="w-full text-left">
        <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
          Recent Checks
        </p>
        {safeRecentChecks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {safeRecentChecks.map((recentCheck) => (
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
          <p className="mt-1 text-sm text-neutral-400">No recent checks yet.</p>
        )}
      </div>

      <div className="mt-6 flex w-full flex-col gap-4 text-left">
        <MainRiskReport
          ipInfo={safeResult.ipInfo}
          abuseIpDb={safeResult.abuseIpDb}
          cloudflare={safeResult.cloudflare}
          hasAnalysis={hasAnalysis}
        />

        <IpHistorySection ipHistoryRecords={currentIpHistory} />

        <NetworkIntegritySection
          ipInfo={safeResult.ipInfo}
          cloudflare={safeResult.cloudflare}
        />

        <ServiceCompatibilitySection
          ipInfo={safeResult.ipInfo}
          abuseIpDb={safeResult.abuseIpDb}
          cloudflare={safeResult.cloudflare}
          hasAnalysis={hasAnalysis}
        />

        <ScoreExplanationSection
          ipInfo={safeResult.ipInfo}
          abuseIpDb={safeResult.abuseIpDb}
          cloudflare={safeResult.cloudflare}
          hasAnalysis={hasAnalysis}
        />

        <RiskSignalsSection
          ipInfo={safeResult.ipInfo}
          abuseIpDb={safeResult.abuseIpDb}
          cloudflare={safeResult.cloudflare}
          hasAnalysis={hasAnalysis}
        />

        <p className="text-xs leading-5 text-neutral-400">
          IP Health provides reputation-based guidance only. Services may also
          consider account history, device signals, payment method, browser
          fingerprint, and behavior.
        </p>
      </div>
    </div>
  );
}
