import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/localization";

type MethodologyPageProps = {
  children: React.ReactNode;
  description: string;
  locale: Locale;
  title: string;
};

export function MethodologyPage({
  children,
  description,
  locale,
  title,
}: MethodologyPageProps) {
  const isChinese = locale === "zh";

  return (
    <main
      lang={isChinese ? "zh-CN" : "en"}
      className="public-page-background flex min-h-dvh flex-col text-neutral-950"
    >
      <Link
        href={isChinese ? "/zh" : "/"}
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>
      <div className="fixed right-4 top-4 z-10 sm:right-8 sm:top-7">
        <LanguageSwitcher
          href={isChinese ? "/methodology" : "/zh/methodology"}
          label={isChinese ? "English" : "中文"}
        />
      </div>

      <article className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
            {isChinese ? "评分与证据说明" : "Scoring and evidence guide"}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-neutral-600 sm:text-xl">
            {description}
          </p>
        </header>

        <div className="mt-14 space-y-12 text-base leading-7 text-neutral-600 [&_a]:font-medium [&_a]:text-neutral-900 [&_a]:underline [&_a]:decoration-neutral-300 [&_a]:underline-offset-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-neutral-950 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_li]:pl-1 [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-neutral-400 sm:[&_h2]:text-3xl">
          {children}
        </div>
      </article>

      <FooterLinks locale={locale} />
    </main>
  );
}
