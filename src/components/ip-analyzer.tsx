"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  fetchIpAnalysis,
  fetchPublicIp,
  type AnalysisResult,
} from "@/lib/client-ip-analysis";
import {
  buildRecommendation,
  calculateTrustScore,
  isInfrastructureUsage,
  type AbuseIpDbResponse,
  type IpInfoResponse,
} from "@/lib/trust-engine";
import {
  getRecommendationTone,
  type StatusTone,
} from "@/lib/status-colors";

type RecentCheck = {
  ip: string;
  timestamp: number;
};

type RiskLevel = "Low" | "Medium" | "High";

type RiskSignal = {
  label: string;
  detail: string;
  tone: StatusTone;
};

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
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

function hasInfrastructureSignal(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType)
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
  score: number,
) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;
  const privacySignals = getPrivacySignals(ipInfo);
  const hasInfrastructure = hasInfrastructureSignal(ipInfo, abuseIpDb);
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

  if (hasInfrastructure) {
    items.push(
      `Network usage looks like ${usageType.toLowerCase()}, which stricter services may review.`,
    );
  } else {
    items.push("No hosting infrastructure signal was detected.");
  }

  if (hasDetail(networkIdentity.asn) || hasDetail(networkIdentity.isp)) {
    items.push(
      `Network owner is visible: ${[
        networkIdentity.asn,
        networkIdentity.isp,
      ]
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

  if (abuseConfidence !== null && abuseConfidence > 0) {
    signals.push({
      label: "Abuse history",
      detail: `${formatAbuseConfidence(abuseIpDb)} confidence reported.`,
      tone: abuseConfidence >= 50 ? "risk" : "caution",
    });
  }

  if (hasInfrastructureSignal(ipInfo, abuseIpDb)) {
    signals.push({
      label: "Suspicious ASN",
      detail: hasDetail(networkIdentity.asn)
        ? `${networkIdentity.asn} appears to be hosting or infrastructure.`
        : "Network appears to be hosting or infrastructure.",
      tone: "infrastructure",
    });
  }

  return signals;
}

function formatRawData(data: unknown) {
  if (data === null || data === undefined) {
    return "No raw data returned.";
  }

  return JSON.stringify(data, null, 2);
}

function MainRiskReport({
  ipInfo,
  abuseIpDb,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
}) {
  const score = calculateTrustScore(ipInfo, abuseIpDb, null);
  const riskLevel = getRiskLevel(score);
  const recommendation = buildRecommendation(ipInfo, abuseIpDb, null);
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
            {facts.map((fact) => (
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
            {score}
            <span className="pb-2 text-xl font-semibold text-neutral-400">
              /100
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            <StatusBadge
              tone={getRiskLevelTone(riskLevel)}
              className="px-3 py-1.5 text-sm"
            >
              {riskLevel} Risk
            </StatusBadge>
            <StatusBadge
              tone={getRecommendationTone(recommendation.label)}
              variant="quiet"
            >
              {recommendation.label}
            </StatusBadge>
          </div>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-100 pt-4 text-sm leading-6 text-neutral-600">
        {getRiskLevelSummary(riskLevel)} {recommendation.summary}
      </p>
    </section>
  );
}

function ScoreExplanationSection({
  ipInfo,
  abuseIpDb,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
}) {
  const score = calculateTrustScore(ipInfo, abuseIpDb, null);
  const explanationItems = getScoreExplanationItems(ipInfo, abuseIpDb, score);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          Score Explanation
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          Why this IP received a {score}/100 trust score.
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {explanationItems.map((item) => (
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

function RiskSignalsSection({
  ipInfo,
  abuseIpDb,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
}) {
  const riskSignals = getRiskSignals(ipInfo, abuseIpDb);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            Risk Signals
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Detected issues that may affect account access or verification.
          </p>
        </div>
        {riskSignals.length === 0 ? (
          <StatusBadge tone="good" className="mt-1 sm:mt-0">
            Clear
          </StatusBadge>
        ) : (
          <StatusBadge tone="caution" className="mt-1 sm:mt-0">
            {riskSignals.length} found
          </StatusBadge>
        )}
      </div>

      {riskSignals.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-100">
          {riskSignals.map((signal) => (
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
      ) : (
        <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-emerald-800">
          No active proxy, abuse, or suspicious ASN signal was found in the
          available data.
        </p>
      )}
    </section>
  );
}

function AdvancedSourcesSection({
  ipInfo,
  abuseIpDb,
}: {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
}) {
  const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);
  const rawSources = [
    { name: "IPinfo", data: ipInfo },
    { name: "AbuseIPDB", data: abuseIpDb?.raw ?? abuseIpDb },
  ];

  return (
    <section>
      <div className="disclosure-card overflow-hidden rounded-2xl border bg-white">
        <button
          type="button"
          aria-expanded={isAdvancedVisible}
          onClick={() =>
            setIsAdvancedVisible(
              (currentVisibility) => !currentVisibility,
            )
          }
          className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-[#f3f4f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <span>Advanced</span>
          <span className="text-xs text-neutral-400" aria-hidden="true">
            {isAdvancedVisible ? "Hide" : "Show"}
          </span>
        </button>
      </div>

      {isAdvancedVisible ? (
        <div className="surface-card mt-3 space-y-3 rounded-2xl border bg-white p-4">
          {rawSources.map((source) => (
            <div key={source.name}>
              <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                {source.name}
              </p>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">
                {formatRawData(source.data)}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function IpAnalyzer() {
  const [ipAddress, setIpAddress] = useState("");
  const [error, setError] = useState("");
  const [analysisErrorIp, setAnalysisErrorIp] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
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
    setIsAnalyzing(true);

    try {
      const nextResult = await fetchIpAnalysis(trimmedIpAddress);

      setResult(nextResult);
      saveRecentCheck(trimmedIpAddress);
    } catch {
      setResult(null);
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
        <div className="mt-6 flex w-full flex-col gap-4 text-left">
          <MainRiskReport
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
          />

          <ScoreExplanationSection
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
          />

          <RiskSignalsSection
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
          />

          <AdvancedSourcesSection
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
          />

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
