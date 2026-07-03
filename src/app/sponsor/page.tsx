import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";

const repositoryUrl = "https://github.com/Riperaa/ip-health";

export default function SponsorPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#fbfbfa] text-neutral-950">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] backdrop-blur transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-20 sm:px-8">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            Support IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            If IP Health has been useful to you, consider supporting its
            development.
          </p>

          <div className="mx-auto mt-10 grid w-full max-w-xl gap-3 text-left sm:grid-cols-2">
            <div className="surface-card flex min-h-48 flex-col rounded-[28px] border bg-white p-5">
              <h2 className="text-lg font-semibold text-neutral-950">GitHub</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Star the project or contribute.
              </p>
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex h-11 items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              >
                Open GitHub →
              </a>
            </div>

            <div className="surface-card flex min-h-48 flex-col rounded-[28px] border bg-white p-5">
              <h2 className="text-lg font-semibold text-neutral-950">PayPal</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                PayPal verification is currently in progress.
              </p>
              <button
                type="button"
                disabled
                className="mt-auto h-11 cursor-not-allowed rounded-full bg-neutral-100 px-5 text-sm font-semibold text-neutral-400 ring-1 ring-neutral-200"
              >
                Coming Soon
              </button>
            </div>

            <p className="text-center text-sm leading-6 text-neutral-400 sm:col-span-2">
              Your support helps cover API and hosting costs.
            </p>
          </div>
        </div>
      </section>
      <FooterLinks />
    </main>
  );
}
