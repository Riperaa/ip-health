"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  isAdminAnalyticsConfigured,
  verifyAdminToken,
} from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/api-protection";

export async function createAdminSession(formData: FormData) {
  if (!isAdminAnalyticsConfigured()) {
    redirect("/admin/login?error=unavailable");
  }

  const requestHeaders = await headers();
  const rateLimit = checkRateLimit({
    request: new Request("https://iphealth.app/admin/login", {
      headers: requestHeaders,
    }),
    namespace: "admin:login",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    redirect("/admin/login?error=rate-limited");
  }

  const submittedToken = formData.get("token");

  if (typeof submittedToken !== "string" || !verifyAdminToken(submittedToken)) {
    redirect("/admin/login?error=invalid");
  }

  const sessionValue = createAdminSessionValue();

  if (!sessionValue) {
    redirect("/admin/login?error=unavailable");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin/analytics");
}
