import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";

type InfoPageProps = {
  title: string;
  children: React.ReactNode;
};

export function InfoPage({ title, children }: InfoPageProps) {
  return (
    <main className="flex min-h-dvh flex-col bg-white text-neutral-950">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] backdrop-blur transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-24 sm:px-8">
        <div className="w-full">
          <h1 className="text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            {title}
          </h1>
          <div className="mt-6 space-y-4 text-base leading-7 text-neutral-500 sm:text-lg">
            {children}
          </div>
        </div>
      </section>

      <FooterLinks />
    </main>
  );
}
