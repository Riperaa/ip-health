"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  fetchIpAnalysis,
  fetchPublicIp,
  type AnalysisResult,
} from "@/lib/client-ip-analysis";
import {
  buildReasons,
  buildRecommendation,
  buildRecommendationConfidence,
  buildRiskSummary,
  buildServiceCompatibility,
  calculateTrustScore,
  isInfrastructureUsage,
  type AbuseIpDbResponse,
  type IpInfoResponse,
  type IpqsResponse,
  type ServiceCompatibilityStatus,
} from "@/lib/trust-engine";

type ResultCard = {
  label: string;
  value: string;
};

type RecentCheck = {
  ip: string;
  timestamp: number;
};

type CompatibilityExplanationSignals = {
  score: number;
  abuseConfidence: number | null;
  hosting: boolean;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  relay: boolean;
};

type IpTypeBadge =
  | "Residential"
  | "Mobile"
  | "Business"
  | "Infrastructure"
  | "Hosting"
  | "Unknown";

const RECENT_CHECKS_STORAGE_KEY = "ip-health:recent-checks";
const MAX_RECENT_CHECKS = 5;

function getTrustScoreStatus(score: number) {
  if (score >= 90) {
    return {
      label: "Excellent",
      className: "bg-green-50 text-green-700 ring-green-200",
    };
  }

  if (score >= 70) {
    return {
      label: "Good",
      className: "bg-blue-50 text-blue-700 ring-blue-200",
    };
  }

  if (score >= 40) {
    return {
      label: "Medium",
      className: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    };
  }

  return {
    label: "High Risk",
    className: "bg-red-50 text-red-700 ring-red-200",
  };
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

function getCompatibilityExplanationSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
): CompatibilityExplanationSignals {
  const privacy = ipInfo.privacy;

  return {
    score: calculateTrustScore(ipInfo, abuseIpDb, ipqs),
    abuseConfidence: abuseIpDb?.abuseConfidence ?? null,
    hosting:
      privacy?.hosting === true || isInfrastructureUsage(abuseIpDb?.usageType),
    vpn:
      privacy?.vpn === true ||
      ipqs?.vpn === true ||
      ipqs?.activeVpn === true,
    proxy: privacy?.proxy === true || ipqs?.proxy === true,
    tor: privacy?.tor === true || ipqs?.tor === true,
    relay: privacy?.relay === true,
  };
}

function getPrivacySignalLabels(signals: CompatibilityExplanationSignals) {
  return [
    signals.vpn ? "VPN" : null,
    signals.proxy ? "proxy" : null,
    signals.tor ? "Tor" : null,
    signals.relay ? "relay" : null,
  ].filter((signal): signal is string => Boolean(signal));
}

function getCompatibilitySignalReasons(
  signals: CompatibilityExplanationSignals,
) {
  const privacySignals = getPrivacySignalLabels(signals);

  return [
    signals.score < 85 ? `trust score ${signals.score}/100` : null,
    signals.abuseConfidence !== null && signals.abuseConfidence >= 50
      ? `abuse confidence ${signals.abuseConfidence}%`
      : null,
    signals.hosting ? "hosting/infrastructure" : null,
    privacySignals.length > 0 ? privacySignals.join(", ") : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function getServiceCompatibilityReason(
  status: ServiceCompatibilityStatus,
  signals: CompatibilityExplanationSignals,
) {
  const signalReasons = getCompatibilitySignalReasons(signals);

  if (status === "High Risk") {
    if (signalReasons.length > 0) {
      return `High risk because of ${signalReasons.join(", ")}.`;
    }

    return `High risk because the trust score is ${signals.score}/100.`;
  }

  if (status === "Use with Caution") {
    if (signalReasons.length > 0) {
      return `Use caution because of ${signalReasons.join(", ")}.`;
    }

    return `Trust score is ${signals.score}/100, but stricter services may review IP reputation closely.`;
  }

  if (signalReasons.length > 0) {
    return `Generally usable, with ${signalReasons.join(", ")} to keep in mind.`;
  }

  return `Good because trust score is ${signals.score}/100 with no major abuse, hosting, or privacy signals.`;
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

  const ipInfoSignals = [
    privacy?.vpn,
    privacy?.proxy,
    privacy?.tor,
    privacy?.relay,
  ];
  const ipqsSignals = [ipqs?.vpn, ipqs?.proxy, ipqs?.tor, ipqs?.activeVpn];

  if (
    ipInfoSignals.every((signal) => signal === false) ||
    ipqsSignals.every((signal) => signal === false)
  ) {
    return "Clean";
  }

  return "No privacy signal";
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
  const [expandedServiceKey, setExpandedServiceKey] = useState<string | null>(
    null,
  );
  const [isServiceCompatibilityVisible, setIsServiceCompatibilityVisible] =
    useState(false);
  const [isScoreDetailsVisible, setIsScoreDetailsVisible] = useState(false);
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs);
  const reasons = buildReasons(ipInfo, abuseIpDb, ipqs);
  const riskSummary = buildRiskSummary(ipInfo, abuseIpDb, ipqs);
  const serviceCompatibility = buildServiceCompatibility(ipInfo, abuseIpDb, ipqs);
  const recommendation = buildRecommendation(ipInfo, abuseIpDb, ipqs);
  const recommendationConfidence = buildRecommendationConfidence(
    ipInfo,
    abuseIpDb,
    ipqs,
  );
  const status = getTrustScoreStatus(score);
  const ipType = getIpTypeBadge(abuseIpDb?.usageType, ipInfo.privacy);
  const compatibilitySignals = getCompatibilityExplanationSignals(
    ipInfo,
    abuseIpDb,
    ipqs,
  );

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_12px_50px_rgba(0,0,0,0.08)]">
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
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${status.className}`}
          >
            {status.label}
          </span>
          <span className="rounded-full bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200">
            {ipType}
          </span>
        </div>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Risk Summary</p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{riskSummary}</p>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Recommendation</p>
        <p className="mt-2 text-base font-semibold text-neutral-950">
          {recommendation.label}
        </p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {recommendation.summary}
        </p>
        <p className="mt-2 text-sm font-medium text-neutral-500">
          Confidence: {recommendationConfidence}
        </p>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-950/[0.03]">
          <button
            type="button"
            aria-expanded={isServiceCompatibilityVisible}
            onClick={() =>
              setIsServiceCompatibilityVisible(
                (currentVisibility) => !currentVisibility,
              )
            }
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <span className="w-4 text-xs text-neutral-400" aria-hidden="true">
              {isServiceCompatibilityVisible ? "▾" : "▸"}
            </span>
            <span>Service Compatibility</span>
          </button>
        </div>
        {isServiceCompatibilityVisible ? (
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-950/[0.03]">
            <div className="grid gap-3 sm:grid-cols-2">
              {serviceCompatibility.map((category) => (
                <div
                  key={category.category}
                  className="rounded-2xl border border-neutral-200 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                    {category.category}
                  </p>
                  <ul className="mt-3 space-y-1">
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
                            className="w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="font-medium text-neutral-950">
                                {service.name}
                              </span>
                              <span className="shrink-0 text-right font-semibold text-neutral-500">
                                {getServiceStatusLabel(service.status)}
                              </span>
                            </span>
                            {isExpanded ? (
                              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                                {getServiceCompatibilityReason(
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
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              These recommendations are based on IP reputation and
              infrastructure signals. Services may also consider account
              history, device reputation, browser fingerprint, and behavior.
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-950/[0.03]">
          <button
            type="button"
            aria-expanded={isScoreDetailsVisible}
            onClick={() =>
              setIsScoreDetailsVisible(
                (currentVisibility) => !currentVisibility,
              )
            }
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <span className="w-4 text-xs text-neutral-400" aria-hidden="true">
              {isScoreDetailsVisible ? "▾" : "▸"}
            </span>
            <span>Why this score?</span>
          </button>
        </div>
        {isScoreDetailsVisible ? (
          <ul className="mt-3 list-disc space-y-1 rounded-2xl border border-neutral-200 bg-white p-4 pl-9 text-sm text-neutral-600 shadow-sm shadow-neutral-950/[0.03]">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function IpAnalyzer() {
  const [ipAddress, setIpAddress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);

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
    const trimmedIpAddress = nextIpAddress.trim();

    if (!trimmedIpAddress) {
      setError("Unable to detect your IP.");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      setResult(await fetchIpAnalysis(trimmedIpAddress));
      saveRecentCheck(trimmedIpAddress);
    } catch {
      setResult(null);
      setError("Unable to detect your IP.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [saveRecentCheck]);

  const detectPublicIp = useCallback(async () => {
    setError("");
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

  return (
    <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-3">
      <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={detectPublicIp}
          disabled={isDetecting}
          className="h-12 rounded-full border border-neutral-200 bg-white px-6 text-sm font-medium text-neutral-700 shadow-sm shadow-neutral-950/[0.04] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDetecting ? "Detecting..." : "Auto Detect My IP"}
        </button>

        <div className="mt-3 flex w-full flex-col gap-3 rounded-[28px] border border-neutral-200 bg-white p-2 shadow-[0_12px_50px_rgba(0,0,0,0.08)] transition focus-within:border-neutral-300 sm:flex-row sm:items-center">
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
            className="h-12 shrink-0 rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {recentChecks.length > 0 ? (
        <div className="w-full text-left">
          <p className="text-sm font-semibold text-neutral-950">Recent Checks</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentChecks.map((recentCheck) => (
              <button
                key={recentCheck.ip}
                type="button"
                onClick={() => handleRecentCheckClick(recentCheck.ip)}
                disabled={isAnalyzing}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recentCheck.ip}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 flex w-full flex-col gap-3 text-left">
          <TrustScoreCard
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
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-950/[0.03]"
              >
                <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                  {card.label}
                </p>
                <p className="mt-1 break-words text-base font-medium text-neutral-950">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
