import nodeAssert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import ts from "typescript";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function importTypeScriptModule(path) {
  const input = await source(path);
  const output = ts.transpileModule(input, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;

  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

function requestWithHeaders(headers) {
  return new Request("https://iphealth.app/api/detect-ip", { headers });
}

const requestIp = await importTypeScriptModule("src/lib/request-ip.ts");
const originalVercel = process.env.VERCEL;
const originalNodeEnv = process.env.NODE_ENV;

try {
  process.env.VERCEL = "1";
  process.env.NODE_ENV = "production";

  const trustedRequest = requestWithHeaders({
    "x-vercel-forwarded-for": "1.1.1.1",
    "x-forwarded-for": "198.51.100.10",
    "x-real-ip": "198.51.100.11",
    "cf-connecting-ip": "198.51.100.12",
    "true-client-ip": "198.51.100.13",
  });
  nodeAssert.equal(requestIp.getRequestIp(trustedRequest), "1.1.1.1");
  nodeAssert.equal(requestIp.getRequestRateLimitKey(trustedRequest), "1.1.1.1");
  nodeAssert.equal(requestIp.getRequestPublicIpv4(trustedRequest), "1.1.1.1");

  const spoofedRequestA = requestWithHeaders({
    "x-forwarded-for": "198.51.100.20",
    "x-real-ip": "198.51.100.21",
    "cf-connecting-ip": "198.51.100.22",
    "true-client-ip": "198.51.100.23",
  });
  const spoofedRequestB = requestWithHeaders({
    "x-forwarded-for": "203.0.113.20",
    "x-real-ip": "203.0.113.21",
    "cf-connecting-ip": "203.0.113.22",
    "true-client-ip": "203.0.113.23",
  });
  nodeAssert.equal(requestIp.getRequestIp(spoofedRequestA), null);
  nodeAssert.equal(requestIp.getRequestIp(spoofedRequestB), null);
  nodeAssert.equal(
    requestIp.getRequestRateLimitKey(spoofedRequestA),
    "unknown",
  );
  nodeAssert.equal(
    requestIp.getRequestRateLimitKey(spoofedRequestA),
    requestIp.getRequestRateLimitKey(spoofedRequestB),
    "Spoofed CDN headers must not select a different rate-limit bucket.",
  );

  const countryRequest = requestWithHeaders({
    "x-vercel-forwarded-for": "1.1.1.1",
    "x-vercel-ip-country": "AU",
    "cf-ipcountry": "US",
  });
  nodeAssert.equal(requestIp.getRequestCountry(countryRequest), "AU");
  nodeAssert.equal(
    requestIp.getRequestCountry(
      requestWithHeaders({
        "x-vercel-forwarded-for": "1.1.1.1",
        "cf-ipcountry": "US",
      }),
    ),
    null,
    "Caller-supplied Cloudflare country metadata must be ignored.",
  );
  nodeAssert.equal(
    requestIp.getRequestIp(
      requestWithHeaders({
        "x-vercel-forwarded-for": "not-an-ip",
        "cf-connecting-ip": "1.1.1.1",
      }),
    ),
    null,
    "An invalid trusted header must fail closed without falling back to spoofable headers.",
  );

  for (const ip of [
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.0.1",
    "224.0.0.1",
    "2001:4860:4860::8888",
  ]) {
    nodeAssert.equal(
      requestIp.getRequestPublicIpv4(
        requestWithHeaders({ "x-vercel-forwarded-for": ip }),
      ),
      null,
      `${ip} must not be returned as the detected public IPv4 address.`,
    );
  }

  delete process.env.VERCEL;
  process.env.NODE_ENV = "production";
  nodeAssert.equal(
    requestIp.getRequestIp(
      requestWithHeaders({
        "x-vercel-forwarded-for": "1.1.1.1",
        "x-forwarded-for": "8.8.8.8",
      }),
    ),
    null,
    "Self-hosted production must fail closed without a trusted proxy adapter.",
  );

  process.env.NODE_ENV = "development";
  nodeAssert.equal(
    requestIp.getRequestIp(
      requestWithHeaders({ "x-forwarded-for": "127.0.0.1" }),
    ),
    "127.0.0.1",
    "Local Next.js development should retain a usable direct-proxy fallback.",
  );
} finally {
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
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

const detectIpRoute = await source("src/app/api/detect-ip/route.ts");
assert(
  detectIpRoute.includes("getRequestPublicIpv4") &&
    !detectIpRoute.includes("cf-connecting-ip") &&
    !detectIpRoute.includes("true-client-ip"),
  "IP detection must use the trusted request-IP adapter.",
);

const apiProtection = await source("src/lib/api-protection.ts");
assert(
  apiProtection.includes("getRequestRateLimitKey"),
  "API rate limiting must use the trusted request identity.",
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
