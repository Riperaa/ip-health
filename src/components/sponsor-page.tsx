"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { FooterLinks } from "@/components/footer-links";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/localization";

type SponsorCopy = {
  lang?: "zh-CN";
  homeHref: string;
  languageHref: string;
  languageLabel: string;
  title: string;
  intro: string;
  costExplanation: string;
  usageTitle: string;
  usageItems: string[];
  paymentTitle: string;
  paymentOptions: Array<{
    id: "wechat" | "alipay";
    name: string;
    description: string;
    image: string;
    width: number;
    height: number;
    imageAlt: string;
  }>;
  showQr: string;
  hideQr: string;
  recipientTitle: string;
  recipientText: string;
  voluntaryText: string;
  principlesTitle: string;
  principleItems: string[];
  internationalTitle: string;
  internationalText: string;
  internationalContact: string;
  noteTitle: string;
  noteText: string;
};

const sponsorCopy: Record<Locale, SponsorCopy> = {
  en: {
    homeHref: "/",
    languageHref: "/zh/sponsor",
    languageLabel: "中文",
    title: "Support IP Health",
    intro:
      "IP Health is a free, independently maintained tool for reviewing IP reputation, network identity, and risk signals.",
    costExplanation:
      "Sponsorship helps cover data-provider, hosting, database, and ongoing maintenance costs.",
    usageTitle: "How support is used",
    usageItems: [
      "Data-provider and API costs",
      "Hosting and database services",
      "Maintenance and reliability improvements",
      "Localization and accessibility work",
    ],
    paymentTitle: "Payment options",
    paymentOptions: [
      {
        id: "wechat",
        name: "WeChat Pay",
        description: "Use WeChat Pay to make a voluntary sponsorship payment.",
        image: "/sponsor/wechat-pay.png",
        width: 1077,
        height: 1461,
        imageAlt: "WeChat Pay collection QR code",
      },
      {
        id: "alipay",
        name: "Alipay",
        description: "Use Alipay to make a voluntary sponsorship payment.",
        image: "/sponsor/alipay.png",
        width: 1025,
        height: 1285,
        imageAlt: "Alipay collection QR code",
      },
    ],
    showQr: "Show QR code",
    hideQr: "Hide QR code",
    recipientTitle: "Payment recipient",
    recipientText:
      "Current sponsorship payments are received through the project maintainer’s personal WeChat Pay or Alipay account.",
    voluntaryText:
      "Sponsorship is voluntary and does not represent the purchase of a product or service.",
    principlesTitle: "Project principles",
    principleItems: [
      "Sponsorship does not affect scores or recommendations",
      "Raw IP addresses are not stored in analytics",
      "User data is not sold",
      "IP Health does not provide instructions for bypassing platform rules or fraud controls",
    ],
    internationalTitle: "International support",
    internationalText: "International card support is being prepared.",
    internationalContact: "For other payment questions, contact",
    noteTitle: "Important note",
    noteText:
      "Sponsorship does not affect IP Health scores, analysis results, risk labels, recommendations, or data-source behavior.",
  },
  zh: {
    lang: "zh-CN",
    homeHref: "/zh",
    languageHref: "/sponsor",
    languageLabel: "English",
    title: "支持 IP Health",
    intro:
      "IP Health 是一个免费、独立维护的 IP 声誉、网络身份和风险信号分析工具。",
    costExplanation: "赞助将用于数据接口、托管、数据库和持续维护成本。",
    usageTitle: "赞助用途",
    usageItems: [
      "数据接口和 API 成本",
      "托管与数据库服务",
      "网站维护与稳定性改进",
      "多语言和可访问性优化",
    ],
    paymentTitle: "支付方式",
    paymentOptions: [
      {
        id: "wechat",
        name: "微信支付",
        description: "通过微信支付进行自愿赞助。",
        image: "/sponsor/wechat-pay.png",
        width: 1077,
        height: 1461,
        imageAlt: "微信支付收款二维码",
      },
      {
        id: "alipay",
        name: "支付宝",
        description: "通过支付宝进行自愿赞助。",
        image: "/sponsor/alipay.png",
        width: 1025,
        height: 1285,
        imageAlt: "支付宝收款二维码",
      },
    ],
    showQr: "显示收款码",
    hideQr: "收起收款码",
    recipientTitle: "收款说明",
    recipientText: "当前赞助通过项目维护者的个人微信或支付宝账户接收。",
    voluntaryText: "赞助完全自愿，不构成商品或服务购买。",
    principlesTitle: "项目原则",
    principleItems: [
      "赞助不会影响评分或建议",
      "分析统计不保存原始 IP 地址",
      "不出售用户数据",
      "不提供绕过平台规则或风控的指导",
    ],
    internationalTitle: "国际支持",
    internationalText: "国际银行卡支付功能正在准备中。",
    internationalContact: "如需了解其他支付方式，请联系",
    noteTitle: "重要说明",
    noteText:
      "赞助不会影响 IP Health 的评分、分析结果、风险标签、建议或数据源行为。",
  },
};

export function SponsorPage({ locale }: { locale: Locale }) {
  const copy = sponsorCopy[locale];
  const [expandedQrCodes, setExpandedQrCodes] = useState<
    Record<"wechat" | "alipay", boolean>
  >({ wechat: false, alipay: false });

  function toggleQrCode(id: "wechat" | "alipay") {
    setExpandedQrCodes((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  return (
    <main
      lang={copy.lang}
      className="public-page-background flex min-h-dvh flex-col text-neutral-950"
    >
      <Link
        href={copy.homeHref}
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>
      <div className="fixed right-4 top-4 z-10 sm:right-8 sm:top-7">
        <LanguageSwitcher href={copy.languageHref} label={copy.languageLabel} />
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-28">
        <header className="max-w-3xl">
          <h1 className="text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            {copy.title}
          </h1>
          <div className="mt-5 max-w-2xl space-y-2 text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            <p>{copy.intro}</p>
            <p>{copy.costExplanation}</p>
          </div>
        </header>

        <section className="mt-10 sm:mt-12" aria-labelledby="support-usage">
          <h2
            id="support-usage"
            className="text-xl font-semibold text-neutral-950"
          >
            {copy.usageTitle}
          </h2>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/75 px-5 py-4 sm:px-6 sm:py-5">
            <ul className="grid list-disc gap-x-10 gap-y-2 pl-5 text-sm leading-6 text-neutral-600 sm:grid-cols-2">
              {copy.usageItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 sm:mt-12" aria-labelledby="payment-options">
          <h2
            id="payment-options"
            className="text-xl font-semibold text-neutral-950"
          >
            {copy.paymentTitle}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {copy.paymentOptions.map((option) => {
              const isExpanded = expandedQrCodes[option.id];
              const panelId = `${locale}-${option.id}-qr-code`;

              return (
                <article
                  key={option.id}
                  className="sponsor-payment-card rounded-2xl border border-neutral-200 bg-white text-center"
                >
                  <h3 className="text-lg font-semibold text-neutral-950">
                    {option.name}
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                    {option.description}
                  </p>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => toggleQrCode(option.id)}
                    className="mt-5 min-h-11 rounded-full border border-neutral-300 bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                  >
                    {isExpanded ? copy.hideQr : copy.showQr}
                  </button>
                  {isExpanded ? (
                    <div id={panelId} className="sponsor-qr-display">
                      <Image
                        src={option.image}
                        alt={option.imageAlt}
                        width={option.width}
                        height={option.height}
                        className="block"
                        sizes="(max-width: 767px) 220px, 232px"
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="mt-8 rounded-2xl border border-neutral-200 bg-white/75 p-5 sm:p-6"
          aria-labelledby="payment-recipient"
        >
          <h2
            id="payment-recipient"
            className="text-xl font-semibold text-neutral-950"
          >
            {copy.recipientTitle}
          </h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">
            <p>{copy.recipientText}</p>
            <p>{copy.voluntaryText}</p>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="project-principles">
          <h2
            id="project-principles"
            className="text-xl font-semibold text-neutral-950"
          >
            {copy.principlesTitle}
          </h2>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/75 px-5 py-4 sm:px-6 sm:py-5">
            <ul className="grid list-disc gap-x-10 gap-y-2 pl-5 text-sm leading-6 text-neutral-600 sm:grid-cols-2">
              {copy.principleItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section
            className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 sm:p-6"
            aria-labelledby="international-support"
          >
            <h2
              id="international-support"
              className="text-lg font-semibold text-neutral-800"
            >
              {copy.internationalTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              {copy.internationalText}
              <br />
              {copy.internationalContact}{" "}
              <a
                href="mailto:contact@iphealth.app"
                className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-950"
              >
                contact@iphealth.app
              </a>
              {locale === "zh" ? "。" : "."}
            </p>
          </section>

          <section
            className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 sm:p-6"
            aria-labelledby="important-note"
          >
            <h2
              id="important-note"
              className="text-lg font-semibold text-neutral-800"
            >
              {copy.noteTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              {copy.noteText}
            </p>
          </section>
        </div>
      </div>

      <FooterLinks locale={locale} />
    </main>
  );
}
