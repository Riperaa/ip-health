import type { NextRequest } from "next/server";

import { isIP } from "node:net";

const vercelClientIpHeader = "x-vercel-forwarded-for";
const localDevelopmentClientIpHeader = "x-forwarded-for";

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

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

function isPrivateOrReservedIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function getRequestIp(request: NextRequest | Request) {
  // Vercel rewrites this header at its proxy boundary. Gate the trust on the
  // Vercel runtime so a direct/self-hosted caller cannot mint the same identity.
  const header = isVercelRuntime()
    ? vercelClientIpHeader
    : process.env.NODE_ENV === "development"
      ? localDevelopmentClientIpHeader
      : null;
  const value = header ? request.headers.get(header) : null;

  if (!value) {
    return null;
  }

  const candidate = normalizeIpCandidate(value);

  return isIP(candidate) ? candidate : null;
}

export function getRequestRateLimitKey(request: NextRequest | Request) {
  return getRequestIp(request) ?? "unknown";
}

export function getRequestPublicIpv4(request: NextRequest | Request) {
  const ip = getRequestIp(request);

  return ip && isIP(ip) === 4 && !isPrivateOrReservedIpv4(ip) ? ip : null;
}

export function getRequestCountry(request: NextRequest | Request) {
  const country = isVercelRuntime()
    ? request.headers.get("x-vercel-ip-country")
    : null;
  const normalizedCountry = country?.trim().toUpperCase();

  return normalizedCountry && /^[A-Z]{2}$/.test(normalizedCountry)
    ? normalizedCountry
    : null;
}
