"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  buildReasons,
  buildRiskSummary,
  buildServiceCompatibility,
  calculateTrustScore,
  type AbuseIpDbResponse,
  type IpInfoResponse,
  type IpqsResponse,
  type ServiceCompatibilityStatus,
} from "@/lib/trust-engine";

type AnalysisResult = {
  ipInfo: IpInfoResponse;
  abuseIpDb: AbuseIpDbResponse | null;
  ipqs: IpqsResponse | null;
};

type ResultCard = {
  label: string;
  value: string;
};

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

function formatHosting(value?: boolean) {
  if (value === true) {
    return "Detected";
  }

  if (value === false) {
    return "Not detected";
  }

  return "Not identified";
}

function getPrivacySummary(privacy?: IpInfoResponse["privacy"]) {
  if (!privacy) {
    return "Not identified";
  }

  const privacySignals = [
    privacy.vpn,
    privacy.proxy,
    privacy.tor,
    privacy.relay,
  ];
  const enabledSignals = [
    privacy.vpn && "VPN",
    privacy.proxy && "Proxy",
    privacy.tor && "Tor",
    privacy.relay && "Relay",
  ].filter(Boolean);

  if (enabledSignals.length > 0) {
    return enabledSignals.join(", ");
  }

  if (privacy.service?.trim()) {
    return formatDetail(privacy.service);
  }

  if (!privacySignals.some((signal) => signal !== undefined)) {
    return "Not identified";
  }

  return "Clean";
}

function formatAbuseConfidence(abuseIpDb?: AbuseIpDbResponse | null) {
  const abuseConfidence = abuseIpDb?.abuseConfidence ?? null;

  if (abuseConfidence === null) {
    return "Not identified";
  }

  return `${abuseConfidence}%`;
}

function getResultCards(
  result: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
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

  return [
    { label: "IP", value: formatDetail(result.ip) },
    { label: "Country", value: formatDetail(result.country_name ?? result.country) },
    { label: "Region / State", value: formatDetail(result.region) },
    { label: "City", value: formatDetail(result.city) },
    { label: "ISP", value: formatDetail(isp) },
    { label: "Organization", value: formatDetail(organization) },
    { label: "ASN", value: formatDetail(asn) },
    { label: "Usage Type", value: formatDetail(abuseIpDb?.usageType) },
    { label: "Hosting", value: formatHosting(result.privacy?.hosting) },
    { label: "Privacy", value: getPrivacySummary(result.privacy) },
    { label: "Abuse Confidence", value: formatAbuseConfidence(abuseIpDb) },
  ];
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

  return (await response.json()) as IpInfoResponse;
}

async function fetchAbuseIpDb(nextIpAddress: string) {
  const url = new URL("/api/abuseipdb", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AbuseIpDbResponse;
  } catch {
    return null;
  }
}

async function fetchIpqs(nextIpAddress: string) {
  const url = new URL("/api/ipqs", window.location.origin);
  url.searchParams.set("ip", nextIpAddress);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as IpqsResponse;
  } catch {
    return null;
  }
}

async function fetchPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error("Unable to detect IP address.");
  }

  const data = (await response.json()) as { ip?: string };

  if (!data.ip) {
    throw new Error("Missing IP address.");
  }

  return data.ip;
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
  const reasons = buildReasons(ipInfo, abuseIpDb, ipqs);
  const riskSummary = buildRiskSummary(ipInfo, abuseIpDb, ipqs);
  const serviceCompatibility = buildServiceCompatibility(ipInfo, abuseIpDb, ipqs);
  const status = getTrustScoreStatus(score);

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
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Risk Summary</p>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{riskSummary}</p>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">
          Service Compatibility
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {serviceCompatibility.map((category) => (
            <div
              key={category.category}
              className="rounded-2xl border border-neutral-200 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                {category.category}
              </p>
              <ul className="mt-3 space-y-2">
                {category.services.map((service) => (
                  <li
                    key={service.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium text-neutral-950">
                      {service.name}
                    </span>
                    <span className="shrink-0 text-right font-semibold text-neutral-500">
                      {getServiceStatusLabel(service.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          These recommendations are based on IP reputation and infrastructure
          signals. Services may also consider account history, device reputation,
          browser fingerprint, and behavior.
        </p>
      </div>
      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-sm font-semibold text-neutral-950">Why this score?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function IpAnalyzer() {
  const [ipAddress, setIpAddress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedIpAddress = ipAddress.trim();

    if (!trimmedIpAddress) {
      setError("Unable to detect your IP.");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      const [ipInfo, abuseIpDb, ipqs] = await Promise.all([
        fetchIpInfo(trimmedIpAddress),
        fetchAbuseIpDb(trimmedIpAddress),
        fetchIpqs(trimmedIpAddress),
      ]);
      setResult({ ipInfo, abuseIpDb, ipqs });
    } catch {
      setResult(null);
      setError("Unable to detect your IP.");
    } finally {
      setIsAnalyzing(false);
    }
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

      {result ? (
        <div className="mt-5 flex w-full flex-col gap-3 text-left">
          <TrustScoreCard
            ipInfo={result.ipInfo}
            abuseIpDb={result.abuseIpDb}
            ipqs={result.ipqs}
          />

          <div className="grid w-full gap-3 sm:grid-cols-2">
            {getResultCards(result.ipInfo, result.abuseIpDb).map((card) => (
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
