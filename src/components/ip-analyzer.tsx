"use client";

import { useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { AnalysisResult } from "@/lib/analysis";

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

function MainRiskReport({ result }: { result: AnalysisResult }) {
  const display = result.finalDecision?.display;
  const trustScoreDisplay = display?.trustScoreValue ?? "--";
  const trustScoreSuffix = display?.trustScoreSuffix ?? "/100";
  const summary =
    display?.summary ?? "Run an analysis to populate this report.";

  return (
    <section className="surface-card-primary rounded-[28px] border bg-white p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            IP Risk Report
          </p>
          <h2 className="mt-2 break-all text-3xl font-semibold leading-tight text-neutral-950 sm:text-4xl">
            {result.ip.address}
          </h2>
          <dl className="mt-5 grid gap-3 text-left sm:grid-cols-3">
            {result.ip.facts.map((fact) => (
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
            {trustScoreDisplay}
            <span className="pb-2 text-xl font-semibold text-neutral-400">
              {trustScoreSuffix}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            {display ? (
              <>
                <StatusBadge
                  tone={display.riskBadge.tone}
                  className="px-3 py-1.5 text-sm"
                >
                  {display.riskBadge.label}
                </StatusBadge>
                <StatusBadge
                  tone={display.serviceCompatibilityBadge.tone}
                  variant="quiet"
                >
                  {display.serviceCompatibilityBadge.label}
                </StatusBadge>
              </>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                Pending
              </StatusBadge>
            )}
          </div>
        </div>
      </div>

      <p className="mt-5 border-t border-neutral-100 pt-4 text-sm leading-6 text-neutral-600">
        {summary}
      </p>
    </section>
  );
}

function IpHistorySection({ result }: { result: AnalysisResult }) {
  const [isIpHistoryVisible, setIsIpHistoryVisible] = useState(false);

  return (
    <DisclosureSection
      title="IP History"
      summary="Saved in this browser only"
      isExpanded={isIpHistoryVisible}
      onToggle={() =>
        setIsIpHistoryVisible((currentVisibility) => !currentVisibility)
      }
      contentId="ip-history-content"
    >
      <div className="surface-card mt-3 overflow-hidden rounded-2xl border bg-white">
        <ul
          hidden={result.ipHistory.length === 0}
          className="divide-y divide-neutral-100"
        >
          {result.ipHistory.map((historyRecord) => (
            <li
              key={`${historyRecord.timestamp}:${historyRecord.ip}`}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1.2fr_0.7fr_1fr_0.8fr] sm:gap-3"
            >
              <span className="font-medium text-neutral-950">
                {historyRecord.ip}
              </span>
              <span className="text-neutral-600">
                {historyRecord.trustScore}/100
              </span>
              <span className="text-neutral-600">
                {historyRecord.recommendationLabel}
              </span>
              <span className="text-neutral-600">
                {historyRecord.abuseConfidence === null
                  ? "No abuse score"
                  : `${historyRecord.abuseConfidence}%`}
              </span>
            </li>
          ))}
        </ul>
        <p
          hidden={result.ipHistory.length > 0}
          className="px-4 py-3 text-sm text-neutral-500"
        >
          No local history for this IP.
        </p>
      </div>
    </DisclosureSection>
  );
}

function NetworkIntegritySection({ result }: { result: AnalysisResult }) {
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
        <StatusBadge
          tone={result.networkIntegrity.tone}
          className="mt-1 sm:mt-0"
        >
          {result.networkIntegrity.label}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.networkIntegrity.items.map((item) => (
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
        hidden={result.networkIntegrity.hasCloudflare}
        className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500"
      >
        {result.networkIntegrity.unavailableMessage}
      </p>
    </section>
  );
}

function RealConnectivitySection({ result }: { result: AnalysisResult }) {
  const connectivityItems = [
    {
      label: "Google",
      probe: result.connectivity?.google,
    },
    {
      label: "YouTube",
      probe: result.connectivity?.youtube,
    },
    {
      label: "OpenAI / ChatGPT",
      probe: result.connectivity?.openai,
    },
  ];

  return (
    <section className="surface-card overflow-hidden rounded-2xl border bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-950">
          Browser Reachability Signal
        </h3>
      </div>
      <ul className="divide-y divide-neutral-100">
        {connectivityItems.map((item) => {
          const status = item.probe?.status ?? "not_verified";
          const tone =
            status === "verified_reachable"
              ? "good"
              : status === "unreachable"
                ? "risk"
                : "neutral";
          const label =
            status === "verified_reachable"
              ? "Verified"
              : status === "unreachable"
                ? "Failed"
                : "Not Verified";

          return (
            <li
              key={item.label}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span className="font-medium text-neutral-950">{item.label}</span>
              <StatusBadge tone={tone} variant="quiet">
                {label}
              </StatusBadge>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-500">
        Browser privacy and CORS restrictions may prevent full verification.
        When access cannot be strongly verified, IP Health shows Not Verified
        instead of Available.
      </p>
    </section>
  );
}

function getServiceAvailabilityTone(
  finalAvailability: AnalysisResult["serviceCompatibility"][number]["services"][number]["finalAvailability"],
) {
  if (finalAvailability === "Verified") {
    return "good";
  }

  if (finalAvailability === "Restricted") {
    return "risk";
  }

  return "neutral";
}

function ServiceCompatibilitySection({ result }: { result: AnalysisResult }) {
  const [isServiceCompatibilityVisible, setIsServiceCompatibilityVisible] =
    useState(false);
  const [expandedServiceCategories, setExpandedServiceCategories] = useState<
    string[]
  >([]);
  const [expandedServiceKey, setExpandedServiceKey] = useState<string | null>(
    null,
  );
  const hasServiceCompatibility = result.serviceCompatibility.length > 0;
  const reportDisplay = result.finalDecision?.display;
  const sectionTitle =
    reportDisplay?.serviceCompatibility.sectionTitle ?? "Service Compatibility";
  const emptyMessage =
    reportDisplay?.serviceCompatibility.emptyMessage ??
    "No service compatibility data available.";
  const footnote =
    reportDisplay?.serviceCompatibility.footnote ??
    "This reflects both IP reputation and regional accessibility.";

  return (
    <DisclosureSection
      title={sectionTitle}
      isExpanded={isServiceCompatibilityVisible}
      onToggle={() =>
        setIsServiceCompatibilityVisible(
          (currentVisibility) => !currentVisibility,
        )
      }
      contentId="service-compatibility-content"
    >
      <div className="surface-card mt-3 overflow-hidden rounded-2xl border bg-white">
        {hasServiceCompatibility && reportDisplay ? (
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
                IP Reputation
              </span>
              <StatusBadge
                tone={reportDisplay.serviceCompatibilityBadge.tone}
                variant="quiet"
              >
                {reportDisplay.serviceCompatibilityBadge.label}
              </StatusBadge>
            </span>
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
                Regional Availability
              </span>
              <StatusBadge
                tone={reportDisplay.regionAvailabilityBadge.tone}
                variant="quiet"
              >
                {reportDisplay.regionAvailabilityBadge.label}
              </StatusBadge>
            </span>
          </div>
        ) : null}
        <div className="divide-y divide-neutral-100">
          {result.serviceCompatibility.map((category) => {
            const isCategoryExpanded = expandedServiceCategories.includes(
              category.category,
            );
            const categoryContentId = `service-compatibility-${category.category}`;

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
                    {category.summary}
                  </span>
                </button>
                <ul
                  id={categoryContentId}
                  hidden={!isCategoryExpanded}
                  className="space-y-1 border-t border-neutral-100 bg-neutral-50/50 px-3 py-3 sm:px-4"
                >
                  {category.services.map((service) => {
                    const serviceKey = `${category.category}:${service.name}`;
                    const isExpanded = expandedServiceKey === serviceKey;
                    const serviceContentId = `service-compatibility-${serviceKey}`;
                    const display = service.finalDecision.display;

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
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                  Access
                                </span>
                                <StatusBadge
                                  tone={getServiceAvailabilityTone(
                                    service.finalAvailability,
                                  )}
                                  variant="quiet"
                                >
                                  {service.finalAvailability}
                                </StatusBadge>
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                  IP Reputation
                                </span>
                                <StatusBadge
                                  tone={display.serviceCompatibilityBadge.tone}
                                  variant="quiet"
                                >
                                  {display.serviceCompatibilityBadge.label}
                                </StatusBadge>
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                  Regional Availability
                                </span>
                                <StatusBadge
                                  tone={display.regionAvailabilityBadge.tone}
                                  variant="quiet"
                                >
                                  {display.regionAvailabilityBadge.label}
                                </StatusBadge>
                              </span>
                            </span>
                          </span>
                          <span
                            id={serviceContentId}
                            hidden={!isExpanded}
                            className="mt-2 block text-xs leading-5 text-neutral-500"
                          >
                            {display.summary}
                          </span>
                          <span
                            hidden={!isExpanded}
                            className="mt-2 block text-[11px] leading-5 text-neutral-500"
                          >
                            {display.serviceCompatibility.topSignalsLabel}{" "}
                            {display.serviceCompatibility.topSignalsSummary}
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
          hidden={result.serviceCompatibility.length > 0}
          className="px-4 py-3 text-sm text-neutral-500"
        >
          {emptyMessage}
        </p>
        <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-500">
          {footnote}
        </p>
      </div>
    </DisclosureSection>
  );
}

function ScoreExplanationSection({ result }: { result: AnalysisResult }) {
  const display = result.finalDecision?.display;
  const explanation = display?.scoreExplanation;
  const items = explanation?.items ?? [];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          {explanation?.title ?? "Score Explanation"}
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          {explanation?.intro ??
            "Score details will appear here after analysis."}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900"
            />
            <span className="text-neutral-600">{item.label}</span>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900"
            />
            <span className="text-neutral-600">
              {explanation?.emptyMessage ??
                "Run an analysis to see decision signals."}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function RiskSignalsSection({ result }: { result: AnalysisResult }) {
  const [isRiskSignalsVisible, setIsRiskSignalsVisible] = useState(true);
  const display = result.finalDecision?.display;
  const signals = display?.signals.items ?? [];
  const signalDisplay = display?.signals;

  return (
    <DisclosureSection
      title={signalDisplay?.sectionTitle ?? "Risk Signals"}
      isExpanded={isRiskSignalsVisible}
      onToggle={() =>
        setIsRiskSignalsVisible((currentVisibility) => !currentVisibility)
      }
      contentId="risk-signals-content"
    >
      <div className="surface-card mt-3 rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm leading-6 text-neutral-500">
            {signalDisplay?.summary ??
              "Weighted signals from the canonical final decision."}
          </p>
          <StatusBadge
            tone={signalDisplay?.summaryBadge.tone ?? "good"}
            className="mt-1 sm:mt-0"
          >
            {signalDisplay?.summaryBadge.label ?? "Clear"}
          </StatusBadge>
        </div>

        <ul
          hidden={signals.length === 0}
          className="mt-4 divide-y divide-neutral-100"
        >
          {signals.map((signal) => (
            <li
              key={signal.key}
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
              <StatusBadge tone={signal.badge.tone} variant="quiet">
                {signal.badge.label}
              </StatusBadge>
            </li>
          ))}
        </ul>
        <p
          hidden={signals.length > 0}
          className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          {signalDisplay?.emptyMessage ??
            "No final decision signals are available yet."}
        </p>
      </div>
    </DisclosureSection>
  );
}

export function IpAnalyzer({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-6 flex w-full flex-col gap-4 text-left">
      <MainRiskReport result={result} />
      <IpHistorySection result={result} />
      <NetworkIntegritySection result={result} />
      <RealConnectivitySection result={result} />
      <ServiceCompatibilitySection result={result} />
      <ScoreExplanationSection result={result} />
      <RiskSignalsSection result={result} />

      <p className="text-xs leading-5 text-neutral-400">
        IP Health provides reputation-based guidance only. Services may also
        consider account history, device signals, payment method, browser
        fingerprint, and behavior.
      </p>
    </div>
  );
}
