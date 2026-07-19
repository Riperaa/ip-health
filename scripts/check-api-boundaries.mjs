import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const browserProviderAnalysis = await source(
  "src/lib/analysis/compose/provider-analysis.ts",
);
assert(
  !browserProviderAnalysis.includes("fetchCloudflareTrace"),
  "Target-IP analysis must not mix in the current request's Cloudflare trace.",
);
assert(
  browserProviderAnalysis.includes("cloudflare: null"),
  "Cloudflare scoring input should stay unavailable until a target-bound signal exists.",
);

for (const route of [
  "src/app/analysis/final-decision-dump/route.ts",
  "src/app/analysis/presentation-snapshot/route.ts",
]) {
  const routeSource = await source(route);
  assert(
    routeSource.includes("fetchServerProviderAnalysis"),
    `${route} must use the server-only provider adapter.`,
  );
  assert(
    !routeSource.includes("fetchProviderAnalysis"),
    `${route} must not import the browser provider adapter.`,
  );
}

for (const provider of [
  "abuseipdb",
  "ipapi-is",
  "ipinfo",
  "ipqs",
  "scamalytics",
]) {
  const routeSource = await source(`src/app/api/${provider}/route.ts`);
  assert(
    routeSource.includes("enforceProviderRateLimit"),
    `${provider} route is missing rate limiting.`,
  );
  assert(
    routeSource.includes("getProviderCachedValue"),
    `${provider} route is missing provider-result caching.`,
  );
}

const cloudflareRoute = await source("src/app/api/cloudflare/route.ts");
assert(
  cloudflareRoute.includes("getRequestIp") &&
    !cloudflareRoute.includes("providers/cloudflare"),
  "Cloudflare route must describe the inbound client, not the server egress.",
);

const analyticsClient = await source("src/lib/analytics.ts");
const analyticsRoute = await source("src/app/api/analytics/route.ts");
assert(
  analyticsClient.includes("randomUUID"),
  "Analytics events must carry an idempotency key.",
);
assert(
  analyticsRoute.includes("registerIdempotencyKey") &&
    analyticsRoute.includes('namespace: "analytics"'),
  "Analytics ingestion must be rate limited and deduplicated.",
);

const adminLoginAction = await source("src/app/admin/login/actions.ts");
assert(
  adminLoginAction.includes('path: "/"'),
  "Admin session cookie must be available to the protected admin API.",
);

console.log("API boundary checks passed.");
