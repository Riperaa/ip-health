import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const analyticsEventNames = [
  "analyze_started",
  "analyze_completed",
  "compare_started",
  "feedback_helpful",
  "feedback_not_helpful",
] as const;

export const analyticsNetworkIdentityCategories = [
  "Residential ISP",
  "Mobile Network",
  "Enterprise Network",
  "Public Infrastructure",
  "Cloud Provider",
  "Datacenter",
  "VPN / Proxy",
  "Tor Exit",
  "Unknown",
] as const;

export const analyticsEvidenceQualities = [
  "High",
  "Medium",
  "Low",
  "Pending",
] as const;

export const analyticsFeedbackReasons = [
  "Wrong IP type",
  "Wrong location",
  "Score not convincing",
  "Missing information",
  "Other",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];
export type AnalyticsNetworkIdentityCategory =
  (typeof analyticsNetworkIdentityCategories)[number];
export type AnalyticsEvidenceQuality =
  (typeof analyticsEvidenceQualities)[number];
export type AnalyticsFeedbackReason = (typeof analyticsFeedbackReasons)[number];

export type AnalyticsEventRecord = {
  event_name: AnalyticsEventName;
  success: boolean | null;
  country_code: string | null;
  network_identity_category: AnalyticsNetworkIdentityCategory | null;
  evidence_quality: AnalyticsEvidenceQuality | null;
  feedback_reason: AnalyticsFeedbackReason | null;
};

export type AnalyticsCountBucket = {
  label: string;
  count: number;
};

export type AnalyticsDayBucket = {
  date: string;
  count: number;
};

export type AnalyticsSummary = {
  totalEvents: number;
  analyzeStartedCount: number;
  analyzeCompletedCount: number;
  todayAnalyzeCompletedCount: number;
  lastSevenDaysAnalyzeCompletedCount: number;
  analyzeCompletionRate: number | null;
  compareStartedCount: number;
  helpfulFeedbackCount: number;
  notHelpfulFeedbackCount: number;
  feedbackVoteCount: number;
  negativeFeedbackCount: number;
  feedbackHelpfulRate: number | null;
  eventsByDay: AnalyticsDayBucket[];
  analyzeCompletedByCountry: AnalyticsCountBucket[];
  analyzeCompletedByNetworkIdentityCategory: AnalyticsCountBucket[];
  analyzeCompletedByEvidenceQuality: AnalyticsCountBucket[];
  negativeFeedbackReasons: AnalyticsCountBucket[];
};

export type AnalyticsSupabaseEnvStatus = {
  SUPABASE_URL: boolean;
  SUPABASE_SERVICE_ROLE_KEY: boolean;
};

export class AnalyticsSupabaseConfigurationError extends Error {
  readonly envStatus: AnalyticsSupabaseEnvStatus;

  constructor(envStatus: AnalyticsSupabaseEnvStatus) {
    super("Supabase analytics environment variables are missing");
    this.name = "AnalyticsSupabaseConfigurationError";
    this.envStatus = envStatus;
  }
}

export class AnalyticsEventValidationError extends Error {
  constructor() {
    super("Invalid analytics event record");
    this.name = "AnalyticsEventValidationError";
  }
}

let supabaseClient: SupabaseClient | undefined;
const analyticsSummaryPageSize = 1000;

export function getAnalyticsSupabaseEnvStatus(): AnalyticsSupabaseEnvStatus {
  return {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isAllowedValue<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): value is T[number] {
  return typeof value === "string" && allowedValues.includes(value);
}

export function isAllowedAnalyticsEventName(
  value: unknown,
): value is AnalyticsEventName {
  return isAllowedValue(value, analyticsEventNames);
}

export function isAllowedNetworkIdentityCategory(
  value: unknown,
): value is AnalyticsNetworkIdentityCategory {
  return isAllowedValue(value, analyticsNetworkIdentityCategories);
}

export function isAllowedEvidenceQuality(
  value: unknown,
): value is AnalyticsEvidenceQuality {
  return isAllowedValue(value, analyticsEvidenceQualities);
}

export function isAllowedFeedbackReason(
  value: unknown,
): value is AnalyticsFeedbackReason {
  return isAllowedValue(value, analyticsFeedbackReasons);
}

export function isAllowedCountryCode(value: unknown) {
  return (
    typeof value === "string" &&
    (value === "Unknown" || /^[A-Z]{2}$/.test(value))
  );
}

function isNull(value: unknown): value is null {
  return value === null;
}

function isNullOrAllowedCountryCode(value: unknown) {
  return isNull(value) || isAllowedCountryCode(value);
}

function isNullOrNetworkIdentityCategory(
  value: unknown,
): value is AnalyticsNetworkIdentityCategory | null {
  return isNull(value) || isAllowedNetworkIdentityCategory(value);
}

function isNullOrEvidenceQuality(
  value: unknown,
): value is AnalyticsEvidenceQuality | null {
  return isNull(value) || isAllowedEvidenceQuality(value);
}

function isNullOrFeedbackReason(
  value: unknown,
): value is AnalyticsFeedbackReason | null {
  return isNull(value) || isAllowedFeedbackReason(value);
}

function isNullOrBoolean(value: unknown): value is boolean | null {
  return isNull(value) || typeof value === "boolean";
}

export function isAnalyticsEventRecord(
  value: unknown,
): value is AnalyticsEventRecord {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "event_name",
      "success",
      "country_code",
      "network_identity_category",
      "evidence_quality",
      "feedback_reason",
    ]) ||
    !isAllowedAnalyticsEventName(value.event_name) ||
    !isNullOrBoolean(value.success) ||
    !isNullOrAllowedCountryCode(value.country_code) ||
    !isNullOrNetworkIdentityCategory(value.network_identity_category) ||
    !isNullOrEvidenceQuality(value.evidence_quality) ||
    !isNullOrFeedbackReason(value.feedback_reason)
  ) {
    return false;
  }

  if (
    value.event_name === "analyze_started" ||
    value.event_name === "compare_started"
  ) {
    return (
      value.success === null &&
      value.country_code === null &&
      value.network_identity_category === null &&
      value.evidence_quality === null &&
      value.feedback_reason === null
    );
  }

  if (value.event_name === "analyze_completed") {
    return (
      typeof value.success === "boolean" &&
      value.country_code !== null &&
      value.network_identity_category !== null &&
      value.evidence_quality !== null &&
      value.feedback_reason === null
    );
  }

  if (value.event_name === "feedback_helpful") {
    return (
      value.success === null &&
      value.country_code !== null &&
      value.network_identity_category !== null &&
      value.evidence_quality !== null &&
      value.feedback_reason === null
    );
  }

  return (
    value.success === null &&
    value.country_code !== null &&
    value.network_identity_category !== null &&
    value.evidence_quality !== null &&
    value.feedback_reason !== null
  );
}

export async function insertAnalyticsEvent(record: AnalyticsEventRecord) {
  if (!isAnalyticsEventRecord(record)) {
    throw new AnalyticsEventValidationError();
  }

  const client = getSupabaseClient();

  if (!client) {
    throw new AnalyticsSupabaseConfigurationError(
      getAnalyticsSupabaseEnvStatus(),
    );
  }

  const { error } = await client.from("analytics_events").insert(record);

  if (error) {
    throw error;
  }
}

export async function storeAnalyticsEvent(record: AnalyticsEventRecord) {
  await insertAnalyticsEvent(record);
}

type AnalyticsSummaryRow = AnalyticsEventRecord & {
  created_at: string;
};

function isAllowedCreatedAt(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isAnalyticsSummaryRow(value: unknown): value is AnalyticsSummaryRow {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "created_at",
      "event_name",
      "success",
      "country_code",
      "network_identity_category",
      "evidence_quality",
      "feedback_reason",
    ]) ||
    !isAllowedCreatedAt(value.created_at)
  ) {
    return false;
  }

  return isAnalyticsEventRecord({
    event_name: value.event_name,
    success: value.success,
    country_code: value.country_code,
    network_identity_category: value.network_identity_category,
    evidence_quality: value.evidence_quality,
    feedback_reason: value.feedback_reason,
  });
}

function buildLastSevenDayKeys(referenceDate = new Date()) {
  const utcToday = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(utcToday);
    day.setUTCDate(utcToday.getUTCDate() - (6 - index));

    return day.toISOString().slice(0, 10);
  });
}

function toUtcDayKey(createdAt: string) {
  return new Date(createdAt).toISOString().slice(0, 10);
}

function buildEmptySummary(referenceDate = new Date()): AnalyticsSummary {
  return {
    totalEvents: 0,
    analyzeStartedCount: 0,
    analyzeCompletedCount: 0,
    todayAnalyzeCompletedCount: 0,
    lastSevenDaysAnalyzeCompletedCount: 0,
    analyzeCompletionRate: null,
    compareStartedCount: 0,
    helpfulFeedbackCount: 0,
    notHelpfulFeedbackCount: 0,
    feedbackVoteCount: 0,
    negativeFeedbackCount: 0,
    feedbackHelpfulRate: null,
    eventsByDay: buildLastSevenDayKeys(referenceDate).map((date) => ({
      date,
      count: 0,
    })),
    analyzeCompletedByCountry: [],
    analyzeCompletedByNetworkIdentityCategory: [],
    analyzeCompletedByEvidenceQuality: [],
    negativeFeedbackReasons: [],
  };
}

function incrementBucket(bucket: Map<string, number>, key: string) {
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function toSortedBuckets(bucket: Map<string, number>): AnalyticsCountBucket[] {
  return Array.from(bucket.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => {
      if (second.count !== first.count) {
        return second.count - first.count;
      }

      return first.label.localeCompare(second.label);
    });
}

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function isMissingAnalyticsSummaryRpcError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";

  return (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("get_analytics_summary")
  );
}

async function getAnalyticsSummaryRows(client: SupabaseClient) {
  const rows: AnalyticsSummaryRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("analytics_events")
      .select(
        [
          "created_at",
          "event_name",
          "success",
          "country_code",
          "network_identity_category",
          "evidence_quality",
          "feedback_reason",
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .range(from, from + analyticsSummaryPageSize - 1);

    if (error) {
      throw error;
    }

    const page = data ?? [];

    for (const row of page) {
      if (!isAnalyticsSummaryRow(row)) {
        throw new AnalyticsEventValidationError();
      }

      rows.push(row);
    }

    if (page.length < analyticsSummaryPageSize) {
      break;
    }

    from += analyticsSummaryPageSize;
  }

  return rows;
}

function buildAnalyticsSummaryFromRows(rows: AnalyticsSummaryRow[]) {
  const summary = buildEmptySummary();
  const lastSevenDayCounts = new Map(
    summary.eventsByDay.map((day) => [day.date, day.count]),
  );
  const lastSevenDayKeys = new Set(summary.eventsByDay.map((day) => day.date));
  const todayKey = summary.eventsByDay.at(-1)?.date;
  const completedByCountry = new Map<string, number>();
  const completedByNetworkIdentityCategory = new Map<string, number>();
  const completedByEvidenceQuality = new Map<string, number>();
  const negativeFeedbackReasons = new Map<string, number>();

  for (const row of rows) {
    summary.totalEvents += 1;

    const dayKey = toUtcDayKey(row.created_at);
    if (lastSevenDayCounts.has(dayKey)) {
      incrementBucket(lastSevenDayCounts, dayKey);
    }

    if (row.event_name === "analyze_started") {
      summary.analyzeStartedCount += 1;
      continue;
    }

    if (row.event_name === "compare_started") {
      summary.compareStartedCount += 1;
      continue;
    }

    if (row.event_name === "feedback_helpful") {
      summary.helpfulFeedbackCount += 1;
      continue;
    }

    if (row.event_name === "feedback_not_helpful") {
      if (!row.feedback_reason) {
        throw new AnalyticsEventValidationError();
      }

      summary.notHelpfulFeedbackCount += 1;
      incrementBucket(negativeFeedbackReasons, row.feedback_reason);
      continue;
    }

    if (
      !row.country_code ||
      !row.network_identity_category ||
      !row.evidence_quality
    ) {
      throw new AnalyticsEventValidationError();
    }

    summary.analyzeCompletedCount += 1;

    if (dayKey === todayKey) {
      summary.todayAnalyzeCompletedCount += 1;
    }

    if (lastSevenDayKeys.has(dayKey)) {
      summary.lastSevenDaysAnalyzeCompletedCount += 1;
    }

    incrementBucket(completedByCountry, row.country_code);
    incrementBucket(
      completedByNetworkIdentityCategory,
      row.network_identity_category,
    );
    incrementBucket(completedByEvidenceQuality, row.evidence_quality);
  }

  summary.analyzeCompletionRate = toRate(
    summary.analyzeCompletedCount,
    summary.analyzeStartedCount,
  );
  summary.feedbackHelpfulRate = toRate(
    summary.helpfulFeedbackCount,
    summary.helpfulFeedbackCount + summary.notHelpfulFeedbackCount,
  );
  summary.feedbackVoteCount =
    summary.helpfulFeedbackCount + summary.notHelpfulFeedbackCount;
  summary.negativeFeedbackCount = summary.notHelpfulFeedbackCount;
  summary.eventsByDay = summary.eventsByDay.map((day) => ({
    ...day,
    count: lastSevenDayCounts.get(day.date) ?? 0,
  }));
  summary.analyzeCompletedByCountry = toSortedBuckets(completedByCountry);
  summary.analyzeCompletedByNetworkIdentityCategory = toSortedBuckets(
    completedByNetworkIdentityCategory,
  );
  summary.analyzeCompletedByEvidenceQuality = toSortedBuckets(
    completedByEvidenceQuality,
  );
  summary.negativeFeedbackReasons = toSortedBuckets(negativeFeedbackReasons);

  return summary;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNullableRate(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value);
}

function isCountBuckets(value: unknown): value is AnalyticsCountBucket[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        isNonNegativeNumber(item.count),
    )
  );
}

function isDayBuckets(value: unknown): value is AnalyticsDayBucket[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        isNonNegativeNumber(item.count),
    )
  );
}

function isAnalyticsSummary(value: unknown): value is AnalyticsSummary {
  if (!isRecord(value)) {
    return false;
  }

  const countKeys = [
    "totalEvents",
    "analyzeStartedCount",
    "analyzeCompletedCount",
    "todayAnalyzeCompletedCount",
    "lastSevenDaysAnalyzeCompletedCount",
    "compareStartedCount",
    "helpfulFeedbackCount",
    "notHelpfulFeedbackCount",
    "feedbackVoteCount",
    "negativeFeedbackCount",
  ];

  return (
    countKeys.every((key) => isNonNegativeNumber(value[key])) &&
    isNullableRate(value.analyzeCompletionRate) &&
    isNullableRate(value.feedbackHelpfulRate) &&
    isDayBuckets(value.eventsByDay) &&
    isCountBuckets(value.analyzeCompletedByCountry) &&
    isCountBuckets(value.analyzeCompletedByNetworkIdentityCategory) &&
    isCountBuckets(value.analyzeCompletedByEvidenceQuality) &&
    isCountBuckets(value.negativeFeedbackReasons)
  );
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const client = getSupabaseClient();

  if (!client) {
    throw new AnalyticsSupabaseConfigurationError(
      getAnalyticsSupabaseEnvStatus(),
    );
  }

  const { data, error } = await client.rpc("get_analytics_summary");

  if (error) {
    if (isMissingAnalyticsSummaryRpcError(error)) {
      const rows = await getAnalyticsSummaryRows(client);

      return buildAnalyticsSummaryFromRows(rows);
    }

    throw error;
  }

  if (!isAnalyticsSummary(data)) {
    throw new AnalyticsEventValidationError();
  }

  return data;
}
