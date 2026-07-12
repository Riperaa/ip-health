import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  alternates: {
    canonical: "/sponsor",
    languages: { en: "/sponsor", "zh-CN": "/zh/sponsor" },
  },
};

const paymentOptions = [
  {
    name: "WeChat Pay",
    description:
      "Scan the QR code below to support IP Health with WeChat Pay.",
    image: "/sponsor/wechat-pay.png",
    width: 1077,
    height: 1461,
  },
  {
    name: "Alipay",
    description: "Scan the QR code below to support IP Health with Alipay.",
    image: "/sponsor/alipay.png",
    width: 1025,
    height: 1535,
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
      <div className="fixed right-4 top-4 z-10 sm:right-8 sm:top-7">
        <LanguageSwitcher href="/zh/sponsor" label="中文" />
      </div>

      <section className="mx-auto w-full max-w-4xl flex-1 px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-28">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            Support IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            IP Health is a free tool for checking IP reputation, network identity,
            and risk signals before using an IP for login, registration, payments,
            remote work, or business operations.
          </p>
        </header>

        <section className="mt-12 sm:mt-16" aria-labelledby="china-support">
          <h2
            id="china-support"
            className="text-center text-2xl font-semibold text-neutral-950"
          >
            China support
          </h2>

          <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
            {paymentOptions.map((option) => (
              <article
                key={option.name}
                className="surface-card rounded-[28px] border bg-white p-5 text-center sm:p-6"
              >
                <h3 className="text-xl font-semibold text-neutral-950">
                  {option.name}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                  {option.description}
                </p>
                <div className="mt-5 flex justify-center">
                  <Image
                    src={option.image}
                    alt={`${option.name} collection QR code`}
                    width={option.width}
                    height={option.height}
                    className="h-auto w-full max-w-[280px] rounded-2xl border border-neutral-200 bg-white"
                    sizes="(max-width: 767px) min(280px, calc(100vw - 80px)), 280px"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section
            className="rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-6"
            aria-labelledby="international-support"
          >
            <h2
              id="international-support"
              className="text-xl font-semibold text-neutral-950"
            >
              International support
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              International card payment is being prepared.
              <br />
              For manual payment options, contact{" "}
              <a
                href="mailto:contact@iphealth.app"
                className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-950"
              >
                contact@iphealth.app
              </a>
              .
            </p>
          </section>

          <section
            className="rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-6"
            aria-labelledby="important-note"
          >
            <h2
              id="important-note"
              className="text-xl font-semibold text-neutral-950"
            >
              Important note
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              Sponsorship is voluntary. It does not affect IP Health scores,
              analysis results, risk labels, recommendations, or data-source
              behavior.
            </p>
          </section>
        </div>
      </section>
      <FooterLinks />
    </main>
  );
}
