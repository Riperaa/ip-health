"use client";

import { FormEvent, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  getRecommendationTone,
  getTrustScoreStatusLabel,
  getTrustScoreTone,
  getUsageTypeTone,
} from "@/lib/status-colors";
import {
  compareIpAddresses,
  type ComparisonDisplayResult,
  type ComparisonVerdict,
  type IpComparisonResult,
} from "@/lib/analysis";

function VerdictSummary({
  verdict,
  reason,
}: {
  verdict: ComparisonVerdict;
  reason: string;
}) {
  return (
    <div className="surface-card-soft mt-2 rounded-[24px] border bg-white p-5 text-left sm:flex sm:items-start sm:justify-between sm:gap-6">
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
  result: ComparisonDisplayResult;
}) {
  const trustTone = getTrustScoreTone(result.score);
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
    <div className="surface-card flex h-full flex-col rounded-[28px] border bg-white p-5 text-left">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            {label}
          </p>
          <p className="mt-1 break-all text-lg font-semibold text-neutral-950">
            {result.input}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold leading-none text-neutral-950">
            {result.score}
          </p>
          <StatusBadge tone={trustTone} className="mt-2">
            {getTrustScoreStatusLabel(result.score)}
          </StatusBadge>
        </div>
      </div>

      <dl className="mt-4 flex flex-1 flex-col">
        {rows.map((row) => {
          const isRecommendation = row.label === "Recommendation";
          const isUsageType = row.label === "IP Type / Usage Type";
          const isTrustScore = row.label === "Trust Score";

          return (
            <div
              key={row.label}
              className="flex flex-col gap-1 border-b border-neutral-100 py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                {row.label}
              </dt>
              <dd className="break-words text-sm font-medium text-neutral-950">
                {isRecommendation ? (
                  <StatusBadge
                    tone={getRecommendationTone(result.recommendation.label)}
                  >
                    {row.value}
                  </StatusBadge>
                ) : isUsageType ? (
                  <StatusBadge tone={getUsageTypeTone(row.value)}>
                    {row.value}
                  </StatusBadge>
                ) : isTrustScore ? (
                  <StatusBadge tone={trustTone}>{row.value}</StatusBadge>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function IpCompare() {
  const [ipA, setIpA] = useState("");
  const [ipB, setIpB] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<IpComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

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
      setResults(await compareIpAddresses(trimmedIpA, trimmedIpB));
    } catch {
      setResults(null);
      setError("Unable to compare these IPs.");
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-20 pt-[calc(env(safe-area-inset-top)+7rem)] sm:px-8 sm:pb-24 sm:pt-[calc(env(safe-area-inset-top)+8rem)]">
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

      {results ? (
        <div className="mt-8 w-full">
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <ResultCard label="IP A" result={results.ipA} />
            <ResultCard label="IP B" result={results.ipB} />
          </div>

          <VerdictSummary
            verdict={results.verdict}
            reason={results.verdictReason}
          />
        </div>
      ) : null}
    </div>
  );
}
