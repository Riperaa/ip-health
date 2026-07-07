import type {
  AnalysisProgressOptions,
  AnalysisProgressStepId,
  ProviderAnalysisResult,
} from "@/lib/analysis/types";

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

async function trackProviderRequest<T>(
  step: AnalysisProgressStepId,
  request: Promise<T>,
  options?: AnalysisProgressOptions,
): Promise<T> {
  options?.onProgress?.({ step, status: "running" });

  try {
    const result = await request;
    options?.onProgress?.({ step, status: "completed" });

    return result;
  } catch (error) {
    options?.onProgress?.({ step, status: "error" });
    throw error;
  }
}

export async function fetchProviderAnalysis(
  nextIpAddress: string,
  options?: AnalysisProgressOptions,
): Promise<ProviderAnalysisResult> {
  const trimmedIpAddress = nextIpAddress.trim();

  if (!trimmedIpAddress) {
    throw new Error("Missing IP address.");
  }

  assertValidIpv4Address(trimmedIpAddress);

  const [ipInfo, abuseIpDb, cloudflare, ipqs] = await Promise.all([
    trackProviderRequest("ipinfo", fetchIpInfo(trimmedIpAddress), options),
    trackProviderRequest(
      "abuseipdb",
      fetchAbuseIpDb(trimmedIpAddress),
      options,
    ),
    trackProviderRequest("cloudflare", fetchCloudflareTrace(), options),
    trackProviderRequest("ipqs", fetchIpqs(trimmedIpAddress), options),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare,
    ipqs,
  };
}
