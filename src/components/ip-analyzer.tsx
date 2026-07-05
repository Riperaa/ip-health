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

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

function formatSignalName(signalName: string) {
  return signalName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSignalDirection(
  direction: NonNullable<
    AnalysisResult["finalDecision"]
  >["decision"]["signals"][number]["direction"],
) {
  if (direction === "supports_availability") {
    return "supports availability";
  }

  if (direction === "raises_risk") {
    return "raises risk";
  }

  return "neutral";
}

function formatDecisionSignal(
  signal: NonNullable<AnalysisResult["finalDecision"]>["decision"]["signals"][number],
) {
  return `${formatSignalName(signal.signalName)} ${formatSignalDirection(signal.direction)} (${formatProbability(signal.impact)} impact)`;
}

function getCategoryDecisionSummary(
  services: AnalysisResult["serviceCompatibility"][number]["services"],
) {
  return services
    .reduce<Record<string, number>>(
      (summary, service) => ({
        ...summary,
        [service.finalDecision.decision.serviceCompatibility.status]:
          summary[service.finalDecision.decision.serviceCompatibility.status] +
          1,
      }),
      {
        Good: 0,
        "Use with Caution": 0,
        "High Risk": 0,
      },
    );
}

function formatCategoryDecisionSummary(
  services: AnalysisResult["serviceCompatibility"][number]["services"],
) {
  const summary = getCategoryDecisionSummary(services);

  return `${summary.Good} Good - ${summary["Use with Caution"]} Caution - ${summary["High Risk"]} High Risk`;
}

function MainRiskReport({ result }: { result: AnalysisResult }) {
  const finalDecision = result.finalDecision;
  const trustScoreDisplay = finalDecision
    ? finalDecision.display.trustScoreLabel
    : "--";
  const summary = finalDecision
    ? finalDecision.display.summary
    : "Run an analysis to populate this report.";

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
              /100
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            {finalDecision ? (
              <>
                <StatusBadge
                  tone={finalDecision.display.riskTone}
                  className="px-3 py-1.5 text-sm"
                >
                  {finalDecision.display.riskLabel}
                </StatusBadge>
                <StatusBadge
                  tone={finalDecision.display.serviceCompatibilityTone}
                  variant="quiet"
                >
                  {finalDecision.display.serviceCompatibilityLabel}
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
  const reportDecision = result.finalDecision;

  return (
    <DisclosureSection
      title="Service Compatibility"
      isExpanded={isServiceCompatibilityVisible}
      onToggle={() =>
        setIsServiceCompatibilityVisible(
          (currentVisibility) => !currentVisibility,
        )
      }
      contentId="service-compatibility-content"
    >
      <div className="surface-card mt-3 overflow-hidden rounded-2xl border bg-white">
        {hasServiceCompatibility && reportDecision ? (
          <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
              Regional Availability
            </span>
            <StatusBadge
              tone={reportDecision.display.regionAvailabilityTone}
              variant="quiet"
            >
              {reportDecision.display.regionAvailabilityLabel}
            </StatusBadge>
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
                    {formatCategoryDecisionSummary(category.services)}
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
                    const finalDecision = service.finalDecision;

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
                              <StatusBadge
                                tone={
                                  finalDecision.display
                                    .serviceCompatibilityTone
                                }
                                variant="quiet"
                              >
                                {
                                  finalDecision.display
                                    .serviceCompatibilityLabel
                                }
                              </StatusBadge>
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                  Regional Availability
                                </span>
                                <StatusBadge
                                  tone={
                                    finalDecision.display
                                      .regionAvailabilityTone
                                  }
                                  variant="quiet"
                                >
                                  {
                                    finalDecision.display
                                      .regionAvailabilityLabel
                                  }
                                </StatusBadge>
                              </span>
                            </span>
                          </span>
                          <span
                            id={serviceContentId}
                            hidden={!isExpanded}
                            className="mt-2 block text-xs leading-5 text-neutral-500"
                          >
                            {finalDecision.display.summary}
                          </span>
                          <span
                            hidden={!isExpanded}
                            className="mt-2 block text-[11px] leading-5 text-neutral-500"
                          >
                            Top signals:{" "}
                            {finalDecision.display.topSignals.join(" ")}
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
          No service compatibility data available.
        </p>
        <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-500">
          This reflects both IP reputation and regional accessibility. Services
          may also consider account history, device reputation, browser
          fingerprint, and behavior.
        </p>
      </div>
    </DisclosureSection>
  );
}

function ScoreExplanationSection({ result }: { result: AnalysisResult }) {
  const finalDecision = result.finalDecision;
  const signals = finalDecision?.decision.signals.slice(0, 3) ?? [];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          Score Explanation
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          {finalDecision
            ? `Why this final decision received a ${finalDecision.decision.trustScore}/100 trust score.`
            : "Score details will appear here after analysis."}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {signals.map((signal) => (
          <li key={signal.signalName} className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900"
            />
            <span className="text-neutral-600">
              {formatDecisionSignal(signal)}
            </span>
          </li>
        ))}
        {signals.length === 0 ? (
          <li className="flex gap-3 text-sm leading-6">
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900"
            />
            <span className="text-neutral-600">
              Run an analysis to see decision signals.
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function RiskSignalsSection({ result }: { result: AnalysisResult }) {
  const [isRiskSignalsVisible, setIsRiskSignalsVisible] = useState(true);
  const signals = result.finalDecision?.decision.signals ?? [];

  return (
    <DisclosureSection
      title="Risk Signals"
      isExpanded={isRiskSignalsVisible}
      onToggle={() =>
        setIsRiskSignalsVisible((currentVisibility) => !currentVisibility)
      }
      contentId="risk-signals-content"
    >
      <div className="surface-card mt-3 rounded-2xl border bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm leading-6 text-neutral-500">
            Weighted signals from the canonical final decision.
          </p>
          {signals.length === 0 ? (
            <StatusBadge tone="good" className="mt-1 sm:mt-0">
              Clear
            </StatusBadge>
          ) : (
            <StatusBadge tone="caution" className="mt-1 sm:mt-0">
              {signals.length} signals
            </StatusBadge>
          )}
        </div>

        <ul
          hidden={signals.length === 0}
          className="mt-4 divide-y divide-neutral-100"
        >
          {signals.map((signal) => (
            <li
              key={signal.signalName}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div>
                <p className="text-sm font-medium text-neutral-950">
                  {formatSignalName(signal.signalName)}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  {`Weight ${formatProbability(signal.weight)}, contribution ${formatProbability(Math.abs(signal.contribution))}.`}
                </p>
              </div>
              <StatusBadge
                tone={
                  signal.direction === "raises_risk"
                    ? "caution"
                    : signal.direction === "supports_availability"
                      ? "good"
                      : "neutral"
                }
                variant="quiet"
              >
                {formatSignalDirection(signal.direction)}
              </StatusBadge>
            </li>
          ))}
        </ul>
        <p
          hidden={signals.length > 0}
          className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          No final decision signals are available yet.
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
