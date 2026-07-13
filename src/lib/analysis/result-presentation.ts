type ResultPresentationInput = {
  trustScore: {
    hasAnalysis: boolean;
  };
  qualityReport: {
    recommendationExplanation: string;
    summary: string;
    dataQuality: {
      level: string;
      reason: string;
    };
  };
};

export const LIMITED_EVIDENCE_WARNING =
  "Limited data was available, so this result should be treated as indicative.";

export function shouldShowLimitedEvidenceWarning(
  result: ResultPresentationInput,
) {
  return (
    result.trustScore.hasAnalysis &&
    result.qualityReport.dataQuality.level === "Low"
  );
}

export function getPublicResultSummary(result: ResultPresentationInput) {
  if (shouldShowLimitedEvidenceWarning(result)) {
    return null;
  }

  return stripDataQualityReason(
    result.qualityReport.summary,
    result.qualityReport.dataQuality,
  );
}

export function getPublicRecommendationExplanation(
  result: ResultPresentationInput,
) {
  return stripDataQualityReason(
    result.qualityReport.recommendationExplanation,
    result.qualityReport.dataQuality,
  );
}

export function getPublicDimensionDetail(detail: string) {
  return /\b(?:providers?|data sources?)\b.*\bunavailable\b/i.test(detail)
    ? null
    : detail;
}

function stripDataQualityReason(
  value: string,
  dataQuality: ResultPresentationInput["qualityReport"]["dataQuality"],
) {
  const providerAvailabilitySuffix = ` ${dataQuality.reason}`;

  if (
    dataQuality.level !== "High" &&
    dataQuality.reason &&
    value.endsWith(providerAvailabilitySuffix)
  ) {
    const publicValue = value
      .slice(0, -providerAvailabilitySuffix.length)
      .replace(
        /^Insufficient evidence for a high-confidence assessment\.\s*/,
        "",
      )
      .trim();

    return publicValue || null;
  }

  return value;
}
