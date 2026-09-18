/** Shared usage classification for legacy scores, quality reports and comparisons. */
export function isInfrastructureUsage(usageType?: string | null) {
  const normalized = usageType?.trim().toLowerCase() ?? "";
  return [
    "data center",
    "datacenter",
    "web hosting",
    "transit",
    "hosting",
    "infrastructure",
    "cloud",
  ].some((keyword) => normalized.includes(keyword));
}
