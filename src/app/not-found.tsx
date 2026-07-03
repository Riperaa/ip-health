import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#fbfbfa] text-neutral-950">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <h1 className="text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          Back to Home
        </Link>
      </section>

      <FooterLinks />
    </main>
  );
}
