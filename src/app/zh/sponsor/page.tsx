import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { LanguageSwitcher } from "@/components/language-switcher";

const title = "支持 IP Health";
const description =
  "如果 IP Health 对你有帮助，可以自愿支持项目继续维护。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/zh/sponsor",
    languages: { en: "/sponsor", "zh-CN": "/zh/sponsor" },
  },
  openGraph: {
    title,
    description,
    siteName: "IP Health",
    type: "website",
    url: "/zh/sponsor",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image", title, description },
};

const paymentOptions = [
  {
    name: "微信支付",
    description: "扫描下方二维码，通过微信支付支持 IP Health。",
    image: "/sponsor/wechat-pay.png",
    width: 1077,
    height: 1461,
  },
  {
    name: "支付宝",
    description: "扫描下方二维码，通过支付宝支持 IP Health。",
    image: "/sponsor/alipay.png",
    width: 1025,
    height: 1535,
  },
];

export default function ChineseSponsorPage() {
  return (
    <main
      lang="zh-CN"
      className="flex min-h-dvh flex-col bg-white text-neutral-950"
    >
      <Link
        href="/zh"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>
      <div className="fixed right-4 top-4 z-10 sm:right-8 sm:top-7">
        <LanguageSwitcher href="/sponsor" label="English" />
      </div>

      <section className="mx-auto w-full max-w-4xl flex-1 px-5 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-28">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            支持 IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            IP Health 是一个免费工具，用于检查 IP 声誉、网络身份和风险信号。
            如果这个工具对你有帮助，可以自愿支持项目继续维护。
          </p>
        </header>

        <section className="mt-12 sm:mt-16" aria-labelledby="china-support-zh">
          <h2
            id="china-support-zh"
            className="text-center text-2xl font-semibold text-neutral-950"
          >
            支持方式
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
                    alt={`${option.name}收款二维码`}
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

        <section
          className="mx-auto mt-5 max-w-2xl rounded-[28px] border border-neutral-200 bg-neutral-50/70 p-6"
          aria-labelledby="important-note-zh"
        >
          <h2
            id="important-note-zh"
            className="text-xl font-semibold text-neutral-950"
          >
            重要说明
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            赞助完全自愿。赞助不会影响 IP Health
            的评分、分析结果、风险标签、建议或数据源行为。
          </p>
        </section>
      </section>

      <FooterLinks />
    </main>
  );
}
