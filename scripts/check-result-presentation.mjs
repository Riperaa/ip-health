import fs from "node:fs";
import ts from "typescript";

const helperSource = fs.readFileSync(
  "src/lib/analysis/result-presentation.ts",
  "utf8",
);
const helperCompiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  getPublicDimensionDetail,
  getPublicRecommendationExplanation,
  getPublicResultSummary,
  LIMITED_EVIDENCE_WARNING,
  shouldShowLimitedEvidenceWarning,
} = await import(
  `data:text/javascript;base64,${Buffer.from(helperCompiled).toString("base64")}`
);

function makeResult({ level, reason, summary }) {
  return {
    trustScore: {
      hasAnalysis: true,
      value: 88,
    },
    qualityReport: {
      overallScore: 88,
      recommendationExplanation: summary,
      summary,
      dataQuality: { level, reason },
    },
    finalDecision: {
      decision: {
        overallVerdict: "Healthy",
      },
    },
  };
}

const adequateResult = makeResult({
  level: "High",
  reason: "All expected evidence was available.",
  summary: "Clean IP with strong compatibility.",
});
const unavailableIpqsOnlyResult = makeResult({
  level: "Medium",
  reason: "Scamalytics was available.",
  summary: "Clean IP with strong compatibility. Scamalytics was available.",
});
const limitedResult = makeResult({
  level: "Low",
  reason: "Important data sources were unavailable.",
  summary:
    "Insufficient evidence for a high-confidence assessment. Important data sources were unavailable.",
});

const unchangedResultSnapshot = JSON.stringify(unavailableIpqsOnlyResult);
const publicSummary = getPublicResultSummary(unavailableIpqsOnlyResult);
const componentSource = fs.readFileSync(
  "src/components/ip-analyzer.tsx",
  "utf8",
);
const localizationSource = fs.readFileSync("src/lib/localization.ts", "utf8");

const failures = [
  shouldShowLimitedEvidenceWarning(adequateResult)
    ? "Adequate evidence triggered the limited-data warning"
    : null,
  shouldShowLimitedEvidenceWarning(unavailableIpqsOnlyResult)
    ? "Unavailable IPQS alone triggered the limited-data warning"
    : null,
  shouldShowLimitedEvidenceWarning(limitedResult)
    ? null
    : "Materially limited evidence did not trigger the warning",
  getPublicResultSummary(limitedResult) === null
    ? null
    : "Provider-oriented low-evidence summary remained visible",
  publicSummary === "Clean IP with strong compatibility."
    ? null
    : `Provider availability remained in public summary: ${publicSummary}`,
  getPublicRecommendationExplanation(unavailableIpqsOnlyResult) ===
  "Clean IP with strong compatibility."
    ? null
    : "Provider availability remained in the recommendation",
  getPublicRecommendationExplanation(limitedResult) === null
    ? null
    : "Low-evidence provider availability remained in the recommendation",
  getPublicDimensionDetail(
    "Important reputation providers were unavailable.",
  ) === null
    ? null
    : "Provider availability remained in dimension details",
  getPublicDimensionDetail(
    "Abuse history or reputation provider data raised a strong signal.",
  ) === "Abuse history or reputation provider data raised a strong signal."
    ? null
    : "A genuine provider risk finding was removed",
  JSON.stringify(unavailableIpqsOnlyResult) === unchangedResultSnapshot
    ? null
    : "Presentation helpers mutated score or classification data",
  LIMITED_EVIDENCE_WARNING ===
  "Limited data was available, so this result should be treated as indicative."
    ? null
    : "English limited-data warning changed",
  localizationSource.includes("部分数据不足，本次结果仅供参考。")
    ? null
    : "Chinese limited-data warning is missing",
  componentSource.includes('t("Evidence Quality")')
    ? "English Evidence Quality card remains in the result UI"
    : null,
  localizationSource.includes('"Evidence Quality": "证据质量"')
    ? "Chinese Evidence Quality card localization remains"
    : null,
  componentSource.includes("providerStatuses") ||
  componentSource.includes("{provider.label} {t(provider.value)}")
    ? "Provider availability pills remain in the result UI"
    : null,
].filter(Boolean);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  "Result presentation checks passed (localized card removal, provider-status removal, limited-data threshold, and non-mutating score/classification coverage).",
);
