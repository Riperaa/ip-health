import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import ts from "typescript";

const root = new URL("../", import.meta.url);

async function importTypeScriptModule(path) {
  const input = await readFile(new URL(path, root), "utf8");
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

const decisionEngine = await importTypeScriptModule(
  "src/lib/analysis/core/final-decision-engine.ts",
);
const validation = await importTypeScriptModule(
  "src/lib/analysis/validation.ts",
);

const allReachable = {
  google: true,
  youtube: true,
  openai: true,
};

const healthy = decisionEngine.runFinalDecisionEngine({
  connectivity: allReachable,
});

for (const service of Object.values(healthy)) {
  assert.equal(service.status, "Available");
  assert.equal(service.overallVerdict, "Healthy");
  assert.equal(service.trustScore, 100);
  assert.equal(service.confidence, 100);
}

assert.equal(
  decisionEngine.computeTrustScore({
    ipqs: { fraud_score: 80 },
    ipinfo: { hosting: true },
  }),
  47,
  "An elevated fraud score and hosting signal should stack their penalties.",
);

const severeFraud = decisionEngine.runFinalDecisionEngine({
  connectivity: allReachable,
  ipqs: { fraud_score: 90 },
});

for (const service of Object.values(severeFraud)) {
  assert.equal(service.status, "Restricted");
  assert.equal(service.overallVerdict, "Risky");
  assert.equal(service.trustScore, 35);
}

const mixedConnectivity = decisionEngine.runFinalDecisionEngine({
  connectivity: { ...allReachable, youtube: false },
  region: { restricted: true, confidence: 80 },
});

assert.equal(mixedConnectivity.youtube.status, "Unavailable");
assert.equal(mixedConnectivity.google.status, "Restricted");
assert.equal(mixedConnectivity.openai.status, "Restricted");
assert.equal(mixedConnectivity.google.overallVerdict, "Use with Caution");
assert.equal(mixedConnectivity.google.confidence, 76);

assert.equal(
  decisionEngine.computeTrustScore({ ipqs: { fraud_score: Number.NaN } }),
  100,
  "Non-finite provider scores must be ignored.",
);
assert.equal(
  decisionEngine.computeTrustScore({ ipqs: { fraud_score: 500 } }),
  35,
  "Out-of-range provider scores must be clamped before applying rules.",
);

for (const ip of ["1.1.1.1", "0.0.0.0", "255.255.255.255", "001.2.3.4"]) {
  assert.equal(
    validation.isValidIpv4Address(ip),
    true,
    `${ip} should be valid`,
  );
}

for (const ip of [
  "",
  "1.1.1",
  "1.1.1.256",
  "1.1.1.-1",
  "1.1.1.1:443",
  "2001:4860:4860::8888",
]) {
  assert.equal(
    validation.isValidIpv4Address(ip),
    false,
    `${ip || "empty input"} should be invalid`,
  );
}

console.log(
  "Core scoring checks passed (healthy, connectivity, fraud, hosting, region, normalization, and IPv4 boundaries).",
);
