"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  fetchIpAnalysis,
  type AnalysisResult,
} from "@/lib/client-ip-analysis";
import {
  buildRecommendation,
  buildRecommendationConfidence,
  calculateTrustScore,
  isInfrastructureUsage,
  type AbuseIpDbResponse,
  type IpInfoResponse,
  type IpqsResponse,
  type Recommendation,
  type RecommendationConfidence,
} from "@/lib/trust-engine";

type CompareResult = AnalysisResult & {
  input: string;
};

type DisplayResult = {
  input: string;
  ip: string;
  score: number;
  recommendation: Recommendation;
  confidence: RecommendationConfidence;
  usageType: string;
  abuseConfidence: string;
  abuseConfidenceValue: number | null;
  country: string;
  ispOrg: string;
  hasSevereAbuseOrTor: boolean;
  hasInfrastructureSignals: boolean;
};

type Verdict = "IP A" | "IP B" | "Similar risk";

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

function formatUsageType(
  usageType?: string | null,
  privacy?: IpInfoResponse["privacy"],
) {
  if (formatDetail(usageType) !== "Not identified") {
    return isInfrastructureUsage(usageType)
      ? "Infrastructure"
      : formatDetail(usageType);
  }

  if (privacy?.hosting === true || isInfrastructureUsage(usageType)) {
    return "Infrastructure";
  }

  return "Not identified";
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

function getAbuseConfidenceValue(abuseIpDb?: AbuseIpDbResponse | null) {
  return abuseIpDb?.abuseConfidence ?? null;
}

function hasTor(
  ipInfo: IpInfoResponse,
  ipqs?: IpqsResponse | null,
) {
  return ipInfo.privacy?.tor === true || ipqs?.tor === true;
}

function hasSevereAbuseOrTor(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
  ipqs?: IpqsResponse | null,
) {
  return (abuseIpDb?.abuseConfidence ?? 0) >= 85 || hasTor(ipInfo, ipqs);
}

function hasInfrastructureSignals(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  return (
    ipInfo.privacy?.hosting === true ||
    isInfrastructureUsage(abuseIpDb?.usageType)
  );
}

function getIspOrg(
  ipInfo: IpInfoResponse,
  abuseIpDb?: AbuseIpDbResponse | null,
) {
  const parsedOrg = parseOrg(ipInfo.org);

  return formatDetail(
    pickDetail(
      ipInfo.company?.name,
      abuseIpDb?.isp,
      ipInfo.asn?.name,
      parsedOrg.name,
      ipInfo.org,
    ),
  );
}

function getDisplayResult(result: CompareResult): DisplayResult {
  const { ipInfo, abuseIpDb, ipqs } = result;
  const score = calculateTrustScore(ipInfo, abuseIpDb, ipqs);

  return {
    input: result.input,
    ip: formatDetail(ipInfo.ip ?? result.input),
    score,
    recommendation: buildRecommendation(ipInfo, abuseIpDb, ipqs),
    confidence: buildRecommendationConfidence(ipInfo, abuseIpDb, ipqs),
    usageType: formatUsageType(abuseIpDb?.usageType, ipInfo.privacy),
    abuseConfidence: formatAbuseConfidence(abuseIpDb),
    abuseConfidenceValue: getAbuseConfidenceValue(abuseIpDb),
    country: formatDetail(pickDetail(ipInfo.country_name, ipInfo.country)),
    ispOrg: getIspOrg(ipInfo, abuseIpDb),
    hasSevereAbuseOrTor: hasSevereAbuseOrTor(ipInfo, abuseIpDb, ipqs),
    hasInfrastructureSignals: hasInfrastructureSignals(ipInfo, abuseIpDb),
  };
}

function getVerdict(ipA: DisplayResult, ipB: DisplayResult): Verdict {
  if (ipA.hasSevereAbuseOrTor && !ipB.hasSevereAbuseOrTor) {
    return "IP B";
  }

  if (ipB.hasSevereAbuseOrTor && !ipA.hasSevereAbuseOrTor) {
    return "IP A";
  }

  const scoreDifference = ipA.score - ipB.score;

  if (Math.abs(scoreDifference) < 10) {
    return "Similar risk";
  }

  return scoreDifference > 0 ? "IP A" : "IP B";
}

function getAbuseConfidenceDifference(ipA: DisplayResult, ipB: DisplayResult) {
  if (
    ipA.abuseConfidenceValue === null ||
    ipB.abuseConfidenceValue === null
  ) {
    return null;
  }

  return ipA.abuseConfidenceValue - ipB.abuseConfidenceValue;
}

function getVerdictReason(ipA: DisplayResult, ipB: DisplayResult, verdict: Verdict) {
  const scoreDifference = ipA.score - ipB.score;
  const abuseConfidenceDifference = getAbuseConfidenceDifference(ipA, ipB);

  if (verdict === "Similar risk") {
    return "Both IPs have similar risk levels.";
  }

  const winner = verdict === "IP A" ? ipA : ipB;
  const other = verdict === "IP A" ? ipB : ipA;
  const winnerLabel = verdict;
  const scoreLead = verdict === "IP A" ? scoreDifference : -scoreDifference;
  const abuseLead =
    abuseConfidenceDifference === null
      ? null
      : verdict === "IP A"
        ? -abuseConfidenceDifference
        : abuseConfidenceDifference;

  if (other.hasSevereAbuseOrTor && !winner.hasSevereAbuseOrTor) {
    return `${winnerLabel} avoids stronger abuse or Tor signals on the other IP.`;
  }

  if (other.hasInfrastructureSignals && !winner.hasInfrastructureSignals) {
    return `${winnerLabel} has fewer infrastructure signals and a cleaner usage profile.`;
  }

  if (scoreLead >= 10 && abuseLead !== null && abuseLead >= 10) {
    return `${winnerLabel} has a higher trust score and lower abuse confidence.`;
  }

  if (scoreLead >= 10) {
    return `${winnerLabel} has a higher trust score.`;
  }

  if (abuseLead !== null && abuseLead >= 10) {
    return `${winnerLabel} has lower abuse confidence.`;
  }

  return `${winnerLabel} has the stronger overall comparison signals.`;
}

function VerdictSummary({
  verdict,
  reason,
}: {
  verdict: Verdict;
  reason: string;
}) {
  return (
    <div className="mt-3 rounded-[28px] border border-neutral-200 bg-white p-5 text-left shadow-sm shadow-neutral-950/[0.03] sm:flex sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
          Better choice
        </p>
        <p className="mt-1 text-2xl font-semibold text-neutral-950">
          {verdict}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600 sm:mt-1 sm:max-w-xl">
        {reason}
      </p>
    </div>
  );
}

function ResultCard({
  label,
  result,
}: {
  label: "IP A" | "IP B";
  result: DisplayResult;
}) {
  const rows = [
    { label: "IP", value: result.ip },
    { label: "Trust Score", value: `${result.score}/100` },
    { label: "Recommendation", value: result.recommendation.label },
    { label: "Confidence", value: result.confidence },
    { label: "IP Type / Usage Type", value: result.usageType },
    { label: "Abuse Confidence", value: result.abuseConfidence },
    { label: "Country", value: result.country },
    { label: "ISP / Organization", value: result.ispOrg },
  ];

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-neutral-200 bg-white p-5 text-left shadow-[0_12px_50px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            {label}
          </p>
          <p className="mt-1 break-all text-lg font-semibold text-neutral-950">
            {result.input}
          </p>
        </div>
        <p className="shrink-0 text-3xl font-semibold leading-none text-neutral-950">
          {result.score}
        </p>
      </div>

      <dl className="mt-4 flex flex-1 flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 border-b border-neutral-100 py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
              {row.label}
            </dt>
            <dd className="break-words text-sm font-medium text-neutral-950">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function IpCompare() {
  const [ipA, setIpA] = useState("");
  const [ipB, setIpB] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<{
    ipA: CompareResult;
    ipB: CompareResult;
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const displayResults = useMemo(() => {
    if (!results) {
      return null;
    }

    const nextIpA = getDisplayResult(results.ipA);
    const nextIpB = getDisplayResult(results.ipB);
    const verdict = getVerdict(nextIpA, nextIpB);

    return {
      ipA: nextIpA,
      ipB: nextIpB,
      verdict,
      verdictReason: getVerdictReason(nextIpA, nextIpB, verdict),
    };
  }, [results]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedIpA = ipA.trim();
    const trimmedIpB = ipB.trim();

    if (!trimmedIpA || !trimmedIpB) {
      setError("Enter both IP addresses.");
      setResults(null);
      return;
    }

    setError("");
    setIsComparing(true);

    try {
      const [nextIpA, nextIpB] = await Promise.all([
        fetchIpAnalysis(trimmedIpA),
        fetchIpAnalysis(trimmedIpB),
      ]);

      setResults({
        ipA: { ...nextIpA, input: trimmedIpA },
        ipB: { ...nextIpB, input: trimmedIpB },
      });
    } catch {
      setResults(null);
      setError("Unable to compare these IPs.");
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 py-24 sm:px-8">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
          Compare IPs
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
          Compare two IP addresses side by side.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 flex w-full flex-col gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-left">
              <span className="sr-only">IP A</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={ipA}
                onChange={(event) => setIpA(event.target.value)}
                placeholder="IP A"
                className="h-14 w-full rounded-full border border-neutral-200 bg-white px-5 text-base text-neutral-950 shadow-sm shadow-neutral-950/[0.03] outline-none transition placeholder:text-neutral-400 focus:border-neutral-300"
              />
            </label>
            <label className="text-left">
              <span className="sr-only">IP B</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={ipB}
                onChange={(event) => setIpB(event.target.value)}
                placeholder="IP B"
                className="h-14 w-full rounded-full border border-neutral-200 bg-white px-5 text-base text-neutral-950 shadow-sm shadow-neutral-950/[0.03] outline-none transition placeholder:text-neutral-400 focus:border-neutral-300"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isComparing}
            className="h-12 self-center rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isComparing ? "Comparing..." : "Compare"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </div>

      {displayResults ? (
        <div className="mt-8 w-full">
          <div className="grid items-stretch gap-3 md:grid-cols-2">
            <ResultCard label="IP A" result={displayResults.ipA} />
            <ResultCard label="IP B" result={displayResults.ipB} />
          </div>

          <VerdictSummary
            verdict={displayResults.verdict}
            reason={displayResults.verdictReason}
          />
        </div>
      ) : null}
    </div>
  );
}
