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
import {
  INVALID_IP_ADDRESS_MESSAGE,
  isValidIpv4Address,
} from "@/lib/analysis/validation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { messages, type Locale } from "@/lib/localization";

function VerdictSummary({
  verdict,
  reason,
  locale,
}: {
  verdict: ComparisonVerdict;
  reason: string;
  locale: Locale;
}) {
  const t = messages(locale);
  return (
    <div className="surface-card-soft mt-2 rounded-[24px] border bg-white p-5 text-left sm:flex sm:items-start sm:justify-between sm:gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
          {t("Better choice")}
        </p>
        <p className="mt-1 text-2xl font-semibold text-neutral-950">
          {t(verdict)}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600 sm:mt-1 sm:max-w-xl">
        {t(reason)}
      </p>
    </div>
  );
}

function ResultCard({
  label,
  result,
  locale,
}: {
  label: "IP A" | "IP B";
  result: ComparisonDisplayResult;
  locale: Locale;
}) {
  const t = messages(locale);
  const trustTone = getTrustScoreTone(result.score);
  const rows = [
    { label: "IP", value: result.ip },
    { label: "IP Health Score", value: `${result.score}/100` },
    { label: "Recommendation", value: result.recommendation.label },
    { label: "Confidence", value: result.confidence },
    {
      label: "Network Identity",
      value:
        result.identityProvider === "Not identified"
          ? result.networkIdentity
          : `${result.networkIdentity} · ${result.identityProvider}`,
    },
    {
      label: "Sharing Risk",
      value: result.sharingRisk.level,
      tone: result.sharingRisk.tone,
    },
    { label: "Usage Type", value: result.usageType },
    { label: "Abuse Confidence", value: result.abuseConfidence },
    { label: "Country", value: result.country },
    { label: "ISP / Organization", value: result.ispOrg },
  ];

  return (
    <div className="surface-card flex h-full flex-col rounded-[28px] border bg-white p-5 text-left">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            {t(label)}
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
            {t(getTrustScoreStatusLabel(result.score))}
          </StatusBadge>
        </div>
      </div>

      <dl className="mt-4 flex flex-1 flex-col">
        {rows.map((row) => {
          const isRecommendation = row.label === "Recommendation";
          const isUsageType =
            row.label === "Usage Type" || row.label === "Network Identity";
          const isTrustScore = row.label === "IP Health Score";
          const isSharingRisk = row.label === "Sharing Risk";

          return (
            <div
              key={row.label}
              className="flex flex-col gap-1 border-b border-neutral-100 py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                {t(row.label)}
              </dt>
              <dd className="break-words text-sm font-medium text-neutral-950">
                {isRecommendation ? (
                  <StatusBadge
                    tone={getRecommendationTone(result.recommendation.label)}
                  >
                    {t(row.value)}
                  </StatusBadge>
                ) : isUsageType ? (
                  <StatusBadge tone={getUsageTypeTone(row.value)}>
                    {t(row.value)}
                  </StatusBadge>
                ) : isTrustScore ? (
                  <StatusBadge tone={trustTone}>{row.value}</StatusBadge>
                ) : isSharingRisk ? (
                  <StatusBadge tone={row.tone ?? "neutral"}>
                    {row.value}
                  </StatusBadge>
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

export function IpCompare({ locale = "en" }: { locale?: Locale }) {
  const t = messages(locale);
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
      setError(t("Enter both IP addresses."));
      setResults(null);
      return;
    }

    if (!isValidIpv4Address(trimmedIpA) || !isValidIpv4Address(trimmedIpB)) {
      setError(t(INVALID_IP_ADDRESS_MESSAGE));
      setResults(null);
      return;
    }

    setError("");
    setIsComparing(true);
    trackAnalyticsEvent("compare_started", {});

    try {
      setResults(await compareIpAddresses(trimmedIpA, trimmedIpB));
    } catch {
      setResults(null);
      setError(t("Unable to compare these IPs."));
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-20 pt-[calc(env(safe-area-inset-top)+7rem)] sm:px-8 sm:pb-24 sm:pt-[calc(env(safe-area-inset-top)+8rem)]">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
          {t("Compare IPs")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
          {t("Compare two IP addresses side by side.")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 flex w-full flex-col gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-left">
              <span className="sr-only">{t("IP A")}</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={ipA}
                onChange={(event) => setIpA(event.target.value)}
                placeholder={t("IP A")}
                className="h-14 w-full rounded-full border border-neutral-200 bg-white px-5 text-base text-neutral-950 shadow-sm shadow-neutral-950/[0.03] outline-none transition placeholder:text-neutral-400 focus:border-neutral-300"
              />
            </label>
            <label className="text-left">
              <span className="sr-only">{t("IP B")}</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={ipB}
                onChange={(event) => setIpB(event.target.value)}
                placeholder={t("IP B")}
                className="h-14 w-full rounded-full border border-neutral-200 bg-white px-5 text-base text-neutral-950 shadow-sm shadow-neutral-950/[0.03] outline-none transition placeholder:text-neutral-400 focus:border-neutral-300"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isComparing}
            className="h-12 self-center rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isComparing ? t("Comparing...") : t("Compare")}
          </button>
        </form>

        {error ? (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </div>

      {results ? (
        <div className="mt-8 w-full">
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <ResultCard label="IP A" result={results.ipA} locale={locale} />
            <ResultCard label="IP B" result={results.ipB} locale={locale} />
          </div>

          <VerdictSummary
            verdict={results.verdict}
            reason={results.verdictReason}
            locale={locale}
          />
        </div>
      ) : null}
    </div>
  );
}
