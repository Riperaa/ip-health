import type { Metadata } from "next";

import { createAdminSession } from "@/app/admin/login/actions";
import { isAdminAnalyticsConfigured } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in | IP Health",
  robots: { index: false, follow: false },
};

type AdminLoginPageProps = {
  searchParams?: Promise<{ error?: string | string[] }>;
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const isConfigured = isAdminAnalyticsConfigured();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8fb] px-5 py-12 text-neutral-950">
      <section className="surface-card w-full max-w-md rounded-3xl border bg-white p-6 sm:p-8">
        <p className="text-sm font-medium text-neutral-500">
          Internal dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Admin sign in</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Enter the analytics admin token. It is submitted by POST and is never
          added to the URL.
        </p>

        {!isConfigured || error === "unavailable" ? (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            Admin analytics is unavailable because the server token is not
            configured.
          </p>
        ) : (
          <form action={createAdminSession} className="mt-6">
            <label htmlFor="admin-token" className="text-sm font-semibold">
              Admin token
            </label>
            <input
              id="admin-token"
              name="token"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={error === "invalid"}
              aria-describedby={
                error === "invalid" ? "admin-token-error" : undefined
              }
              className="mt-2 h-12 w-full rounded-xl border border-neutral-200 px-4 outline-none focus:border-neutral-500"
            />
            {error === "invalid" ? (
              <p
                id="admin-token-error"
                role="alert"
                className="mt-2 text-sm text-red-700"
              >
                The admin token is invalid.
              </p>
            ) : null}
            <button
              type="submit"
              className="mt-5 h-12 w-full rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              Sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
