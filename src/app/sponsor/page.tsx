import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";

const repositoryUrl = "https://github.com/Riperaa/ip-health";

export default function SponsorPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-white text-neutral-950">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-20 sm:px-8">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            Support IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            IP Health is free to use. If it helped you evaluate an IP, consider
            supporting development.
          </p>

          <div className="surface-card mx-auto mt-10 w-full max-w-xl rounded-[28px] border bg-white p-5 text-left sm:p-6">
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-5">
              <h2 className="text-xl font-semibold text-neutral-950">
                Support IP Health
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                IP Health is free to use.
                <br />
                If it helped you evaluate an IP, consider supporting
                development.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-100 p-4">
                <h3 className="text-sm font-semibold text-neutral-950">
                  GitHub
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Star the project or contribute improvements.
                </p>
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                >
                  Open GitHub
                </a>
              </div>

              <div className="rounded-2xl border border-neutral-100 p-4">
                <h3 className="text-sm font-semibold text-neutral-950">
                  PayPal
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Direct sponsorship is being prepared.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 h-10 cursor-not-allowed rounded-full bg-neutral-100 px-5 text-sm font-semibold text-neutral-400 ring-1 ring-neutral-200"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            <p className="mt-5 text-center text-sm leading-6 text-neutral-400">
              Your support helps cover API and hosting costs.
            </p>
          </div>
        </div>
      </section>
      <FooterLinks />
    </main>
  );
}
