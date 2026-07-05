import type { IpInfoResponse } from "@/lib/analysis/types";

import { normalizeIpInfo } from "../normalize/providers";

export async function fetchIpInfo(nextIpAddress?: string) {
  const url = new URL("/api/ipinfo", window.location.origin);

  if (nextIpAddress) {
    url.searchParams.set("ip", nextIpAddress);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to fetch IP information.");
  }

  const data = (await response.json()) as IpInfoResponse;

  if (!data) {
    throw new Error("IP information was unavailable.");
  }

  return normalizeIpInfo(data, nextIpAddress);
}

export async function fetchDetectedIp() {
  try {
    const response = await fetch("/api/detect-ip");

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { ip?: string | null };
    const ip = data.ip?.trim();

    return ip || null;
  } catch {
    return null;
  }
}

export async function fetchIpifyPublicIp() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error("Missing IP address.");
  }

  const data = (await response.json()) as { ip?: string | null };
  const ip = data.ip?.trim();

  if (!ip) {
    throw new Error("Missing IP address.");
  }

  return ip;
}
