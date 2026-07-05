import { isIP } from "node:net";

import { NextRequest, NextResponse } from "next/server";

const headerPriority = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "forwarded",
] as const;

function errorResponse() {
  return NextResponse.json(
    { error: "Unable to detect public IP" },
    { status: 400 },
  );
}

function stripPort(value: string) {
  if (value.startsWith("[") && value.includes("]")) {
    return value.slice(1, value.indexOf("]"));
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    return value.slice(0, value.lastIndexOf(":"));
  }

  return value;
}

function normalizeIpCandidate(value: string) {
  const trimmedValue = value.trim().replace(/^"|"$/g, "");
  const withoutPort = stripPort(trimmedValue);
  const withoutZone = withoutPort.includes("%")
    ? withoutPort.slice(0, withoutPort.indexOf("%"))
    : withoutPort;
  const withoutMappedPrefix = withoutZone.toLowerCase().startsWith("::ffff:")
    ? withoutZone.slice(7)
    : withoutZone;

  return withoutMappedPrefix.trim();
}

function isPrivateIpv4(ip: string) {
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

function isPrivateIpv6(ip: string) {
  const normalizedIp = ip.toLowerCase();

  return (
    normalizedIp === "::" ||
    normalizedIp === "::1" ||
    normalizedIp.startsWith("fc") ||
    normalizedIp.startsWith("fd") ||
    normalizedIp.startsWith("fe8") ||
    normalizedIp.startsWith("fe9") ||
    normalizedIp.startsWith("fea") ||
    normalizedIp.startsWith("feb")
  );
}

function isPublicIp(value: string) {
  const normalizedIp = normalizeIpCandidate(value);
  const ipVersion = isIP(normalizedIp);

  if (!ipVersion || normalizedIp.toLowerCase() === "unknown") {
    return false;
  }

  if (ipVersion === 4) {
    return !isPrivateIpv4(normalizedIp);
  }

  return !isPrivateIpv6(normalizedIp);
}

function getForwardedCandidates(value: string) {
  return value.split(",").flatMap((entry) =>
    entry
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.toLowerCase().startsWith("for="))
      .map((part) => part.slice(4)),
  );
}

function getHeaderCandidates(
  headerName: (typeof headerPriority)[number],
  value: string,
) {
  if (headerName === "forwarded") {
    return getForwardedCandidates(value);
  }

  if (headerName === "x-forwarded-for") {
    return value.split(",");
  }

  return [value];
}

function detectPublicIp(request: NextRequest) {
  for (const headerName of headerPriority) {
    const headerValue = request.headers.get(headerName);

    if (!headerValue) {
      continue;
    }

    for (const candidate of getHeaderCandidates(headerName, headerValue)) {
      const normalizedIp = normalizeIpCandidate(candidate);

      if (isPublicIp(normalizedIp)) {
        return normalizedIp;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const ip = detectPublicIp(request);

  if (!ip) {
    return errorResponse();
  }

  return NextResponse.json({ ip });
}
