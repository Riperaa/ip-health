import type { Metadata } from "next";
import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { IpAnalyzerContainer } from "@/components/ip-analyzer-container";
import { LanguageSwitcher } from "@/components/language-switcher";

const title = "IP Health – 检查 IP 声誉、网络身份和风险信号";
const description =
  "免费检查 IP 声誉、网络身份和风险信号，在注册、登录、支付、远程办公或业务操作前了解潜在风控风险。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/zh",
    languages: { en: "/", "zh-CN": "/zh" },
  },
  openGraph: {
    title,
    description,
    siteName: "IP Health",
    type: "website",
    url: "/zh",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function ChineseHome() {
  return (
    <main
      lang="zh-CN"
      className="flex min-h-dvh flex-col bg-white text-neutral-950"
    >
      <div className="fixed right-4 top-4 z-10 flex items-center gap-2 sm:right-8 sm:top-7">
        <LanguageSwitcher href="/" label="English" />
        <Link
          href="/zh/sponsor"
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          支持项目
        </Link>
      </div>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-20 pt-[calc(env(safe-area-inset-top)+7rem)] sm:px-8 sm:pb-24 sm:pt-[calc(env(safe-area-inset-top)+8rem)]">
        <div className="w-full max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl md:text-7xl">
            IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-neutral-600 sm:text-lg">
            IP Health 是一个用于检查 IP 声誉、网络身份和风险信号的免费工具。
            你可以在使用某个 IP 注册、登录、支付、远程办公或业务操作前，先了解它可能带来的风控风险。
          </p>

          <IpAnalyzerContainer locale="zh" />
        </div>
      </section>

      <FooterLinks />
    </main>
  );
}
