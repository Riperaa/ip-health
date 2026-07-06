import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { IpAnalyzerContainer } from "@/components/ip-analyzer-container";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-white text-neutral-950">
      <Link
        href="/sponsor"
        className="fixed right-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:right-8 sm:top-7"
      >
        Sponsor
      </Link>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-20 pt-[calc(env(safe-area-inset-top)+7rem)] sm:px-8 sm:pb-24 sm:pt-[calc(env(safe-area-inset-top)+8rem)]">
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl md:text-7xl">
            IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-neutral-600 sm:text-lg">
            Know whether you can trust this IP in 5 seconds.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-6 text-neutral-500 sm:text-base">
            Check IP reputation and risk signals before logging in.
          </p>

          <IpAnalyzerContainer />
        </div>
      </section>

      <FooterLinks />
    </main>
  );
}
