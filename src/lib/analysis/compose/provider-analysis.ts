import type { ProviderAnalysisResult } from "@/lib/analysis/types";

import { fetchAbuseIpDb } from "../fetch/abuse";
import { fetchCloudflareTrace } from "../fetch/cloudflare";
import { fetchDetectedIp, fetchIpifyPublicIp, fetchIpInfo } from "../fetch/ip";

export async function detectPublicIp(): Promise<string> {
  const [detectedIp, cloudflare] = await Promise.all([
    fetchDetectedIp(),
    fetchCloudflareTrace(),
  ]);
  const mergedIp = detectedIp ?? cloudflare?.ip?.trim() ?? null;

  if (mergedIp) {
    return mergedIp;
  }

  return fetchIpifyPublicIp();
}

export async function fetchProviderAnalysis(
  nextIpAddress: string,
): Promise<ProviderAnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  const [ipInfo, abuseIpDb, cloudflare] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
    fetchCloudflareTrace(),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare,
    ipqs: null,
  };
}
