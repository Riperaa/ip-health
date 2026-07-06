import type { ProviderAnalysisResult } from "@/lib/analysis/types";

import { fetchAbuseIpDb } from "../fetch/abuse";
import { fetchCloudflareTrace } from "../fetch/cloudflare";
import { fetchDetectedIp, fetchIpifyPublicIp, fetchIpInfo } from "../fetch/ip";
import { fetchIpqs } from "../fetch/ipqs";
import { assertValidIpv4Address } from "../validation";

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

  assertValidIpv4Address(trimmedIpAddress);

  const [ipInfo, abuseIpDb, cloudflare, ipqs] = await Promise.all([
    fetchIpInfo(trimmedIpAddress),
    fetchAbuseIpDb(trimmedIpAddress),
    fetchCloudflareTrace(),
    fetchIpqs(trimmedIpAddress),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare,
    ipqs,
  };
}
