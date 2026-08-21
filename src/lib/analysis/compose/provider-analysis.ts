import type {
  AnalysisProgressOptions,
  AnalysisProgressStepId,
  ProviderAnalysisResult,
} from "@/lib/analysis/types";

import { fetchAbuseIpDb } from "../fetch/abuse";
import { fetchDetectedIp, fetchIpifyPublicIp, fetchIpInfo } from "../fetch/ip";
import { fetchIpApiIs } from "../fetch/ipapi-is";
import { fetchScamalytics } from "../fetch/scamalytics";
import { assertValidIpv4Address } from "../validation";

export async function detectPublicIp(): Promise<string> {
  const detectedIp = await fetchDetectedIp();

  if (detectedIp) {
    return detectedIp;
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

  const [ipInfo, abuseIpDb, scamalytics, ipApiIs] = await Promise.all([
    trackProviderRequest("ipinfo", fetchIpInfo(trimmedIpAddress), options),
    trackProviderRequest(
      "abuseipdb",
      fetchAbuseIpDb(trimmedIpAddress),
      options,
    ),
    trackProviderRequest(
      "scamalytics",
      fetchScamalytics(trimmedIpAddress),
      options,
    ),
    trackProviderRequest("ipapi_is", fetchIpApiIs(trimmedIpAddress), options),
  ]);

  return {
    ipInfo,
    abuseIpDb,
    cloudflare: null,
    ipqs: null,
    scamalytics,
    ipApiIs,
  };
}
