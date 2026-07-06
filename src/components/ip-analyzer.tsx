"use client";

import { useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/lib/status-colors";
import type { AnalysisResult } from "@/lib/analysis";

type OverallVerdict = NonNullable<
  AnalysisResult["finalDecision"]
>["decision"]["overallVerdict"];

type UsageRecommendation = {
  title: string;
  items: string[];
  tone: StatusTone;
};

const verdictContent: Record<
  OverallVerdict,
  { title: string; description: string; tone: StatusTone }
> = {
  Healthy: {
    title: "This IP looks trustworthy",
    description: "No major risk signals were detected.",
    tone: "good",
  },
  "Use with Caution": {
    title: "This IP has some risk signals",
    description: "Some services may require additional verification.",
    tone: "caution",
  },
  Risky: {
    title: "This IP may be high risk",
    description: "This IP may trigger restrictions on sensitive services.",
    tone: "risk",
  },
};

const usageRecommendations: Record<OverallVerdict, UsageRecommendation[]> = {
  Healthy: [
    {
      title: "Recommended for",
      tone: "good",
      items: ["Browsing", "Streaming", "Daily accounts"],
    },
    {
      title: "Use caution for",
      tone: "caution",
      items: ["New account registration", "Important verification"],
    },
  ],
  "Use with Caution": [
    {
      title: "Recommended for",
      tone: "good",
      items: ["Browsing", "Streaming", "Low-risk services"],
    },
    {
      title: "Use caution for",
      tone: "caution",
      items: ["New account registration", "Important verification"],
    },
    {
      title: "Avoid",
      tone: "risk",
      items: ["High-risk account operations"],
    },
  ],
  Risky: [
    {
      title: "Recommended for",
      tone: "caution",
      items: ["Basic browsing only"],
    },
    {
      title: "Use caution for",
      tone: "risk",
      items: ["Streaming", "Existing account login"],
    },
    {
      title: "Avoid",
      tone: "risk",
      items: [
        "New account registration",
        "Payment verification",
        "High-risk account operations",
      ],
    },
  ],
};

function getVerdict(result: AnalysisResult): OverallVerdict | null {
  return result.finalDecision?.decision.overallVerdict ?? null;
}

function getSupportingStatusLabel(label: string) {
  if (label === "Healthy") {
    return "Evidence clear";
  }

  if (label === "Use with Caution") {
    return "Review evidence";
  }

  if (label === "Risky") {
    return "Risk evidence";
  }

  return label;
}

function getRiskSignalExplanation(signal: {
  label: string;
  detail: string;
  tone: StatusTone;
}) {
  const normalizedLabel = signal.label.toLowerCase();
  const normalizedDetail = signal.detail.toLowerCase();
  const text = `${normalizedLabel} ${normalizedDetail}`;

  if (
    text.includes("hosting") ||
    text.includes("infrastructure") ||
    text.includes("asn")
  ) {
    return {
      title: "Datacenter IP detected",
      whyItMatters:
        "Some platforms reduce trust for cloud hosting IP ranges.",
    };
  }

  if (
    text.includes("vpn") ||
    text.includes("proxy") ||
    text.includes("tor") ||
    text.includes("relay") ||
    text.includes("warp")
  ) {
    return {
      title: "VPN or proxy signal detected",
      whyItMatters:
        "Some services may request additional verification.",
    };
  }

  if (text.includes("fraud") || text.includes("abuse")) {
    return {
      title: "High fraud risk signal",
      whyItMatters:
        "External risk intelligence detected suspicious indicators.",
    };
  }

  if (text.includes("connectivity") || text.includes("region")) {
    return {
      title: "Connectivity signal detected",
      whyItMatters:
        "Some services may be harder to access from this network path.",
    };
  }

  return {
    title: signal.label,
    whyItMatters: signal.detail,
  };
}

function getRiskSignalCards(result: AnalysisResult) {
  const cards = result.riskSignals.map((signal) => ({
    ...signal,
    ...getRiskSignalExplanation(signal),
  }));
  const existingTitles = new Set(cards.map((card) => card.title));

  function addCard(card: {
    label: string;
    detail: string;
    tone: StatusTone;
    title: string;
    whyItMatters: string;
  }) {
    if (existingTitles.has(card.title)) {
      return;
    }

    existingTitles.add(card.title);
    cards.push(card);
  }

  result.finalDecision?.decision.signals
    .filter((signal) => signal.direction === "raises_risk")
    .forEach((signal) => {
      if (
        signal.signalName === "ipqs_fraud_score" ||
        signal.signalName === "trust_score"
      ) {
        addCard({
          label: "Reputation",
          detail: "Reputation scoring raised a risk signal.",
          tone: "risk",
          title: "High fraud risk signal",
          whyItMatters:
            "External risk intelligence detected suspicious indicators.",
        });
        return;
      }

      if (
        signal.signalName === "asn_type" ||
        signal.signalName === "isp_reputation"
      ) {
        addCard({
          label: "Hosting",
          detail: "Network ownership raised a hosting risk signal.",
          tone: "infrastructure",
          title: "Datacenter IP detected",
          whyItMatters:
            "Some platforms reduce trust for cloud hosting IP ranges.",
        });
        return;
      }

      if (signal.signalName === "proxy_cloudflare") {
        addCard({
          label: "VPN / Proxy",
          detail: "An anonymized or relayed network path raised risk.",
          tone: "caution",
          title: "VPN or proxy signal detected",
          whyItMatters: "Some services may request additional verification.",
        });
        return;
      }

      if (
        signal.signalName === "region_availability" ||
        signal.signalName === "hard_region_restriction" ||
        signal.signalName === "direct_cn_route" ||
        signal.signalName === "country_restriction" ||
        signal.signalName === "rule_hint"
      ) {
        addCard({
          label: "Connectivity",
          detail: "Network path or regional access raised a risk signal.",
          tone: "caution",
          title: "Connectivity signal detected",
          whyItMatters:
            "Some services may be harder to access from this network path.",
        });
      }
    });

  return cards;
}

function getPositiveScoreSignals(result: AnalysisResult) {
  const finalDecisionSignals = result.finalDecision?.decision.signals ?? [];
  const positiveSignals = new Set<string>();

  if (!result.finalDecision) {
    return [];
  }

  if (
    result.finalDecision.decision.trustScore >= 80 ||
    finalDecisionSignals.some(
      (signal) =>
        signal.signalName === "trust_score" &&
        signal.direction === "supports_availability",
    )
  ) {
    positiveSignals.add("Clean IP reputation");
  }

  if (
    finalDecisionSignals.some(
      (signal) =>
        (signal.signalName === "region_availability" ||
          signal.signalName === "country_restriction" ||
          signal.signalName === "rule_hint") &&
        signal.direction === "supports_availability",
    )
  ) {
    positiveSignals.add("Normal network path");
  }

  if (
    finalDecisionSignals.some(
      (signal) =>
        signal.signalName === "history_consistency" &&
        signal.direction === "supports_availability",
    )
  ) {
    positiveSignals.add("Stable recent checks");
  }

  if (positiveSignals.size === 0 && result.riskSignals.length === 0) {
    positiveSignals.add("No major risk signals detected");
  }

  return Array.from(positiveSignals);
}

function getNegativeScoreSignals(result: AnalysisResult) {
  const finalDecisionSignals = result.finalDecision?.decision.signals ?? [];
  const negativeSignals = new Set<string>();
  const riskSignalText = result.riskSignals
    .map((signal) => `${signal.label} ${signal.detail}`)
    .join(" ")
    .toLowerCase();

  if (
    riskSignalText.includes("hosting") ||
    riskSignalText.includes("infrastructure") ||
    riskSignalText.includes("asn")
  ) {
    negativeSignals.add("Datacenter IP detected");
  }

  if (
    riskSignalText.includes("proxy") ||
    riskSignalText.includes("vpn") ||
    riskSignalText.includes("tor") ||
    riskSignalText.includes("relay") ||
    riskSignalText.includes("warp")
  ) {
    negativeSignals.add("VPN or proxy signal detected");
  }

  if (
    riskSignalText.includes("fraud") ||
    riskSignalText.includes("abuse") ||
    finalDecisionSignals.some(
      (signal) =>
        signal.signalName === "ipqs_fraud_score" &&
        signal.direction === "raises_risk",
    )
  ) {
    negativeSignals.add("High fraud risk signal");
  }

  if (
    finalDecisionSignals.some(
      (signal) =>
        (signal.signalName === "region_availability" ||
          signal.signalName === "hard_region_restriction" ||
          signal.signalName === "direct_cn_route" ||
          signal.signalName === "country_restriction") &&
        signal.direction === "raises_risk",
    )
  ) {
    negativeSignals.add("Connectivity or regional restriction detected");
  }

  if (
    finalDecisionSignals.some(
      (signal) =>
        signal.signalName === "trust_score" &&
        signal.direction === "raises_risk",
    )
  ) {
    negativeSignals.add("Lower trust score");
  }

  return Array.from(negativeSignals);
}

export function DisclosureSection({
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

function IpHealthScoreCard({ result }: { result: AnalysisResult }) {
  const display = result.finalDecision?.display;
  const verdict = getVerdict(result);
  const verdictDisplay = verdict ? verdictContent[verdict] : null;
  const trustScoreDisplay = display?.trustScoreValue ?? "--";
  const trustScoreSuffix = display?.trustScoreSuffix ?? "/100";
  const summary =
    display?.summary ??
    "Enter an IP address or analyze your current IP to see risk, trust, and compatibility.";

  return (
    <section className="surface-card-primary rounded-[28px] border bg-white p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Trust Score
          </p>
          <p className="mt-3 flex items-end gap-1 text-7xl font-semibold leading-none text-neutral-950">
            {trustScoreDisplay}
            <span className="pb-2 text-xl font-semibold text-neutral-400">
              {trustScoreSuffix}
            </span>
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-neutral-950">
            {verdict ?? "Ready to analyze"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
            {verdictDisplay?.description ?? summary}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4 sm:w-64">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Checked IP
          </p>
          <p className="mt-2 break-all text-lg font-semibold leading-7 text-neutral-950">
            {result.ip.address || "Not analyzed"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {display && verdictDisplay ? (
              <StatusBadge
                tone={verdictDisplay.tone}
                className="px-3 py-1.5 text-sm"
              >
                Analyzed
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                Pending
              </StatusBadge>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium leading-6 text-neutral-800">
        {value}
      </dd>
    </div>
  );
}

function IpReputationCard({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const reputation = result.endUserReport.reputation;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            IP Reputation
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            A plain-language reputation view from existing fraud, abuse, and
            trust signals.
          </p>
        </div>
        <StatusBadge tone={reputation.tone} className="mt-1 sm:mt-0">
          {reputation.status}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label="Fraud Risk" value={reputation.fraudRisk} />
        <ReportField label="Abuse Signals" value={reputation.abuseSignals} />
        <ReportField
          label="Reputation Confidence"
          value={reputation.confidence}
        />
      </dl>
    </section>
  );
}

function IpIdentityCard({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const identity = result.endUserReport.identity;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            IP Identity
          </p>
          <p className="mt-3 text-2xl font-semibold leading-tight text-neutral-950">
            {identity.ipType}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {identity.detail}
          </p>
        </div>
        <StatusBadge tone={identity.tone} variant="quiet">
          IP Type
        </StatusBadge>
      </div>
    </section>
  );
}

function IpLocationCard({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const location = result.endUserReport.location;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <p className="text-sm font-semibold text-neutral-950">IP Location</p>
      <p className="mt-1 text-sm leading-6 text-neutral-500">
        This is the exit IP location, not a physical user location.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReportField label="Country" value={location.country} />
        <ReportField label="Region" value={location.region} />
        <ReportField label="City" value={location.city} />
        <ReportField label="ISP" value={location.isp} />
        <ReportField label="Timezone" value={location.timezone} />
      </dl>
    </section>
  );
}

function NetworkSharingCard({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const sharingRisk = result.endUserReport.sharingRisk;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            Network Sharing Risk
          </p>
          <p className="mt-3 text-2xl font-semibold leading-tight text-neutral-950">
            {sharingRisk.level}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {sharingRisk.explanation}
          </p>
        </div>
        <StatusBadge tone={sharingRisk.tone} className="mt-1 sm:mt-0">
          Indicator
        </StatusBadge>
      </div>
      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-5 text-neutral-400">
        This is an infrastructure risk indicator only. It does not estimate an
        exact number of users.
      </p>
    </section>
  );
}

function RecommendedUsageSection({ result }: { result: AnalysisResult }) {
  const verdict = getVerdict(result);

  if (!verdict) {
    return null;
  }

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          Recommendation
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          What to use this IP for, based on the final verdict.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {usageRecommendations[verdict].map((group) => (
          <div
            key={group.title}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4"
          >
            <p className="text-sm font-semibold text-neutral-950">
              {group.title}
            </p>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-6 text-neutral-600"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-2.5 size-1.5 shrink-0 rounded-full",
                      group.tone === "good"
                        ? "bg-emerald-700"
                        : group.tone === "caution"
                          ? "bg-amber-700"
                          : "bg-rose-700",
                    ].join(" ")}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
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

function shouldShowServiceAccessBadge(
  finalAvailability: AnalysisResult["serviceCompatibility"][number]["services"][number]["finalAvailability"],
) {
  return finalAvailability !== "Not Verified";
}

function shouldShowRegionalAvailabilityBadge(
  badge: AnalysisResult["serviceCompatibility"][number]["services"][number]["finalDecision"]["display"]["regionAvailabilityBadge"],
) {
  return !badge.label.startsWith("Not Verified");
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
                {getSupportingStatusLabel(
                  reportDisplay.serviceCompatibilityBadge.label,
                )}
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
                {getSupportingStatusLabel(
                  reportDisplay.regionAvailabilityBadge.label,
                )}
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
                    const showAccessBadge = shouldShowServiceAccessBadge(
                      service.finalAvailability,
                    );
                    const showRegionalAvailabilityBadge =
                      shouldShowRegionalAvailabilityBadge(
                        display.regionAvailabilityBadge,
                      );
                    const showAccessProbeNote =
                      !showAccessBadge && !showRegionalAvailabilityBadge;

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
                              {showAccessBadge ? (
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
                              ) : null}
                              <span className="inline-flex items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                  IP Reputation
                                </span>
                                <StatusBadge
                                  tone={display.serviceCompatibilityBadge.tone}
                                  variant="quiet"
                                >
                                  {getSupportingStatusLabel(
                                    display.serviceCompatibilityBadge.label,
                                  )}
                                </StatusBadge>
                              </span>
                              {showRegionalAvailabilityBadge ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-normal text-neutral-400">
                                    Regional Availability
                                  </span>
                                  <StatusBadge
                                    tone={display.regionAvailabilityBadge.tone}
                                    variant="quiet"
                                  >
                                    {getSupportingStatusLabel(
                                      display.regionAvailabilityBadge.label,
                                    )}
                                  </StatusBadge>
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span
                            hidden={!isExpanded || !showAccessProbeNote}
                            className="mt-2 block text-[11px] leading-5 text-neutral-400"
                          >
                            Service access was not strongly verified by browser
                            probe.
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
  const positiveSignals = getPositiveScoreSignals(result);
  const negativeSignals = getNegativeScoreSignals(result);
  const hasAnalysis = Boolean(result.finalDecision);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          Why this score
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          {hasAnalysis
            ? "A plain-language view of what helped or hurt this IP."
            : "Run an analysis to see score signals."}
        </p>
      </div>
      {hasAnalysis ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              Positive signals
            </p>
            <ul className="mt-3 space-y-2">
              {positiveSignals.map((signal) => (
                <li key={signal} className="flex gap-2 text-sm leading-6">
                  <span
                    aria-hidden="true"
                    className="font-semibold text-emerald-700"
                  >
                    +
                  </span>
                  <span className="text-emerald-900">{signal}</span>
                </li>
              ))}
              {positiveSignals.length === 0 ? (
                <li className="text-sm leading-6 text-emerald-900">
                  No strong positive signals found.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
            <p className="text-sm font-semibold text-red-900">
              Negative signals
            </p>
            <ul className="mt-3 space-y-2">
              {negativeSignals.map((signal) => (
                <li key={signal} className="flex gap-2 text-sm leading-6">
                  <span
                    aria-hidden="true"
                    className="font-semibold text-red-700"
                  >
                    -
                  </span>
                  <span className="text-red-900">{signal}</span>
                </li>
              ))}
              {negativeSignals.length === 0 ? (
                <li className="text-sm leading-6 text-red-900">
                  No major negative signals detected.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RiskSignalsSection({ result }: { result: AnalysisResult }) {
  const [isRiskSignalsVisible, setIsRiskSignalsVisible] = useState(false);
  const signalDisplay = result.finalDecision?.display.signals;
  const signals = getRiskSignalCards(result);

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
            Plain-language risk signals found in this IP profile.
          </p>
          <StatusBadge
            tone={
              signals.some((signal) => signal.tone === "risk")
                ? "risk"
                : signals.length > 0
                  ? "caution"
                  : "good"
            }
            className="mt-1 sm:mt-0"
          >
            {signals.length > 0 ? `${signals.length} signals` : "Clear"}
          </StatusBadge>
        </div>

        <ul
          hidden={signals.length === 0}
          className="mt-4 divide-y divide-neutral-100"
        >
          {signals.map((signal) => (
            <li
              key={`${signal.label}:${signal.detail}`}
              className="py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-neutral-950">
                  {signal.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-500">
                  Why it matters: {signal.whyItMatters}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p
          hidden={signals.length > 0}
          className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          No major risk signals detected.
        </p>
      </div>
    </DisclosureSection>
  );
}

function TechnicalIpFactsSection({ result }: { result: AnalysisResult }) {
  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <p className="text-sm font-semibold text-neutral-950">
        Network Facts
      </p>
      <p className="mt-1 text-sm leading-6 text-neutral-500">
        Provider fields used as context for the user-facing report.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label="IP Address" value={result.ip.address} />
        {result.ip.facts.map((fact) => (
          <ReportField
            key={fact.label}
            label={fact.label}
            value={fact.value}
          />
        ))}
      </dl>
    </section>
  );
}

function TechnicalIpqsSection({ result }: { result: AnalysisResult }) {
  const ipqs = result.finalDecision?.decision.externalSignals.ipqs;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">
          IPQualityScore Signals
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          Raw reputation fields kept for technical review.
        </p>
      </div>

      {ipqs?.status === "available" ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReportField
            label="Fraud Score"
            value={`${ipqs.fraud_score}/100`}
          />
          <ReportField label="Country" value={ipqs.country || "Not identified"} />
          <ReportField label="VPN" value={ipqs.vpn ? "Yes" : "No"} />
          <ReportField label="Proxy" value={ipqs.proxy ? "Yes" : "No"} />
          <ReportField label="Tor" value={ipqs.tor ? "Yes" : "No"} />
          <ReportField
            label="Bot Status"
            value={ipqs.bot_status ? "Yes" : "No"}
          />
        </dl>
      ) : (
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          {ipqs?.error ?? "IPQualityScore data is unavailable."}
        </p>
      )}
    </section>
  );
}

function TechnicalDetailsSection({ result }: { result: AnalysisResult }) {
  const [isTechnicalDetailsVisible, setIsTechnicalDetailsVisible] =
    useState(false);

  if (!result.finalDecision) {
    return null;
  }

  return (
    <DisclosureSection
      title="Technical Details"
      summary="ASN, Cloudflare, connectivity, IPQS, and risk signals"
      isExpanded={isTechnicalDetailsVisible}
      onToggle={() =>
        setIsTechnicalDetailsVisible(
          (currentVisibility) => !currentVisibility,
        )
      }
      contentId="technical-details-content"
    >
      <div className="mt-3 flex flex-col gap-4">
        <IpReputationCard result={result} />
        <TechnicalIpFactsSection result={result} />
        <TechnicalIpqsSection result={result} />
        <NetworkSharingCard result={result} />
        <NetworkIntegritySection result={result} />
        <ServiceCompatibilitySection result={result} />
        <RiskSignalsSection result={result} />
      </div>
    </DisclosureSection>
  );
}

export function IpAnalyzer({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-6 flex w-full flex-col gap-4 text-left">
      <IpHealthScoreCard result={result} />
      <ScoreExplanationSection result={result} />
      <div className="grid gap-4 lg:grid-cols-2">
        <IpIdentityCard result={result} />
        <IpLocationCard result={result} />
      </div>
      <RecommendedUsageSection result={result} />
      <TechnicalDetailsSection result={result} />

      <p className="text-xs leading-5 text-neutral-400">
        IP Health provides reputation-based guidance only. Services may also
        consider account history, device signals, payment method, browser
        fingerprint, and behavior.
      </p>
    </div>
  );
}
