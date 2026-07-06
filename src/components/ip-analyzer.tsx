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
  { label: string; description: string; tone: StatusTone }
> = {
  Healthy: {
    label: "High quality IP",
    description: "Strong overall IP quality signals.",
    tone: "good",
  },
  "Use with Caution": {
    label: "Review dimensions",
    description: "Some signals may require verification.",
    tone: "caution",
  },
  Risky: {
    label: "High risk signals",
    description: "Sensitive services may restrict this IP.",
    tone: "risk",
  },
};

const usageRecommendations: Record<OverallVerdict, UsageRecommendation[]> = {
  Healthy: [
    {
      title: "Suitable Usage",
      tone: "good",
      items: ["Browsing", "Streaming", "Daily accounts"],
    },
    {
      title: "May Need Verification",
      tone: "caution",
      items: ["New account registration", "Important verification"],
    },
  ],
  "Use with Caution": [
    {
      title: "Suitable Usage",
      tone: "good",
      items: ["Browsing", "Streaming", "Low-risk services"],
    },
    {
      title: "May Need Verification",
      tone: "caution",
      items: ["New account registration", "Important verification"],
    },
    {
      title: "Avoid",
      tone: "risk",
      items: ["Sensitive account changes"],
    },
  ],
  Risky: [
    {
      title: "Suitable Usage",
      tone: "caution",
      items: ["Basic browsing only"],
    },
    {
      title: "May Fail Verification",
      tone: "risk",
      items: ["Streaming", "Existing account login"],
    },
    {
      title: "Avoid",
      tone: "risk",
      items: [
        "New account registration",
        "Payment verification",
        "Sensitive account changes",
      ],
    },
  ],
};

function getVerdict(result: AnalysisResult): OverallVerdict | null {
  return result.finalDecision?.decision.overallVerdict ?? null;
}

function normalizePresentationText(value: string) {
  return value
    .replace(/\bfraud score\b/gi, "risk score")
    .replace(/\bfraud risk\b/gi, "reputation risk")
    .replace(/\bfraud\b/gi, "reputation")
    .replace(/\bthreat\b/gi, "signal")
    .replace(/\bUse with Caution\b/g, "Review evidence")
    .replace(/\bHigh Risk\b/g, "Review evidence")
    .replace(/\bRisky\b/g, "Risk evidence")
    .replace(/\bHealthy\b/g, "Evidence clear");
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
      whyItMatters: "Some platforms reduce trust for cloud hosting IP ranges.",
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
      whyItMatters: "Some services may request additional verification.",
    };
  }

  if (text.includes("fraud") || text.includes("abuse")) {
    return {
      title: "Reputation risk signal",
      whyItMatters: "Provider reputation data reported elevated risk.",
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
          detail: "Reputation scoring raised a signal.",
          tone: "risk",
          title: "Reputation risk signal",
          whyItMatters: "Provider reputation data reported elevated risk.",
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
    (result.qualityReport.dimensions.reputation.score ?? 0) >= 85 ||
    finalDecisionSignals.some(
      (signal) =>
        signal.signalName === "trust_score" &&
        signal.direction === "supports_availability",
    )
  ) {
    positiveSignals.add("Clean IP reputation");
  }

  if (
    (result.qualityReport.dimensions.networkQuality.score ?? 0) >= 85 ||
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

  if ((result.qualityReport.dimensions.compatibility.score ?? 0) >= 85) {
    positiveSignals.add("Strong compatibility");
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
    negativeSignals.add("Reputation risk signal");
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
    negativeSignals.add("Connectivity signal detected");
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
  const verdict = getVerdict(result);
  const verdictDisplay = verdict ? verdictContent[verdict] : null;
  const qualityReport = result.qualityReport;
  const scoreDisplay = qualityReport.displayValue;
  const scoreSuffix = "/100";
  const summary = qualityReport.summary;
  const dimensions = [
    qualityReport.dimensions.reputation,
    qualityReport.dimensions.networkQuality,
    qualityReport.dimensions.compatibility,
  ];

  return (
    <section className="surface-card-primary rounded-[28px] border bg-white p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            IP Health Score
          </p>
          <p className="mt-3 flex items-end gap-1 text-7xl font-semibold leading-none text-neutral-950">
            {scoreDisplay}
            <span className="pb-2 text-xl font-semibold text-neutral-400">
              {scoreSuffix}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {result.trustScore.hasAnalysis ? (
              <StatusBadge
                tone={result.trustScore.riskTone}
                className="px-3 py-1.5 text-sm"
              >
                {result.trustScore.riskLabel}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                Ready to analyze
              </StatusBadge>
            )}
            <span className="text-sm leading-6 text-neutral-500">
              {summary}
            </span>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4 sm:w-64">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            Checked IP
          </p>
          <p className="mt-2 break-all text-lg font-semibold leading-7 text-neutral-950">
            {result.ip.address || "Not analyzed"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.trustScore.hasAnalysis && verdictDisplay ? (
              <StatusBadge
                tone={verdictDisplay.tone}
                className="px-3 py-1.5 text-sm"
              >
                {verdictDisplay.label}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                Pending
              </StatusBadge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {dimensions.map((dimension) => (
          <div
            key={dimension.key}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                  <span aria-hidden="true">
                    {dimension.key === "reputation"
                      ? "🛡"
                      : dimension.key === "networkQuality"
                        ? "🌐"
                        : "✅"}
                  </span>
                  <span>{dimension.label}</span>
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {dimension.summary}
                </p>
              </div>
              <StatusBadge tone={dimension.tone} variant="quiet">
                {dimension.displayValue}/100
              </StatusBadge>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">
              {dimension.detail}
            </p>
          </div>
        ))}
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

type EvidenceSignal = {
  label: string;
  tone: StatusTone;
};

function addEvidenceSignal(signals: EvidenceSignal[], signal: EvidenceSignal) {
  if (signals.some((existingSignal) => existingSignal.label === signal.label)) {
    return;
  }

  signals.push(signal);
}

function getEvidenceTone(label: string): StatusTone {
  const normalizedLabel = label.toLowerCase();

  if (
    normalizedLabel.includes("datacenter") ||
    normalizedLabel.includes("infrastructure") ||
    normalizedLabel.includes("asn")
  ) {
    return "infrastructure";
  }

  if (
    normalizedLabel.includes("reputation") ||
    normalizedLabel.includes("abuse")
  ) {
    return "risk";
  }

  if (
    normalizedLabel.includes("vpn") ||
    normalizedLabel.includes("proxy") ||
    normalizedLabel.includes("connectivity")
  ) {
    return "caution";
  }

  return "neutral";
}

function getReputationEvidence(result: AnalysisResult) {
  const cleanSignals: EvidenceSignal[] = [];
  const reviewSignals: EvidenceSignal[] = [];
  const reputation = result.endUserReport.reputation;

  getPositiveScoreSignals(result).forEach((signal) => {
    addEvidenceSignal(cleanSignals, { label: signal, tone: "good" });
  });

  getRiskSignalCards(result).forEach((signal) => {
    addEvidenceSignal(reviewSignals, {
      label: signal.title,
      tone: signal.tone,
    });
  });

  getNegativeScoreSignals(result).forEach((signal) => {
    addEvidenceSignal(reviewSignals, {
      label: signal,
      tone: getEvidenceTone(signal),
    });
  });

  if (reputation.abuseSignals === "None detected") {
    addEvidenceSignal(cleanSignals, {
      label: "Clean abuse history",
      tone: "good",
    });
  } else if (
    reputation.abuseSignals !== "Pending" &&
    reputation.abuseSignals !== "Not reported"
  ) {
    addEvidenceSignal(reviewSignals, {
      label: `Abuse history: ${reputation.abuseSignals}`,
      tone: "risk",
    });
  }

  if (reputation.fraudRisk.startsWith("Low")) {
    addEvidenceSignal(cleanSignals, {
      label: `Low IPQS risk score ${reputation.fraudRisk.replace("Low ", "")}`,
      tone: "good",
    });
  } else if (
    reputation.fraudRisk !== "Pending" &&
    reputation.fraudRisk !== "Unavailable" &&
    reputation.fraudRisk !== "Not reported"
  ) {
    addEvidenceSignal(reviewSignals, {
      label: `IPQS risk score: ${reputation.fraudRisk}`,
      tone: reputation.fraudRisk.startsWith("High") ? "risk" : "caution",
    });
  }

  if (cleanSignals.length === 0 && reviewSignals.length === 0) {
    addEvidenceSignal(cleanSignals, {
      label: "No major review signals detected",
      tone: "good",
    });
  }

  return { cleanSignals, reviewSignals };
}

function EvidenceList({
  title,
  signals,
  emptyLabel,
  marker,
}: {
  title: string;
  signals: EvidenceSignal[];
  emptyLabel: string;
  marker: "clean" | "review";
}) {
  const visibleSignals =
    signals.length > 0 ? signals : [{ label: emptyLabel, tone: "neutral" }];

  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
      <p className="text-sm font-semibold text-neutral-950">{title}</p>
      <ul className="mt-3 space-y-2">
        {visibleSignals.map((signal) => (
          <li key={signal.label} className="flex gap-2 text-sm leading-6">
            <span
              aria-hidden="true"
              className={[
                "font-semibold",
                marker === "clean" ? "text-emerald-700" : "text-amber-700",
              ].join(" ")}
            >
              {marker === "clean" ? "✓" : "⚠"}
            </span>
            <span className="text-neutral-700">
              {normalizePresentationText(signal.label)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReputationSection({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const reputation = result.endUserReport.reputation;
  const { cleanSignals, reviewSignals } = getReputationEvidence(result);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-neutral-950">Reputation</p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          Provider and history signals.
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidenceList
          title="Clean Signals"
          signals={cleanSignals}
          emptyLabel="No clean signals confirmed"
          marker="clean"
        />
        <EvidenceList
          title="Review Signals"
          signals={reviewSignals}
          emptyLabel="No review signals detected"
          marker="review"
        />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label="Risk Score" value={reputation.fraudRisk} />
        <ReportField label="Abuse History" value={reputation.abuseSignals} />
        <ReportField label="Confidence" value={reputation.confidence} />
      </dl>
    </section>
  );
}

function getIpTypeDisplay(
  identity: AnalysisResult["endUserReport"]["identity"],
) {
  if (identity.ipType === "Residential ISP") {
    return {
      icon: "🏠",
      label: "Residential ISP",
      detail: "Residential ISP detected. No datacenter or VPN signal.",
    };
  }

  if (identity.ipType === "Datacenter") {
    return {
      icon: "🏢",
      label: "Datacenter",
      detail:
        "Datacenter IP detected. Some platforms may require verification.",
    };
  }

  if (identity.ipType === "VPN / Proxy") {
    return {
      icon: "🛡",
      label: "VPN / Proxy",
      detail:
        "VPN / proxy signal detected. Some platforms may require verification.",
    };
  }

  return {
    icon: "",
    label: "Unknown",
    detail: identity.detail,
  };
}

function IpIdentitySection({ result }: { result: AnalysisResult }) {
  if (!result.finalDecision) {
    return null;
  }

  const identity = result.endUserReport.identity;
  const location = result.endUserReport.location;
  const ipType = getIpTypeDisplay(identity);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-950">
              IP Identity
            </p>
            <StatusBadge tone={identity.tone} variant="quiet">
              IP Type
            </StatusBadge>
          </div>
          <p className="mt-4 flex items-center gap-3 text-3xl font-semibold leading-tight text-neutral-950">
            {ipType.icon ? (
              <span aria-hidden="true" className="text-2xl">
                {ipType.icon}
              </span>
            ) : null}
            <span>{ipType.label}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {ipType.detail}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
          <p className="text-sm font-semibold text-neutral-950">Location</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ReportField label="Country" value={location.country} />
            <ReportField label="City" value={location.city} />
            <ReportField label="Region" value={location.region} />
          </dl>
        </div>
      </div>
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
        <p className="text-sm font-semibold text-neutral-950">Recommendation</p>
        <p className="text-sm leading-6 text-neutral-500">
          {result.qualityReport.recommendationExplanation}
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
          <p className="text-sm font-semibold text-neutral-950">Cloudflare</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Trace, WARP, and consistency signals.
          </p>
        </div>
        <StatusBadge
          tone={
            result.networkIntegrity.hasCloudflare
              ? result.networkIntegrity.tone
              : "neutral"
          }
          className="mt-1 sm:mt-0"
        >
          {result.networkIntegrity.hasCloudflare
            ? "Trace available"
            : "Unavailable"}
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
              <StatusBadge tone={item.tone}>
                {normalizePresentationText(item.value)}
              </StatusBadge>
            </dd>
            <dd className="mt-2 text-sm leading-6 text-neutral-500">
              {normalizePresentationText(item.detail)}
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

type ConnectivityProbe = NonNullable<AnalysisResult["connectivity"]>["google"];

function getConnectivityStatusDisplay(status: ConnectivityProbe["status"]): {
  label: string;
  tone: StatusTone;
} {
  if (status === "verified_reachable") {
    return { label: "Reachable", tone: "good" };
  }

  if (status === "unreachable") {
    return { label: "Unreachable", tone: "risk" };
  }

  return { label: "Not verified", tone: "neutral" };
}

function getConnectivityMethodLabel(method: ConnectivityProbe["method"]) {
  if (method === "cors-fetch") {
    return "Direct browser check";
  }

  if (method === "image") {
    return "Image probe";
  }

  return "Browser probe";
}

function TechnicalConnectivitySection({ result }: { result: AnalysisResult }) {
  const connectivity =
    result.connectivity ?? result.finalDecision?.decision.connectivity ?? null;

  if (!connectivity) {
    return (
      <section className="surface-card rounded-2xl border bg-white p-5">
        <p className="text-sm font-semibold text-neutral-950">Connectivity</p>
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          Connectivity probe data is unavailable.
        </p>
      </section>
    );
  }

  const probes = [
    { label: "Google", result: connectivity.google },
    { label: "YouTube", result: connectivity.youtube },
    { label: "OpenAI", result: connectivity.openai },
  ];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">Connectivity</p>
        <p className="text-sm leading-6 text-neutral-500">
          Browser reachability probes.
        </p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {probes.map((probe) => {
          const display = getConnectivityStatusDisplay(probe.result.status);

          return (
            <div
              key={probe.label}
              className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4"
            >
              <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                {probe.label}
              </dt>
              <dd className="mt-2">
                <StatusBadge tone={display.tone}>{display.label}</StatusBadge>
              </dd>
              <dd className="mt-2 text-sm leading-6 text-neutral-500">
                {getConnectivityMethodLabel(probe.result.method)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function TechnicalIpFactsSection({ result }: { result: AnalysisResult }) {
  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <p className="text-sm font-semibold text-neutral-950">IPInfo & ASN</p>
      <p className="mt-1 text-sm leading-6 text-neutral-500">
        Network owner and location fields.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label="IP Address" value={result.ip.address} />
        {result.ip.facts.map((fact) => (
          <ReportField key={fact.label} label={fact.label} value={fact.value} />
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
        <p className="text-sm font-semibold text-neutral-950">IPQS</p>
        <p className="text-sm leading-6 text-neutral-500">
          Provider reputation fields.
        </p>
      </div>

      {ipqs?.status === "available" ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReportField label="Risk Score" value={`${ipqs.fraud_score}/100`} />
          <ReportField
            label="Country"
            value={ipqs.country || "Not identified"}
          />
          <ReportField label="VPN" value={ipqs.vpn ? "Yes" : "No"} />
          <ReportField label="Proxy" value={ipqs.proxy ? "Yes" : "No"} />
          <ReportField label="Tor" value={ipqs.tor ? "Yes" : "No"} />
          <ReportField
            label="Bot Signal"
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
      summary="ASN, IPInfo, IPQS, connectivity, and Cloudflare"
      isExpanded={isTechnicalDetailsVisible}
      onToggle={() =>
        setIsTechnicalDetailsVisible((currentVisibility) => !currentVisibility)
      }
      contentId="technical-details-content"
    >
      <div className="mt-3 flex flex-col gap-4">
        <TechnicalIpFactsSection result={result} />
        <TechnicalIpqsSection result={result} />
        <TechnicalConnectivitySection result={result} />
        <NetworkIntegritySection result={result} />
      </div>
    </DisclosureSection>
  );
}

export function IpAnalyzer({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-6 flex w-full flex-col gap-4 text-left">
      <IpHealthScoreCard result={result} />
      <IpIdentitySection result={result} />
      <ReputationSection result={result} />
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
