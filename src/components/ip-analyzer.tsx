"use client";

import {
  Compass,
  ListChecks,
  Network,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { StatusTone } from "@/lib/status-colors";
import type { AnalysisResult } from "@/lib/analysis";
import { localizeText, messages, type Locale } from "@/lib/localization";

type OverallVerdict = NonNullable<
  AnalysisResult["finalDecision"]
>["decision"]["overallVerdict"];

type UsageRecommendation = {
  title: string;
  items: string[];
  tone: StatusTone;
};

type VerdictDisplay = {
  label: string;
  description: string;
  tone: StatusTone;
};

const verdictContent: Record<OverallVerdict, VerdictDisplay> = {
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

function getReliabilityCappedVerdict(
  result: AnalysisResult,
): OverallVerdict | null {
  const verdict = getVerdict(result);

  if (!verdict) {
    return null;
  }

  if (
    result.qualityReport.dataQuality.level === "Low" &&
    verdict === "Healthy"
  ) {
    return "Use with Caution";
  }

  return verdict;
}

function getVerdictDisplay(result: AnalysisResult): VerdictDisplay | null {
  const verdict = getVerdict(result);

  if (!verdict) {
    return null;
  }

  if (result.qualityReport.dataQuality.level === "Low") {
    return {
      label: "Review Needed",
      description: "Insufficient evidence for a high-confidence verdict.",
      tone: "caution" satisfies StatusTone,
    };
  }

  if (
    result.qualityReport.dataQuality.level === "Medium" &&
    verdict === "Healthy"
  ) {
    return {
      label: "Good Quality",
      description: "Good available signals with some data sources unavailable.",
      tone: "good" satisfies StatusTone,
    };
  }

  return verdictContent[verdict];
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

  if (text.includes("tor")) {
    return {
      title: "Tor exit signal detected",
      whyItMatters:
        "Tor exit traffic is high risk for registration, verification, banking, payments, and sensitive login.",
    };
  }

  if (text.includes("minor review")) {
    return {
      title: "Minor review signal",
      whyItMatters:
        "Some checks may require review, but this is not a strong privacy-network signal by itself.",
    };
  }

  if (text.includes("enterprise network") || text.includes("corporate")) {
    return {
      title: "Enterprise network review",
      whyItMatters:
        "Large organization and shared corporate networks can receive extra checks on some platforms.",
    };
  }

  if (
    text.includes("public infrastructure") ||
    text.includes("edge infrastructure") ||
    text.includes("cdn") ||
    text.includes("public dns")
  ) {
    return {
      title: "Public infrastructure",
      whyItMatters:
        "Normal for services and edge networks, but not ideal as a personal browsing or account registration IP.",
    };
  }

  if (
    text.includes("hosting") ||
    text.includes("infrastructure") ||
    text.includes("asn")
  ) {
    return {
      title: "Cloud or hosting infrastructure",
      whyItMatters:
        "Some platforms add review steps for shared cloud hosting IP ranges.",
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
  const identity = result.endUserReport.identity.networkIdentity;
  const isConsumerAccess =
    identity === "Residential ISP" || identity === "Mobile Network";
  const isEnterprise = identity === "Enterprise Network";
  const isPublicInfrastructure = identity === "Public Infrastructure";
  const isHostedInfrastructure =
    identity === "Cloud Provider" || identity === "Datacenter";

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
        if (isConsumerAccess) {
          addCard({
            label: "Review",
            detail: "A secondary ownership signal may require review.",
            tone: "caution",
            title: "Minor review signal",
            whyItMatters:
              "Some checks may require review, but this is not a strong privacy-network signal by itself.",
          });
          return;
        }

        if (isEnterprise) {
          addCard({
            label: "Enterprise",
            detail: "Large organization traffic may receive extra checks.",
            tone: "caution",
            title: "Enterprise network review",
            whyItMatters:
              "Large organization and shared corporate networks can receive extra checks on some platforms.",
          });
          return;
        }

        if (isPublicInfrastructure) {
          addCard({
            label: "Public infrastructure",
            detail: "Service or edge infrastructure raised a review signal.",
            tone: "infrastructure",
            title: "Public infrastructure",
            whyItMatters:
              "Normal for services and edge networks, but not ideal as a personal browsing or account registration IP.",
          });
          return;
        }

        addCard({
          label: "Hosting",
          detail: "Network ownership raised a hosting risk signal.",
          tone: "infrastructure",
          title: "Cloud or hosting infrastructure",
          whyItMatters:
            "Some platforms add review steps for shared cloud hosting IP ranges.",
        });
        return;
      }

      if (signal.signalName === "proxy_cloudflare") {
        if (existingTitles.has("Tor exit signal detected")) {
          return;
        }

        if (isConsumerAccess) {
          addCard({
            label: "Review",
            detail: "A secondary network path signal may require review.",
            tone: "caution",
            title: "Minor review signal",
            whyItMatters:
              "Some checks may require review, but this is not a strong privacy-network signal by itself.",
          });
          return;
        }

        if (isEnterprise) {
          addCard({
            label: "Enterprise",
            detail: "A shared corporate network path may require review.",
            tone: "caution",
            title: "Enterprise network review",
            whyItMatters:
              "Large organization and shared corporate networks can receive extra checks on some platforms.",
          });
          return;
        }

        if (isPublicInfrastructure) {
          addCard({
            label: "Public infrastructure",
            detail: "An edge network path raised a review signal.",
            tone: "infrastructure",
            title: "Public infrastructure",
            whyItMatters:
              "Normal for services and edge networks, but not ideal as a personal browsing or account registration IP.",
          });
          return;
        }

        if (isHostedInfrastructure) {
          addCard({
            label: "Hosted infrastructure",
            detail: "Hosted infrastructure raised a review signal.",
            tone: "infrastructure",
            title: "Cloud or hosting infrastructure",
            whyItMatters:
              "Many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.",
          });
          return;
        }

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
  const identity = result.endUserReport.identity.networkIdentity;
  const isConsumerAccess =
    identity === "Residential ISP" || identity === "Mobile Network";
  const isEnterprise = identity === "Enterprise Network";
  const isPublicInfrastructure = identity === "Public Infrastructure";
  const isHostedInfrastructure =
    identity === "Cloud Provider" || identity === "Datacenter";
  const riskSignalText = result.riskSignals
    .map((signal) => `${signal.label} ${signal.detail}`)
    .join(" ")
    .toLowerCase();

  if (
    riskSignalText.includes("hosting") ||
    riskSignalText.includes("infrastructure") ||
    riskSignalText.includes("asn")
  ) {
    if (isConsumerAccess) {
      negativeSignals.add("Minor review signal");
    } else if (isEnterprise) {
      negativeSignals.add("Enterprise network review");
    } else if (isPublicInfrastructure) {
      negativeSignals.add("Public infrastructure");
    } else {
      negativeSignals.add("Cloud or hosting infrastructure");
    }
  }

  if (
    riskSignalText.includes("proxy") ||
    riskSignalText.includes("vpn") ||
    riskSignalText.includes("relay") ||
    riskSignalText.includes("warp")
  ) {
    if (isConsumerAccess) {
      negativeSignals.add("Minor review signal");
    } else if (isEnterprise) {
      negativeSignals.add("Enterprise network review");
    } else if (isHostedInfrastructure) {
      negativeSignals.add("Cloud or hosting infrastructure");
    } else {
      negativeSignals.add("VPN or proxy signal detected");
    }
  }

  if (riskSignalText.includes("tor")) {
    negativeSignals.add("Tor exit signal detected");
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
  titleIcon,
  summary,
  isExpanded,
  onToggle,
  contentId,
  children,
}: {
  title: string;
  titleIcon?: ReactNode;
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
            {titleIcon}
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

function IpHealthScoreCard({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const verdictDisplay = getVerdictDisplay(result);
  const qualityReport = result.qualityReport;
  const scoreDisplay = qualityReport.displayValue;
  const scoreSuffix = "/100";
  const summary = qualityReport.summary;
  const dataQuality = qualityReport.dataQuality;
  const assessment = qualityReport.assessment;
  const externalSignals = result.finalDecision?.decision.externalSignals;
  const providerStatuses = [
    {
      label: "IPQS",
      value:
        externalSignals?.ipqs.status === "available"
          ? "available"
          : "unavailable",
      tone:
        externalSignals?.ipqs.status === "available"
          ? ("good" as const)
          : ("caution" as const),
    },
    {
      label: "Scamalytics",
      value:
        externalSignals?.scamalytics.status === "available"
          ? "available"
          : "unavailable",
      tone:
        externalSignals?.scamalytics.status === "available"
          ? ("good" as const)
          : ("caution" as const),
    },
    {
      label: "ipapi.is",
      value:
        externalSignals?.ipApiIs.status === "available"
          ? "available"
          : "unavailable",
      tone:
        externalSignals?.ipApiIs.status === "available"
          ? ("good" as const)
          : ("caution" as const),
    },
  ];
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
            {t("IP Health Score")}
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
                tone={qualityReport.confidenceTone}
                className="px-3 py-1.5 text-sm"
              >
                {t(`Confidence: ${qualityReport.confidence}`)}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                {t("Confidence pending")}
              </StatusBadge>
            )}
            <span className="text-sm leading-6 text-neutral-500">
              {t(summary)}
            </span>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4 sm:w-64">
          <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
            {t("Checked IP")}
          </p>
          <p className="mt-2 break-all text-lg font-semibold leading-7 text-neutral-950">
            {result.ip.address || t("Not analyzed")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.trustScore.hasAnalysis && verdictDisplay ? (
              <StatusBadge
                tone={verdictDisplay.tone}
                className="px-3 py-1.5 text-sm"
              >
                {t(verdictDisplay.label)}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" className="px-3 py-1.5 text-sm">
                {t("Pending")}
              </StatusBadge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <ShieldCheck
                aria-hidden="true"
                className="size-4 text-neutral-400"
              />
              {t("Evidence Quality")}
            </p>
            <StatusBadge tone={dataQuality.tone} variant="quiet">
              {t(dataQuality.level)}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            {t(dataQuality.reason)}
          </p>
          {result.trustScore.hasAnalysis ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {providerStatuses.map((provider) => (
                <StatusBadge
                  key={provider.label}
                  tone={provider.tone}
                  variant="quiet"
                >
                  {provider.label} {t(provider.value)}
                </StatusBadge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-950">{t("Assessment")}</p>
            <StatusBadge tone={assessment.tone} variant="quiet">
              {t(assessment.label)}
            </StatusBadge>
          </div>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-neutral-600 sm:grid-cols-3">
            {assessment.items.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
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
                  <span>{t(dimension.label)}</span>
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-neutral-800">
                  {t(dimension.assessmentLabel)}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {t(dimension.summary)}
                </p>
              </div>
              <StatusBadge tone={dimension.tone} variant="quiet">
                {dimension.displayValue}/100
              </StatusBadge>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">
              {t(dimension.detail)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone={dimension.confidenceTone} variant="quiet">
                {t(`Confidence: ${dimension.confidence}`)}
              </StatusBadge>
              <span className="text-xs leading-5 text-neutral-400">
                {t(dimension.confidenceReason)}
              </span>
            </div>
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
    normalizedLabel.includes("minor review") ||
    normalizedLabel.includes("enterprise network")
  ) {
    return "caution";
  }

  if (normalizedLabel.includes("public infrastructure")) {
    return "infrastructure";
  }

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
  locale,
}: {
  title: string;
  signals: EvidenceSignal[];
  emptyLabel: string;
  marker: "clean" | "review";
  locale: Locale;
}) {
  const visibleSignals =
    signals.length > 0 ? signals : [{ label: emptyLabel, tone: "neutral" }];

  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
      <p className="text-sm font-semibold text-neutral-950">{localizeText(locale, title)}</p>
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
              {localizeText(locale, normalizePresentationText(signal.label))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReputationSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  if (!result.finalDecision) {
    return null;
  }

  const reputation = result.endUserReport.reputation;
  const reputationDimension = result.qualityReport.dimensions.reputation;
  const { cleanSignals, reviewSignals } = getReputationEvidence(result);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-neutral-950">{t("Reputation")}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          {t("Provider and history signals.")}
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidenceList
          title="Clean Signals"
          signals={cleanSignals}
          emptyLabel="No clean signals confirmed"
          marker="clean"
          locale={locale}
        />
        <EvidenceList
          title="Review Signals"
          signals={reviewSignals}
          emptyLabel="No review signals detected"
          marker="review"
          locale={locale}
        />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label={t("Risk Score")} value={t(reputation.fraudRisk)} />
        <ReportField label={t("Abuse History")} value={t(reputation.abuseSignals)} />
        <ReportField
          label={t("Confidence")}
          value={t(reputationDimension.confidence)}
        />
        <ReportField
          label={t("Reason")}
          value={t(reputationDimension.confidenceReason)}
        />
      </dl>
    </section>
  );
}

function getNetworkIdentityDisplay(
  identity: AnalysisResult["endUserReport"]["identity"],
) {
  const iconByIdentity: Record<string, string> = {
    "Residential ISP": "🏠",
    "Mobile Network": "📱",
    "Enterprise Network": "🏢",
    "Public Infrastructure": "🌐",
    "Cloud Provider": "☁",
    Datacenter: "🏢",
    "VPN / Proxy": "🛡",
    "Tor Exit": "🛡",
    Unknown: "",
  };
  const label = identity.networkIdentity ?? identity.ipType;

  return {
    icon: iconByIdentity[label] ?? "",
    label,
    detail: identity.detail,
  };
}

function IpIdentitySection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  if (!result.finalDecision) {
    return null;
  }

  const identity = result.endUserReport.identity;
  const location = result.endUserReport.location;
  const networkIdentity = getNetworkIdentityDisplay(identity);

  return (
    <section className="surface-card rounded-2xl border bg-white p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <Network
                aria-hidden="true"
                className="size-4 text-neutral-400"
              />
              {t("Network Identity")}
            </p>
            <StatusBadge tone={identity.tone} variant="quiet">
              {t("Network Identity")}
            </StatusBadge>
          </div>
          <p className="mt-4 flex items-center gap-3 text-3xl font-semibold leading-tight text-neutral-950">
            {networkIdentity.icon ? (
              <span aria-hidden="true" className="text-2xl">
                {networkIdentity.icon}
              </span>
            ) : null}
            <span>{t(networkIdentity.label)}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {t(networkIdentity.detail)}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <ReportField label={t("Provider")} value={identity.provider} />
            <ReportField
              label={t("Confidence")}
              value={t(identity.identityConfidence)}
            />
            <ReportField label={t("Reason")} value={t(identity.reason)} />
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
          <p className="text-sm font-semibold text-neutral-950">{t("Location")}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <ReportField label={t("Country")} value={location.country} />
            <ReportField label={t("City")} value={location.city} />
            <ReportField label={t("Region")} value={location.region} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function SharingRiskSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  if (!result.finalDecision) {
    return null;
  }

  const sharingRisk = result.endUserReport.sharingRisk;
  const evidence =
    sharingRisk.evidence.length > 0
      ? sharingRisk.evidence
      : ["No sharing evidence available"];

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
            <Users
              aria-hidden="true"
              className="size-4 text-neutral-400"
            />
            {t("Sharing Risk")}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {t(sharingRisk.reason)}
          </p>
        </div>
        <StatusBadge tone={sharingRisk.tone} className="shrink-0">
          {t(sharingRisk.label)}
        </StatusBadge>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
          {t("Evidence")}
        </p>
        <ul className="mt-3 space-y-2">
          {evidence.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6">
              <span
                aria-hidden="true"
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-neutral-400"
              />
              <span className="text-neutral-700">
                {t(normalizePresentationText(item))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RecommendedUsageSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const verdict = getReliabilityCappedVerdict(result);

  if (!verdict) {
    return null;
  }

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
          <Compass
            aria-hidden="true"
            className="size-4 text-neutral-400"
          />
          {t("Recommendation")}
        </p>
        <p className="text-sm leading-6 text-neutral-500">
          {t(result.qualityReport.recommendationExplanation)}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {usageRecommendations[verdict].map((group) => (
          <div
            key={group.title}
            className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4"
          >
            <p className="text-sm font-semibold text-neutral-950">
              {t(group.title)}
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
                  <span>{t(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function NetworkIntegritySection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-950">Cloudflare</p>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            {t("Trace, WARP, and consistency signals.")}
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
            ? t("Trace available")
            : t("Unavailable")}
        </StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.networkIntegrity.items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4"
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
              {t(item.label)}
            </dt>
            <dd className="mt-2">
              <StatusBadge tone={item.tone}>
                {t(normalizePresentationText(item.value))}
              </StatusBadge>
            </dd>
            <dd className="mt-2 text-sm leading-6 text-neutral-500">
              {t(normalizePresentationText(item.detail))}
            </dd>
          </div>
        ))}
      </dl>

      <p
        hidden={result.networkIntegrity.hasCloudflare}
        className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500"
      >
        {t(result.networkIntegrity.unavailableMessage)}
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

function TechnicalConnectivitySection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const connectivity =
    result.connectivity ?? result.finalDecision?.decision.connectivity ?? null;

  if (!connectivity) {
    return (
      <section className="surface-card rounded-2xl border bg-white p-5">
        <p className="text-sm font-semibold text-neutral-950">{t("Connectivity")}</p>
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          {t("Connectivity probe data is unavailable.")}
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
        <p className="text-sm font-semibold text-neutral-950">{t("Connectivity")}</p>
        <p className="text-sm leading-6 text-neutral-500">
          {t("Browser reachability probes.")}
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
                <StatusBadge tone={display.tone}>{t(display.label)}</StatusBadge>
              </dd>
              <dd className="mt-2 text-sm leading-6 text-neutral-500">
                {t(getConnectivityMethodLabel(probe.result.method))}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function TechnicalIpFactsSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <p className="text-sm font-semibold text-neutral-950">IPInfo & ASN</p>
      <p className="mt-1 text-sm leading-6 text-neutral-500">
        {t("Network owner and location fields.")}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReportField label="IP Address" value={result.ip.address} />
        {result.ip.facts.map((fact) => (
          <ReportField key={fact.label} label={t(fact.label)} value={fact.value} />
        ))}
      </dl>
    </section>
  );
}

function TechnicalIpqsSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const ipqs = result.finalDecision?.decision.externalSignals.ipqs;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">IPQS</p>
        <p className="text-sm leading-6 text-neutral-500">
          {t("Provider reputation fields.")}
        </p>
      </div>

      {ipqs?.status === "available" ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReportField label={t("Risk Score")} value={`${ipqs.fraud_score}/100`} />
          <ReportField
            label={t("Country")}
            value={ipqs.country || t("Not identified")}
          />
          <ReportField label="VPN" value={t(ipqs.vpn ? "Yes" : "No")} />
          <ReportField label="Proxy" value={t(ipqs.proxy ? "Yes" : "No")} />
          <ReportField label="Tor" value={t(ipqs.tor ? "Yes" : "No")} />
          <ReportField
            label={t("Bot Signal")}
            value={t(ipqs.bot_status ? "Yes" : "No")}
          />
        </dl>
      ) : (
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          {t(ipqs?.error ?? "IPQualityScore data is unavailable.")}
        </p>
      )}
    </section>
  );
}

function TechnicalScamalyticsSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const scamalytics =
    result.finalDecision?.decision.externalSignals.scamalytics;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">Scamalytics</p>
        <p className="text-sm leading-6 text-neutral-500">
          {t("Secondary reputation provider fields.")}
        </p>
      </div>

      {scamalytics?.status === "available" ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReportField label={t("Risk Score")} value={`${scamalytics.score}/100`} />
          <ReportField
            label={t("Risk Level")}
            value={t(scamalytics.risk || "Not reported")}
          />
          <ReportField
            label={t("Country")}
            value={scamalytics.country || t("Not identified")}
          />
          <ReportField label="VPN" value={t(scamalytics.vpn ? "Yes" : "No")} />
          <ReportField label="Proxy" value={t(scamalytics.proxy ? "Yes" : "No")} />
          <ReportField label="Tor" value={t(scamalytics.tor ? "Yes" : "No")} />
          <ReportField
            label={t("Server")}
            value={t(scamalytics.server ? "Yes" : "No")}
          />
        </dl>
      ) : (
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          {t(scamalytics?.error ?? "Scamalytics data is unavailable.")}
        </p>
      )}
    </section>
  );
}

function TechnicalIpApiIsSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const ipApiIs = result.finalDecision?.decision.externalSignals.ipApiIs;

  return (
    <section className="surface-card rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-neutral-950">ipapi.is</p>
        <p className="text-sm leading-6 text-neutral-500">
          {t("Secondary IP intelligence provider fields.")}
        </p>
      </div>

      {ipApiIs?.status === "available" ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReportField label={t("Status")} value={t("Available")} />
          <ReportField
            label={t("HTTP Status")}
            value={
              ipApiIs.providerStatus.httpStatusCode
                ? String(ipApiIs.providerStatus.httpStatusCode)
                : t("Not reported")
            }
          />
          <ReportField label="VPN" value={t(ipApiIs.vpn ? "Yes" : "No")} />
          <ReportField label="Proxy" value={t(ipApiIs.proxy ? "Yes" : "No")} />
          <ReportField label="Tor" value={t(ipApiIs.tor ? "Yes" : "No")} />
          <ReportField
            label={t("Datacenter")}
            value={t(ipApiIs.datacenter ? "Yes" : "No")}
          />
          <ReportField label={t("Hosting")} value={t(ipApiIs.hosting ? "Yes" : "No")} />
          <ReportField label="ASN" value={ipApiIs.asn || t("Not identified")} />
          <ReportField
            label={t("Organization")}
            value={ipApiIs.organization || ipApiIs.asnName || t("Not identified")}
          />
          <ReportField
            label={t("Location")}
            value={
              [ipApiIs.city, ipApiIs.region, ipApiIs.country]
                .filter(Boolean)
                .join(", ") || t("Not identified")
            }
          />
          <ReportField
            label={t("Abuser Signal")}
            value={t(ipApiIs.abuser ? "Yes" : "No")}
          />
        </dl>
      ) : (
        <p className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-500">
          {t(ipApiIs?.error ?? "ipapi.is data is unavailable.")}
        </p>
      )}
    </section>
  );
}

function TechnicalDetailsSection({ result, locale }: { result: AnalysisResult; locale: Locale }) {
  const t = messages(locale);
  const [isTechnicalDetailsVisible, setIsTechnicalDetailsVisible] =
    useState(false);

  if (!result.finalDecision) {
    return null;
  }

  return (
    <DisclosureSection
      title={t("Technical Details")}
      titleIcon={
        <ListChecks
          aria-hidden="true"
          className="size-4 shrink-0 text-neutral-400"
        />
      }
      summary={t("ASN, IPInfo, IPQS, Scamalytics, ipapi.is, connectivity, and Cloudflare")}
      isExpanded={isTechnicalDetailsVisible}
      onToggle={() =>
        setIsTechnicalDetailsVisible((currentVisibility) => !currentVisibility)
      }
      contentId="technical-details-content"
    >
      <div className="mt-3 flex flex-col gap-4">
        <TechnicalIpFactsSection result={result} locale={locale} />
        <TechnicalIpqsSection result={result} locale={locale} />
        <TechnicalScamalyticsSection result={result} locale={locale} />
        <TechnicalIpApiIsSection result={result} locale={locale} />
        <TechnicalConnectivitySection result={result} locale={locale} />
        <NetworkIntegritySection result={result} locale={locale} />
      </div>
    </DisclosureSection>
  );
}

export function IpAnalyzer({ result, locale = "en" }: { result: AnalysisResult; locale?: Locale }) {
  const t = messages(locale);
  return (
    <div className="mt-6 flex w-full flex-col gap-4 text-left">
      <IpHealthScoreCard result={result} locale={locale} />
      <IpIdentitySection result={result} locale={locale} />
      <SharingRiskSection result={result} locale={locale} />
      <ReputationSection result={result} locale={locale} />
      <RecommendedUsageSection result={result} locale={locale} />
      <TechnicalDetailsSection result={result} locale={locale} />

      <p className="text-xs leading-5 text-neutral-400">
        {t("IP Health provides reputation-based guidance only. Services may also consider account history, device signals, payment method, browser fingerprint, and behavior.")}
      </p>
    </div>
  );
}
