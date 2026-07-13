import Link from "next/link";

import type { Locale } from "@/lib/localization";

const guides = {
  en: [
    { href: "/is-my-ip-clean", label: "Is My IP Clean?" },
    { href: "/vpn-ip-check", label: "VPN IP Check" },
    { href: "/why-is-my-ip-risky", label: "Why Is My IP Risky?" },
    { href: "/methodology", label: "How IP Health Works" },
  ],
  zh: [
    { href: "/zh/is-my-ip-clean", label: "我的 IP 干净吗？" },
    { href: "/zh/vpn-ip-check", label: "VPN IP 风险检测" },
    {
      href: "/zh/why-is-my-ip-risky",
      label: "为什么我的 IP 被判定为高风险？",
    },
    { href: "/zh/methodology", label: "IP Health 的评分方法" },
  ],
} satisfies Record<Locale, Array<{ href: string; label: string }>>;

export function GuideLinks({ locale = "en" }: { locale?: Locale }) {
  return (
    <section
      aria-labelledby={`guides-${locale}`}
      className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-8 sm:pb-20"
    >
      <div className="border-t border-slate-200 pt-8 text-center">
        <h2
          id={`guides-${locale}`}
          className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-400"
        >
          {locale === "zh" ? "指南" : "Guides"}
        </h2>
        <nav
          aria-label={locale === "zh" ? "IP 风险指南" : "IP risk guides"}
          className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3"
        >
          {guides[locale].map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="text-sm font-medium text-neutral-600 underline decoration-slate-300 underline-offset-4 transition hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              {guide.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
