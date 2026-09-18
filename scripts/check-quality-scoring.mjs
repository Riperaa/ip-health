import assert from "node:assert/strict";
import { loadTypeScript } from "./helpers/load-typescript.mjs";

const { buildAnalysisResult } = loadTypeScript(
  "src/lib/analysis/compose/build-analysis.ts",
);
const { buildConnectivityProbeResult } = loadTypeScript(
  "src/lib/analysis/connectivity/probe.ts",
);
const { getDisplayResult } = loadTypeScript(
  "src/lib/analysis/compose/compare.ts",
);
const { isInfrastructureUsage } = loadTypeScript(
  "src/lib/analysis/network-signals.ts",
);

const clean = {
  ipInfo: {
    ip: "1.1.1.1",
    country: "US",
    city: "New York",
    org: "AS123 Example ISP",
    asn: { asn: "AS123", name: "Example ISP", type: "isp" },
    company: { name: "Example ISP", type: "isp" },
    privacy: {},
  },
  abuseIpDb: {
    abuseConfidence: 0,
    usageType: "Fixed Line ISP",
    isp: "Example ISP",
  },
  scamalytics: { status: "available", score: 0 },
  ipApiIs: {
    status: "available",
    vpn: false,
    proxy: false,
    tor: false,
    hosting: false,
    datacenter: false,
  },
  cloudflare: null,
  ipqs: null,
};

export const scenarios = [
  ["clean", clean],
  [
    "missing providers",
    {
      ...clean,
      ipInfo: { ip: "1.1.1.1" },
      abuseIpDb: null,
      scamalytics: null,
      ipApiIs: null,
    },
  ],
  [
    "hosting",
    { ...clean, ipInfo: { ...clean.ipInfo, privacy: { hosting: true } } },
  ],
  [
    "Tor",
    {
      ...clean,
      ipInfo: { ...clean.ipInfo, privacy: { tor: true } },
      ipApiIs: { ...clean.ipApiIs, tor: true },
    },
  ],
  [
    "severe abuse",
    { ...clean, abuseIpDb: { ...clean.abuseIpDb, abuseConfidence: 95 } },
  ],
  [
    "restricted region",
    { ...clean, ipInfo: { ...clean.ipInfo, country: "CN" } },
  ],
];

const pending = buildAnalysisResult({ providerResult: null });
assert.equal(pending.qualityReport.overallScore, null);
assert.equal(pending.qualityReport.confidence, "Pending");

for (const [name, providerResult] of scenarios) {
  const single = buildAnalysisResult({ providerResult });
  const comparison = getDisplayResult({
    ...providerResult,
    input: providerResult.ipInfo.ip,
  });
  assert.equal(
    comparison.score,
    single.qualityReport.overallScore,
    `${name}: comparison and single analysis must use the same score`,
  );
  assert.equal(
    comparison.confidence,
    single.qualityReport.confidence,
    `${name}: confidence consistency`,
  );
  assert.equal(
    comparison.recommendation.label,
    single.trustScore.recommendationLabel,
    `${name}: recommendation consistency`,
  );
  for (const status of [
    null,
    "verified_reachable",
    "not_verified",
    "unreachable",
  ]) {
    const before = JSON.stringify(providerResult);
    const report = buildAnalysisResult({
      providerResult,
      connectivity: status ? buildConnectivityProbeResult(status) : null,
    });
    const quality = report.qualityReport;
    assert.equal(
      JSON.stringify(providerResult),
      before,
      `${name}: must not mutate provider data`,
    );
    const weighted = Object.entries(quality.dimensions).reduce(
      (total, [key, dimension]) => {
        assert.ok(
          Number.isFinite(dimension.score) &&
            dimension.score >= 0 &&
            dimension.score <= 100,
          `${name}: ${key} bounds`,
        );
        return total + dimension.score * quality.weights[key];
      },
      0,
    );
    assert.equal(
      quality.overallScore,
      Math.round(weighted),
      `${name}: weighted total`,
    );
    assert.equal(
      report.trustScore.value,
      quality.overallScore,
      `${name}: displayed score consistency`,
    );
  }
}

const qualityFor = (providerResult, status) =>
  buildAnalysisResult({
    providerResult,
    connectivity: buildConnectivityProbeResult(status),
  }).qualityReport;
assert.ok(
  qualityFor(clean, "verified_reachable").dimensions.compatibility.score >
    qualityFor(clean, "unreachable").dimensions.compatibility.score,
);
assert.ok(
  qualityFor(scenarios[4][1], "verified_reachable").dimensions.reputation
    .score <
    qualityFor(clean, "verified_reachable").dimensions.reputation.score,
);
assert.equal(qualityFor(scenarios[1][1], "not_verified").confidence, "Low");
assert.equal(
  getDisplayResult({
    ...clean,
    input: "1.1.1.1",
    scamalytics: { status: "available", score: 0, tor: true },
  }).hasSevereAbuseOrTor,
  true,
);
for (const usage of [
  "Datacenter",
  "Data Center",
  "Cloud",
  "Web Hosting",
  "Transit",
]) {
  assert.equal(
    isInfrastructureUsage(usage),
    true,
    `${usage}: infrastructure classification`,
  );
}
for (const usage of [null, "Fixed Line ISP", "Mobile ISP"])
  assert.equal(isInfrastructureUsage(usage), false);
console.log(
  "Quality scoring checks passed: real report pipeline, six scenarios, four connectivity states, weighted totals and immutable inputs.",
);
