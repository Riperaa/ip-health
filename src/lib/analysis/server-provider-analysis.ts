import "server-only";

import { getCachedValue, setCachedValue } from "@/lib/api-protection";
import { lookup as lookupAbuseIpDb } from "@/lib/providers/abuseipdb";
import { lookup as lookupIpApiIs } from "@/lib/providers/ipapi-is";
import { lookupWithStatus as lookupIpInfo } from "@/lib/providers/ipinfo";
import { lookup as lookupIpqs } from "@/lib/providers/ipqs";
import { lookup as lookupScamalytics } from "@/lib/providers/scamalytics";

import type { ProviderAnalysisResult } from "./types";
import { assertValidIpv4Address } from "./validation";

const SERVER_ANALYSIS_CACHE_TTL_MS = 300_000;

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

export async function fetchServerProviderAnalysis(
  ipAddress: string,
): Promise<ProviderAnalysisResult> {
  const ip = ipAddress.trim();
  assertValidIpv4Address(ip);

  const cached = getCachedValue<ProviderAnalysisResult>("analysis", ip);

  if (cached) {
    return cached;
  }

  const [
    ipInfoResult,
    abuseResult,
    ipqsResult,
    scamalyticsResult,
    ipApiIsResult,
  ] = await Promise.allSettled([
    lookupIpInfo(ip),
    lookupAbuseIpDb(ip),
    lookupIpqs(ip),
    lookupScamalytics(ip),
    lookupIpApiIs(ip),
  ]);
  const ipInfoLookup = fulfilledValue(ipInfoResult, {
    data: { ip },
    status: 502,
  });
  const result: ProviderAnalysisResult = {
    ipInfo:
      ipInfoLookup.status >= 200 && ipInfoLookup.status < 300
        ? ipInfoLookup.data
        : { ip },
    abuseIpDb: fulfilledValue(abuseResult, null),
    cloudflare: null,
    ipqs: fulfilledValue(ipqsResult, null),
    scamalytics: fulfilledValue(scamalyticsResult, null),
    ipApiIs: fulfilledValue(ipApiIsResult, null),
  };

  setCachedValue("analysis", ip, result, SERVER_ANALYSIS_CACHE_TTL_MS);

  return result;
}
