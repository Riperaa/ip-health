export type RegionRiskLevel = "low" | "medium" | "high" | "unknown";

export type RegionServiceStatus =
  | "good"
  | "caution"
  | "restricted"
  | "high risk"
  | "unknown";

type RegionIpInfo = {
  country?: string | null;
};

const CN_HIGH_RISK_SERVICES = new Set(["google voice"]);

const CN_RESTRICTED_SERVICES = new Set([
  "youtube",
  "google",
  "google account",
  "gmail",
  "google play",
  "google cloud",
  "facebook",
  "instagram",
  "x",
]);

const CN_CAUTION_SERVICES = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "wikipedia",
  "reddit",
]);

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function detectRegionFromIpInfo(ipInfo: RegionIpInfo) {
  const country = normalizeValue(ipInfo.country);

  if (!country) {
    return null;
  }

  if (country === "cn" || country === "chn" || country === "china") {
    return "CN";
  }

  return country.toUpperCase();
}

export function getRegionRiskLevel(
  region: string | null | undefined,
  vpnStatus: boolean,
): RegionRiskLevel {
  const normalizedRegion = normalizeValue(region).toUpperCase();

  if (!normalizedRegion) {
    return "unknown";
  }

  if (normalizedRegion === "CN") {
    return vpnStatus ? "medium" : "high";
  }

  return "low";
}

export function getRegionServiceStatus(
  service: string,
  region: string | null | undefined,
  vpnStatus: boolean,
): RegionServiceStatus {
  const normalizedRegion = normalizeValue(region).toUpperCase();
  const normalizedService = normalizeValue(service);

  if (!normalizedRegion) {
    return "unknown";
  }

  if (normalizedRegion !== "CN") {
    return "good";
  }

  if (CN_HIGH_RISK_SERVICES.has(normalizedService)) {
    return vpnStatus ? "caution" : "high risk";
  }

  if (CN_RESTRICTED_SERVICES.has(normalizedService)) {
    return vpnStatus ? "caution" : "restricted";
  }

  if (CN_CAUTION_SERVICES.has(normalizedService)) {
    return "caution";
  }

  return "good";
}
