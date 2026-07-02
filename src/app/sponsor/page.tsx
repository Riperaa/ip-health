import Link from "next/link";

const repositoryUrl = "https://github.com/Riperaa/ip-health";

export default function SponsorPage() {
  return (
    <main className="min-h-dvh bg-white text-neutral-950">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] backdrop-blur transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>

      <section className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center justify-center px-5 py-24 sm:px-8">
        <div className="w-full max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-400">
            Sponsor
          </p>
          <h1 className="mt-3 text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl md:text-7xl">
            IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            Support the development of IP Health.
          </p>

          <div className="mx-auto mt-10 flex w-full max-w-xl flex-col gap-3 text-left">
            <a
              href={repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_12px_50px_rgba(0,0,0,0.08)] transition hover:border-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                GitHub repository
              </p>
              <p className="mt-2 break-words text-base font-medium text-neutral-950">
                {repositoryUrl}
              </p>
            </a>

            <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-950/[0.03]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-neutral-400">
                    PayPal
                  </p>
                  <p className="mt-2 text-base font-medium text-neutral-950">
                    Coming soon
                  </p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-600 ring-1 ring-neutral-200">
                  Coming soon
                </span>
              </div>
            </div>

            <p className="text-center text-sm leading-6 text-neutral-400">
              Your support helps cover API and hosting costs.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
