"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  isAdminAnalyticsConfigured,
  verifyAdminToken,
} from "@/lib/admin-auth";

export async function createAdminSession(formData: FormData) {
  if (!isAdminAnalyticsConfigured()) {
    redirect("/admin/login?error=unavailable");
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
    path: "/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin/analytics");
}
