import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  getAnalyticsSummary,
  type AnalyticsCountBucket,
  type AnalyticsDayBucket,
  type AnalyticsSummary,
} from "@/lib/analytics-storage";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAnalyticsConfigured,
  verifyAdminSession,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics | IP Health",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const countryDisplayNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const countryNameFallbacks: Record<string, string> = {
  AE: "United Arab Emirates",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BE: "Belgium",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KR: "South Korea",
  MX: "Mexico",
  MY: "Malaysia",
  NL: "Netherlands",
  NO: "Norway",
  NZ: "New Zealand",
  PH: "Philippines",
  PL: "Poland",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Turkey",
  TW: "Taiwan",
  US: "United States",
  VN: "Vietnam",
  ZA: "South Africa",
};

const networkIdentityLabels: Record<string, string> = {
  "Residential ISP": "🏠 Residential ISP",
  "Mobile Network": "📱 Mobile Network",
  "Enterprise Network": "🏢 Enterprise Network",
  "Public Infrastructure": "🌐 Public Infrastructure",
  "Cloud Provider": "☁️ Cloud Provider",
  Datacenter: "🖥️ Datacenter",
  "VPN / Proxy": "🛡️ VPN / Proxy",
  "Tor Exit": "🧅 Tor Exit",
  Unknown: "❓ Unknown",
};

const evidenceQualityLabels: Record<string, string> = {
  High: "🟢 High",
  Medium: "🟡 Medium",
  Low: "🔴 Low",
  Pending: "⚪ Pending",
};

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "No data";
  }

  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatShare(count: number, total: number) {
  if (total === 0) {
    return "0%";
  }

  const share = (count / total) * 100;

  return `${share < 1 ? "<1" : Math.round(share)}%`;
}

function formatDay(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function getCountryName(countryCode: string) {
  if (countryNameFallbacks[countryCode]) {
    return countryNameFallbacks[countryCode];
  }

  try {
    return countryDisplayNames?.of(countryCode) ?? null;
  } catch {
    return null;
  }
}

function getCountryFlag(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return "";
  }

  return Array.from(countryCode)
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function formatCountryLabel(label: string) {
  const countryCode = label.trim().toUpperCase();

  if (!countryCode || countryCode === "UNKNOWN") {
    return "Unknown";
  }

  const flag = getCountryFlag(countryCode);
  const countryName = getCountryName(countryCode);
  const codeLabel = flag ? `${flag} ${countryCode}` : countryCode;

  if (!countryName || countryName === countryCode) {
    return codeLabel;
  }

  return `${codeLabel} / ${countryName}`;
}

function formatNetworkIdentityLabel(label: string) {
  return networkIdentityLabels[label] ?? `❓ ${label || "Unknown"}`;
}

function formatEvidenceQualityLabel(label: string) {
  return evidenceQualityLabels[label] ?? `⚪ ${label || "Pending"}`;
}

function getStepRate(count: number, previousCount: number) {
  if (previousCount === 0) {
    return null;
  }

  return Math.round((count / previousCount) * 1000) / 10;
}

function getFunnelBarWidth(count: number, denominator: number) {
  if (count === 0 || denominator === 0) {
    return "0%";
  }

  return `${Math.max(4, Math.min(100, (count / denominator) * 100))}%`;
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="surface-card-soft rounded-2xl border bg-white p-5">
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-neutral-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-neutral-500">{detail}</p>
    </article>
  );
}

function Panel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card-soft rounded-2xl border bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {detail ? (
          <p className="text-xs font-medium uppercase tracking-normal text-neutral-400">
            {detail}
          </p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EventsByDayChart({ days }: { days: AnalyticsDayBucket[] }) {
  const maxCount = Math.max(1, ...days.map((day) => day.count));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const height =
          day.count === 0
            ? "0.25rem"
            : `${Math.max(0.75, (day.count / maxCount) * 7)}rem`;

        return (
          <div
            key={day.date}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3"
          >
            <div>
              <p className="text-xs font-medium text-neutral-500">
                {formatDay(day.date)}
              </p>
              <p className="mt-1 text-lg font-semibold leading-none text-neutral-950">
                {formatNumber(day.count)}
              </p>
            </div>
            <div className="flex h-28 items-end rounded-lg bg-white px-2 py-1 shadow-inner shadow-neutral-200/60">
              <div
                className="w-full rounded-t-md bg-neutral-950"
                style={{ height }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DistributionTable({
  rows,
  total,
  maxRows,
  labelTitle = "Name",
  maxWidthClassName = "max-w-xl",
  renderLabel,
}: {
  rows: AnalyticsCountBucket[];
  total?: number;
  maxRows?: number;
  labelTitle?: string;
  maxWidthClassName?: string;
  renderLabel?: (label: string) => ReactNode;
}) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;
  const denominator =
    total ?? visibleRows.reduce((sum, row) => sum + row.count, 0);

  if (visibleRows.length === 0) {
    return <p className="text-sm text-neutral-500">No data</p>;
  }

  return (
    <div className={`${maxWidthClassName} overflow-x-auto`}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-normal text-neutral-400">
            <th className="border-b border-neutral-100 pb-2 pr-4">
              {labelTitle}
            </th>
            <th className="border-b border-neutral-100 pb-2 pr-4 text-right">
              Count
            </th>
            <th className="border-b border-neutral-100 pb-2 text-right">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.label}>
              <td className="border-b border-neutral-100 py-3 pr-4 font-medium text-neutral-800">
                {renderLabel ? renderLabel(row.label) : row.label}
              </td>
              <td className="border-b border-neutral-100 py-3 pr-4 text-right text-neutral-600">
                {formatNumber(row.count)}
              </td>
              <td className="border-b border-neutral-100 py-3 text-right text-neutral-500">
                {formatShare(row.count, denominator)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelRow({
  label,
  count,
  rate,
  detail,
  width,
}: {
  label: string;
  count: number;
  rate: number | null;
  detail: string;
  width: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        <p className="whitespace-nowrap text-sm font-semibold text-neutral-950">
          {formatNumber(count)}
          {rate === null ? "" : ` / ${formatPercent(rate)}`}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-neutral-950" style={{ width }} />
      </div>
      <p className="mt-2 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

function FunnelSection({ summary }: { summary: AnalyticsSummary }) {
  const feedbackCount = summary.feedbackVoteCount;
  const completedRate = getStepRate(
    summary.analyzeCompletedCount,
    summary.analyzeStartedCount,
  );
  const feedbackRate = getStepRate(
    feedbackCount,
    summary.analyzeCompletedCount,
  );
  const startedWidth = getFunnelBarWidth(
    summary.analyzeStartedCount,
    summary.analyzeStartedCount,
  );
  const completedWidth = getFunnelBarWidth(
    summary.analyzeCompletedCount,
    summary.analyzeStartedCount,
  );
  const feedbackWidth = getFunnelBarWidth(
    feedbackCount,
    summary.analyzeStartedCount,
  );

  return (
    <div className="max-w-lg">
      <FunnelRow
        label="Analyze Started"
        count={summary.analyzeStartedCount}
        rate={null}
        detail="Entry step"
        width={startedWidth}
      />
      <div className="py-1 pl-4 text-lg leading-none text-neutral-300">↓</div>
      <FunnelRow
        label="Analyze Completed"
        count={summary.analyzeCompletedCount}
        rate={completedRate}
        detail="completed / started"
        width={completedWidth}
      />
      <div className="py-1 pl-4 text-lg leading-none text-neutral-300">↓</div>
      <FunnelRow
        label="Feedback Submitted"
        count={feedbackCount}
        rate={feedbackRate}
        detail="feedback / completed"
        width={feedbackWidth}
      />
    </div>
  );
}

function Dashboard({ summary }: { summary: AnalyticsSummary }) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's analyses"
          value={formatNumber(summary.todayAnalyzeCompletedCount)}
          detail="completed analyses today, UTC"
        />
        <MetricCard
          title="Last 7 days analyses"
          value={formatNumber(summary.lastSevenDaysAnalyzeCompletedCount)}
          detail="completed analyses in the chart window"
        />
        <MetricCard
          title="Feedback votes"
          value={formatNumber(summary.feedbackVoteCount)}
          detail={`${formatNumber(summary.helpfulFeedbackCount)} helpful`}
        />
        <MetricCard
          title="Negative feedback count"
          value={formatNumber(summary.negativeFeedbackCount)}
          detail="feedback_not_helpful events"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total analyses"
          value={formatNumber(summary.analyzeCompletedCount)}
          detail={`${formatNumber(summary.analyzeStartedCount)} started`}
        />
        <MetricCard
          title="Completion rate"
          value={formatPercent(summary.analyzeCompletionRate)}
          detail="completed / started"
        />
        <MetricCard
          title="Helpful rate"
          value={formatPercent(summary.feedbackHelpfulRate)}
          detail={`${formatNumber(summary.feedbackVoteCount)} feedback votes`}
        />
        <MetricCard
          title="Compare starts"
          value={formatNumber(summary.compareStartedCount)}
          detail="compare_started events"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Events by day" detail="Last 7 days, UTC">
          <EventsByDayChart days={summary.eventsByDay} />
        </Panel>

        <Panel title="Analysis funnel">
          <FunnelSection summary={summary} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Top countries">
          <DistributionTable
            rows={summary.analyzeCompletedByCountry}
            total={summary.analyzeCompletedCount}
            maxRows={8}
            labelTitle="Country"
            renderLabel={formatCountryLabel}
          />
        </Panel>

        <Panel title="Negative feedback">
          <DistributionTable
            rows={summary.negativeFeedbackReasons}
            total={summary.negativeFeedbackCount}
            labelTitle="Reason"
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Network identity">
          <DistributionTable
            rows={summary.analyzeCompletedByNetworkIdentityCategory}
            total={summary.analyzeCompletedCount}
            labelTitle="Type"
            maxWidthClassName="max-w-md"
            renderLabel={formatNetworkIdentityLabel}
          />
        </Panel>

        <Panel title="Evidence quality">
          <DistributionTable
            rows={summary.analyzeCompletedByEvidenceQuality}
            total={summary.analyzeCompletedCount}
            labelTitle="Quality"
            maxWidthClassName="max-w-sm"
            renderLabel={formatEvidenceQualityLabel}
          />
        </Panel>
      </div>
    </>
  );
}

export default async function AdminAnalyticsPage() {
  if (!isAdminAnalyticsConfigured()) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!verifyAdminSession(sessionCookie)) {
    redirect("/admin/login");
  }

  const summary = await getAnalyticsSummary();

  return (
    <main className="min-h-dvh bg-[#f7f8fb] px-5 py-8 text-neutral-950 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Internal dashboard
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
              Product analytics
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-medium text-neutral-600">
              {formatNumber(summary.totalEvents)} total events
            </span>
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-medium text-neutral-600">
              Aggregated only
            </span>
          </div>
        </header>

        {summary.totalEvents === 0 ? (
          <section className="surface-card-soft rounded-2xl border bg-white p-8 text-center">
            <p className="text-base font-medium text-neutral-500">
              No analytics events yet.
            </p>
          </section>
        ) : (
          <Dashboard summary={summary} />
        )}
      </div>
    </main>
  );
}
