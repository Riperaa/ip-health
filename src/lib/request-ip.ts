import type { NextRequest } from "next/server";

import { isIP } from "node:net";

const trustedClientIpHeaders = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
] as const;

function normalizeIpCandidate(value: string) {
  const firstValue = value.split(",", 1)[0]?.trim().replace(/^"|"$/g, "") ?? "";
  const withoutBrackets =
    firstValue.startsWith("[") && firstValue.includes("]")
      ? firstValue.slice(1, firstValue.indexOf("]"))
      : firstValue;
  const withoutIpv4Port = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(withoutBrackets)
    ? withoutBrackets.slice(0, withoutBrackets.lastIndexOf(":"))
    : withoutBrackets;
  const withoutZone = withoutIpv4Port.split("%", 1)[0] ?? "";

  return withoutZone.toLowerCase().startsWith("::ffff:")
    ? withoutZone.slice(7)
    : withoutZone;
}

export function getRequestIp(request: NextRequest | Request) {
  for (const header of trustedClientIpHeaders) {
    const value = request.headers.get(header);

    if (!value) {
      continue;
    }

    const candidate = normalizeIpCandidate(value);

    if (isIP(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getRequestCountry(request: NextRequest | Request) {
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country");
  const normalizedCountry = country?.trim().toUpperCase();

  return normalizedCountry && /^[A-Z]{2}$/.test(normalizedCountry)
    ? normalizedCountry
    : null;
}

export function getCloudflareColo(request: NextRequest | Request) {
  const ray = request.headers.get("cf-ray")?.trim();
  const separatorIndex = ray?.lastIndexOf("-") ?? -1;
  const colo = separatorIndex >= 0 ? ray?.slice(separatorIndex + 1) : null;

  return colo && /^[A-Z0-9]{3}$/.test(colo.toUpperCase())
    ? colo.toUpperCase()
    : null;
}
