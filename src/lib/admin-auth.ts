import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ip_health_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const SESSION_CONTEXT = "ip-health-admin-analytics-session-v1";

export function getAdminAnalyticsToken() {
  return process.env.ADMIN_ANALYTICS_TOKEN?.trim() || null;
}

export function isAdminAnalyticsConfigured() {
  return getAdminAnalyticsToken() !== null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function createSessionValue(adminToken: string) {
  return createHmac("sha256", adminToken).update(SESSION_CONTEXT).digest("hex");
}

export function verifyAdminToken(candidate: string | null | undefined) {
  const adminToken = getAdminAnalyticsToken();

  return Boolean(adminToken && candidate && safeEqual(candidate, adminToken));
}

export function verifyAdminSession(candidate: string | null | undefined) {
  const adminToken = getAdminAnalyticsToken();

  return Boolean(
    adminToken &&
    candidate &&
    safeEqual(candidate, createSessionValue(adminToken)),
  );
}

export function createAdminSessionValue() {
  const adminToken = getAdminAnalyticsToken();

  return adminToken ? createSessionValue(adminToken) : null;
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());

  return match?.[1]?.trim() || null;
}

export function isAdminRequestAuthorized({
  authorizationHeader,
  sessionCookie,
}: {
  authorizationHeader?: string | null;
  sessionCookie?: string | null;
}) {
  return (
    verifyAdminToken(getBearerToken(authorizationHeader ?? null)) ||
    verifyAdminSession(sessionCookie)
  );
}
