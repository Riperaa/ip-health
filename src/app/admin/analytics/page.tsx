import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getAnalyticsSummary,
  type AnalyticsCountBucket,
  type AnalyticsDayBucket,
  type AnalyticsSummary,
} from "@/lib/analytics-storage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics | IP Health",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminAnalyticsPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card-soft rounded-2xl border bg-white p-5">
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EventsByDayChart({ days }: { days: AnalyticsDayBucket[] }) {
  const maxCount = Math.max(1, ...days.map((day) => day.count));

  return (
    <div className="grid max-w-2xl gap-3">
      {days.map((day) => {
        const width = `${(day.count / maxCount) * 100}%`;

        return (
          <div
            key={day.date}
            className="grid grid-cols-[4.75rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm"
          >
            <span className="font-medium text-neutral-500">
              {formatDay(day.date)}
            </span>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-950"
                style={{ width }}
              />
            </div>
            <span className="text-right font-semibold text-neutral-800">
              {formatNumber(day.count)}
            </span>
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
}: {
  rows: AnalyticsCountBucket[];
  total?: number;
  maxRows?: number;
}) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;
  const denominator =
    total ?? visibleRows.reduce((sum, row) => sum + row.count, 0);

  if (visibleRows.length === 0) {
    return <p className="text-sm text-neutral-500">No data</p>;
  }

  return (
    <div className="max-w-xl overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-normal text-neutral-400">
            <th className="border-b border-neutral-100 pb-2 pr-4">Name</th>
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
                {row.label}
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

function Dashboard({ summary }: { summary: AnalyticsSummary }) {
  const feedbackCount =
    summary.helpfulFeedbackCount + summary.notHelpfulFeedbackCount;

  return (
    <>
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
          detail={`${formatNumber(feedbackCount)} feedback votes`}
        />
        <MetricCard
          title="Compare starts"
          value={formatNumber(summary.compareStartedCount)}
          detail="compare_started events"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Events by day">
          <EventsByDayChart days={summary.eventsByDay} />
        </Panel>

        <Panel title="Top countries">
          <DistributionTable
            rows={summary.analyzeCompletedByCountry}
            total={summary.analyzeCompletedCount}
            maxRows={8}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Network identity">
          <DistributionTable
            rows={summary.analyzeCompletedByNetworkIdentityCategory}
            total={summary.analyzeCompletedCount}
          />
        </Panel>

        <Panel title="Evidence quality">
          <DistributionTable
            rows={summary.analyzeCompletedByEvidenceQuality}
            total={summary.analyzeCompletedCount}
          />
        </Panel>

        <Panel title="Negative feedback">
          <DistributionTable
            rows={summary.negativeFeedbackReasons}
            total={summary.notHelpfulFeedbackCount}
          />
        </Panel>
      </div>
    </>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: AdminAnalyticsPageProps) {
  const params = searchParams ? await searchParams : {};
  const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;

  if (adminToken && getSingleSearchParam(params.token) !== adminToken) {
    notFound();
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
