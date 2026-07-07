import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";

const supportOptions = [
  {
    name: "WeChat Pay",
    status: "Coming soon",
  },
  {
    name: "Alipay",
    status: "Coming soon",
  },
  {
    name: "International support",
    status: "Planned",
  },
];

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
            Support options are being prepared.
            <br />
            WeChat Pay and Alipay will be available soon.
          </p>

          <div className="surface-card mx-auto mt-10 w-full max-w-xl rounded-[28px] border bg-white p-5 text-left sm:p-6">
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 p-5 text-center">
              <h2 className="text-xl font-semibold text-neutral-950">
                Support options are being prepared.
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                WeChat Pay and Alipay will be available soon.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {supportOptions.map((option) => (
                <div
                  key={option.name}
                  className="rounded-2xl border border-neutral-100 p-4 text-center"
                >
                  <h3 className="text-sm font-semibold text-neutral-950">
                    {option.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {option.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <FooterLinks />
    </main>
  );
}
