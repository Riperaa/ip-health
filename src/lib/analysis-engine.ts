import {
  buildRecommendation,
  buildRecommendationConfidence,
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
  type IpqsResponse,
  type RecommendationConfidence,
  type RecommendationLabel,
  type ServiceCompatibilityStatus,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  getServiceCompatibilityTone,
  type StatusTone,
} from "@/lib/status-colors";

export type ProviderAnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  cloudflare: CloudflareTraceResponse | null;
  ipqs: IpqsResponse | null;
};

export type RecentCheck = {
  ip: string;
  timestamp: number;
};

export type RiskLevel = "Low" | "Medium" | "High";

export type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

export type IpHistoryRecord = {
  ip: string;
  timestamp: number;
  trustScore: number;
  recommendationLabel: RecommendationLabel;
  confidence: RecommendationConfidence;
  abuseConfidence: number | null;
  usageType: string;
  ipType: IpTypeBadge;
};

export type ResultFact = {
  label: string;
  value: string;
};

export type RiskSignal = {
  label: string;
  detail: string;
  tone: StatusTone;
};

export type ServiceCompatibilityItem = {
  name: string;
  status: ServiceCompatibilityStatus;
  tone: StatusTone;
  reason: string;
};

export type ServiceCompatibilityCategory = {
  category: string;
  summary: string;
  services: ServiceCompatibilityItem[];
};

export type NetworkIntegrityItem = {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
};

export type NetworkIntegrity = {
  label: string;
  tone: StatusTone;
  items: NetworkIntegrityItem[];
  hasCloudflare: boolean;
  unavailableMessage: string;
};

export type AnalysisResult = {
  ip: {
    address: string;
    facts: ResultFact[];
  };
  trustScore: {
    value: number | null;
    displayValue: string;
    riskLabel: string;
    riskTone: StatusTone;
    recommendationLabel: string;
    recommendationTone: StatusTone;
    summary: string;
    explanationIntro: string;
    explanationItems: string[];
    hasAnalysis: boolean;
  };
  riskSignals: RiskSignal[];
  serviceCompatibility: ServiceCompatibilityCategory[];
  ipHistory: IpHistoryRecord[];
  networkIntegrity: NetworkIntegrity;
};

type IntegrityStatus = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type SafeServiceCompatibilitySource = {
  category: string;
  services: {
    name: string;
    status: ServiceCompatibilityStatus;
  }[];
};

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;
const IP_HISTORY_STORAGE_KEY = "ip-health:ip-history";
const MAX_IP_HISTORY_RECORDS = 20;
export const IP_HISTORY_PREVIEW_LIMIT = 5;
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
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

function isServiceCompatibilityItem(
  value: unknown,
): value is { name?: unknown; status: ServiceCompatibilityStatus } {
  return isObjectRecord(value) && isServiceCompatibilityStatus(value.status);
}

function normalizeRecentChecks(value: unknown): RecentCheck[] {
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

function normalizeIpHistory(value: unknown): IpHistoryRecord[] {
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

function loadIpHistory(): IpHistoryRecord[] {
  try {
    const storedValue = window.localStorage.getItem(IP_HISTORY_STORAGE_KEY);

    return storedValue ? normalizeIpHistory(JSON.parse(storedValue)) : [];
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
  return normalizeIpHistory([historyRecord, ...historyRecords]);
}

function normalizeIpInfo(
  data: IpInfoResponse,
  fallbackIpAddress?: string,
): IpInfoResponse {
  return {
    ...data,
    ip: data.ip || fallbackIpAddress || "",
    asn: data.asn ?? {},
    company: data.company ?? {},
    privacy: data.privacy ?? {},
  };
}

function normalizeAbuseIpDb(
  data: AbuseIpDbResponse | null,
): AbuseIpDbResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    abuseConfidence: data.abuseConfidence ?? null,
    usageType: data.usageType ?? null,
    isp: data.isp ?? null,
    domain: data.domain ?? null,
    isWhitelisted: data.isWhitelisted ?? null,
  };
}

function normalizeCloudflareTrace(
  data: CloudflareTraceResponse | null,
): CloudflareTraceResponse | null {
  if (!data) {
    return null;
  }

  return {
    ...data,
    ip: data.ip ?? null,
    colo: data.colo ?? null,
    country: data.country ?? null,
    warp: data.warp ?? null,
    raw: data.raw ?? {},
  };
}

function normalizeProviderAnalysisResult(
  result: ProviderAnalysisResult | null,
  fallbackIpAddress: string,
): ProviderAnalysisResult {
  const ipInfo = result?.ipInfo ?? EMPTY_IP_INFO;

  return {
    ipInfo: normalizeIpInfo(ipInfo, fallbackIpAddress),
    abuseIpDb: normalizeAbuseIpDb(result?.abuseIpDb ?? null),
    cloudflare: normalizeCloudflareTrace(result?.cloudflare ?? null),
    ipqs: result?.ipqs ?? null,
  };
}

async function fetchIpInfo(nextIpAddress?: string) {
  const url = new URL("/api/ipinfo", window.location.origin);

  if (nextIpAddress) {
    url.searchParams.set("ip", nextIpAddress);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to fetch IP information.");
  }

  const data = (await response.json()) as IpInfoResponse;

  if (!data) {
    throw new Error("IP information was unavailable.");
  }

  return normalizeIpInfo(data, nextIpAddress);
}

async function fetchAbuseIpDb(nextIpAddress: string) {
  const url = new URL("/api/abuseipdb", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return normalizeAbuseIpDb(
      (await response.json()) as AbuseIpDbResponse | null,
    );
  } catch {
    return null;
  }
}

async function fetchCloudflareTrace() {
  try {
    const response = await fetch("/api/cloudflare");

    if (!response.ok) {
      return null;
    }

    return normalizeCloudflareTrace(
      (await response.json()) as CloudflareTraceResponse,
    );
  } catch {
    return null;
  }
}

async function fetchDetectedIp() {
  try {
    const response = await fetch("/api/detect-ip");

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { ip?: string | null };
    const ip = data.ip?.trim();

    return ip || null;
  } catch {
    return null;
  }
}

async function fetchIpifyPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error("Missing IP address.");
  }

  const data = (await response.json()) as { ip?: string | null };
  const ip = data.ip?.trim();

  if (!ip) {
    throw new Error("Missing IP address.");
  }

  return ip;
}

export async function fetchPublicIp(): Promise<string> {
  const [detectedIp, cloudflare] = await Promise.all([
    fetchDetectedIp(),
    fetchCloudflareTrace(),
  ]);
  const mergedIp = detectedIp ?? cloudflare?.ip?.trim() ?? null;

  if (mergedIp) {
    return mergedIp;
  }

  return fetchIpifyPublicIp();
}

export async function fetchProviderAnalysis(
  nextIpAddress: string,
): Promise<ProviderAnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const [ipInfo, abuseIpDb, cloudflare] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
    fetchCloudflareTrace(),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare,
    ipqs: null,
  };
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

  if (!isObjectRecord(raw)) {
    return null;
  }

  const data = raw.data;

  if (!isObjectRecord(data)) {
    return null;
  }

  const hostnames = data.hostnames;

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

function normalizeServiceCompatibility(
  serviceCompatibility: unknown,
): SafeServiceCompatibilitySource[] {
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

function getServiceCompatibilitySummary(
  services: { status: ServiceCompatibilityStatus }[],
) {
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
  services: { status: ServiceCompatibilityStatus }[],
) {
  const summary = getServiceCompatibilitySummary(services);

  return `${summary.Good} Good - ${summary["Use with Caution"]} Caution - ${summary["High Risk"]} High Risk`;
}

function buildServiceCompatibilityView(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
  ipqs: IpqsResponse | null,
  cloudflare: CloudflareTraceResponse | null,
) {
  const compatibilitySignals = buildServiceCompatibilitySignals(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );

  return normalizeServiceCompatibility(
    buildServiceCompatibility(ipInfo, abuseIpDb, ipqs, cloudflare),
  ).map((category) => ({
    category: category.category,
    summary: getServiceCompatibilitySummaryLabel(category.services),
    services: category.services.map((service) => ({
      name: service.name,
      status: service.status,
      tone: getServiceCompatibilityTone(service.status),
      reason: buildServiceCompatibilityReason(
        service.name,
        category.category,
        service.status,
        compatibilitySignals,
      ),
    })),
  }));
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
      tone: "neutral",
      detail: "WARP status was not returned.",
    };
  }

  if (isCloudflareWarpOn(cloudflare)) {
    return {
      label: "WARP on",
      tone: "risk",
      detail: "Cloudflare WARP is active for this connection.",
    };
  }

  return {
    label: "No WARP detected",
    tone: "good",
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
      tone: "neutral",
      detail: "Unable to compare Cloudflare and IPinfo views.",
    };
  }

  if (hasCloudflareTraceMatch(ipInfo, cloudflare)) {
    return {
      label: "Consistent",
      tone: "good",
      detail: "Cloudflare and IPinfo identify the same IP.",
    };
  }

  return {
    label: "Needs review",
    tone: "caution",
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

function buildNetworkIntegrity(
  ipInfo: IpInfoResponse,
  cloudflare: CloudflareTraceResponse | null,
): NetworkIntegrity {
  const warpStatus = getWarpStatus(cloudflare);
  const consistencyStatus = getConsistencyStatus(ipInfo, cloudflare);
  const tone = getNetworkIntegrityTone(ipInfo, cloudflare);

  return {
    label:
      tone === "good" ? "Clean" : tone === "caution" ? "Review" : "Unavailable",
    tone,
    hasCloudflare: Boolean(cloudflare),
    unavailableMessage: "Network integrity is unavailable right now.",
    items: [
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
    ],
  };
}

function buildIpHistoryRecord(
  result: ProviderAnalysisResult,
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

function buildIpSummary(
  ipInfo: IpInfoResponse,
  abuseIpDb: AbuseIpDbResponse | null,
) {
  const networkIdentity = getNetworkIdentity(ipInfo, abuseIpDb);

  return {
    address: formatDetail(ipInfo.ip),
    facts: [
      { label: "Location", value: formatLocation(ipInfo) },
      hasDetail(networkIdentity.asn)
        ? { label: "ASN", value: networkIdentity.asn }
        : null,
      hasDetail(networkIdentity.isp)
        ? { label: "ISP", value: networkIdentity.isp }
        : null,
    ].filter((fact): fact is ResultFact => Boolean(fact)),
  };
}

function buildTrustScore(
  providerResult: ProviderAnalysisResult,
  hasAnalysis: boolean,
): AnalysisResult["trustScore"] {
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = providerResult;

  if (!hasAnalysis) {
    return {
      value: null,
      displayValue: "--",
      riskLabel: "Pending",
      riskTone: "neutral" satisfies StatusTone,
      recommendationLabel: "Not analyzed",
      recommendationTone: "neutral" satisfies StatusTone,
      summary: "Run an analysis to populate this report.",
      explanationIntro: "Score details will appear here after analysis.",
      explanationItems: ["Run an analysis to see score details."],
      hasAnalysis,
    };
  }

  const value = calculateTrustScore(ipInfo, abuseIpDb, ipqs, cloudflare);
  const riskLevel = getRiskLevel(value);
  const recommendation = buildRecommendation(
    ipInfo,
    abuseIpDb,
    ipqs,
    cloudflare,
  );

  return {
    value,
    displayValue: String(value),
    riskLabel: `${riskLevel} Risk`,
    riskTone: getRiskLevelTone(riskLevel),
    recommendationLabel: recommendation.label,
    recommendationTone: getRecommendationTone(recommendation.label),
    summary: `${getRiskLevelSummary(riskLevel)} ${recommendation.summary}`,
    explanationIntro: `Why this IP received a ${value}/100 trust score.`,
    explanationItems: getScoreExplanationItems(
      ipInfo,
      abuseIpDb,
      cloudflare,
      value,
    ),
    hasAnalysis,
  };
}

export function buildAnalysisResult({
  providerResult,
  ipHistory = [],
  fallbackIpAddress = "",
}: {
  providerResult: ProviderAnalysisResult | null;
  ipHistory?: IpHistoryRecord[];
  fallbackIpAddress?: string;
}): AnalysisResult {
  const hasAnalysis = Boolean(providerResult);
  const normalizedResult = normalizeProviderAnalysisResult(
    providerResult,
    fallbackIpAddress,
  );
  const { ipInfo, abuseIpDb, ipqs, cloudflare } = normalizedResult;

  return {
    ip: buildIpSummary(ipInfo, abuseIpDb),
    trustScore: buildTrustScore(normalizedResult, hasAnalysis),
    riskSignals: hasAnalysis
      ? getRiskSignals(ipInfo, abuseIpDb, cloudflare)
      : [],
    serviceCompatibility: hasAnalysis
      ? buildServiceCompatibilityView(ipInfo, abuseIpDb, ipqs, cloudflare)
      : [],
    ipHistory: normalizeIpHistory(ipHistory),
    networkIntegrity: buildNetworkIntegrity(ipInfo, cloudflare),
  };
}

export function getEmptyAnalysisResult(fallbackIpAddress = ""): AnalysisResult {
  return buildAnalysisResult({
    providerResult: null,
    fallbackIpAddress,
  });
}

export async function analyzeIpAddress(
  ipAddress: string,
): Promise<AnalysisResult> {
  const trimmedIpAddress = ipAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const providerResult = await fetchProviderAnalysis(trimmedIpAddress);
  const storedIpHistory = loadIpHistory();
  const historyRecord = buildIpHistoryRecord(providerResult, trimmedIpAddress);
  const nextIpHistory = getNextIpHistory(storedIpHistory, historyRecord);

  persistIpHistory(nextIpHistory);

  return buildAnalysisResult({
    providerResult,
    ipHistory: getHistoryForIp(nextIpHistory, historyRecord.ip),
    fallbackIpAddress: trimmedIpAddress,
  });
}
