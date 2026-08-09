import assert from "node:assert/strict";
import fs from "node:fs";

import ts from "typescript";

const probeSource = fs.readFileSync(
  "src/lib/analysis/connectivity/probe.ts",
  "utf8",
);
const buildAnalysisSource = fs.readFileSync(
  "src/lib/analysis/compose/build-analysis.ts",
  "utf8",
);
const analyzerContainerSource = fs.readFileSync(
  "src/components/ip-analyzer-container.tsx",
  "utf8",
);
const comparisonSource = fs.readFileSync(
  "src/lib/analysis/compose/compare.ts",
  "utf8",
);
const probeCompiled = ts.transpileModule(probeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { isConnectivityProbeBoundToTarget, probeConnectivityForTarget } =
  await import(
    `data:text/javascript;base64,${Buffer.from(probeCompiled).toString("base64")}`
  );

const reachableResult = {
  google: { status: "verified_reachable", method: "cors-fetch" },
  youtube: { status: "verified_reachable", method: "cors-fetch" },
  openai: { status: "verified_reachable", method: "cors-fetch" },
};

async function evaluateBinding(targetIp, currentPublicIp) {
  let probeCalls = 0;
  const result = await probeConnectivityForTarget(
    targetIp,
    currentPublicIp,
    async () => {
      probeCalls += 1;
      return reachableResult;
    },
  );

  return { probeCalls, result };
}

assert.equal(
  isConnectivityProbeBoundToTarget("203.0.113.8", "203.0.113.8"),
  true,
  "A confirmed current-IP target should be eligible for browser probes.",
);
assert.equal(
  isConnectivityProbeBoundToTarget("203.0.113.008", "203.0.113.8"),
  true,
  "Equivalent valid IPv4 spellings should bind to the same target.",
);
assert.equal(
  isConnectivityProbeBoundToTarget("203.0.113.8", "not-an-ip"),
  false,
  "An invalid detection must never authorize browser probes.",
);

const matchingTarget = await evaluateBinding("203.0.113.8", "203.0.113.8");
assert.equal(matchingTarget.probeCalls, 1);
assert.deepEqual(matchingTarget.result, reachableResult);

for (const currentPublicIp of [null, undefined, "198.51.100.9"]) {
  const unboundTarget = await evaluateBinding("203.0.113.8", currentPublicIp);

  assert.equal(
    unboundTarget.probeCalls,
    0,
    "Unknown or different current IP must not run browser probes.",
  );
  assert.equal(
    unboundTarget.result,
    null,
    "Unknown or different current IP must keep connectivity unavailable.",
  );
}

const currentIpHistoryEntry = await evaluateBinding(
  "203.0.113.8",
  "203.0.113.8",
);
const otherHistoryEntry = await evaluateBinding("198.51.100.9", "203.0.113.8");
assert.equal(currentIpHistoryEntry.probeCalls, 1);
assert.equal(otherHistoryEntry.probeCalls, 0);
assert.equal(otherHistoryEntry.result, null);

let detectedPublicIp = null;
const currentIpAtAnalysisStart = detectedPublicIp;
detectedPublicIp = "203.0.113.8";
const analysisStartedBeforeDetection = await evaluateBinding(
  "203.0.113.8",
  currentIpAtAnalysisStart,
);
assert.equal(
  analysisStartedBeforeDetection.probeCalls,
  0,
  "A detection that finishes after analysis starts must not retroactively bind its probes.",
);
assert.equal(analysisStartedBeforeDetection.result, null);

assert.match(
  buildAnalysisSource,
  /probeConnectivityForTarget\(trimmedIpAddress, options\?\.detectedPublicIp\)/,
  "The analysis pipeline must use the target-bound probe result.",
);
assert.match(
  analyzerContainerSource,
  /detectedPublicIp: detectedPublicIpRef\.current/,
  "The main analyzer must pass only the separately detected public IP.",
);
assert.doesNotMatch(
  comparisonSource,
  /probeConnectivity(?:ForTarget)?\(/,
  "IP comparison must remain independent of the current browser connection.",
);

console.log(
  "Connectivity target-binding checks passed (matching, manual target, history, invalid detection, and detection-race behavior).",
);
