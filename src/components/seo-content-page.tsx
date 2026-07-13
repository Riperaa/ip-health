import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { SeoPageContent } from "@/lib/seo-pages";

function Cta({
  page,
  compact = false,
}: {
  page: SeoPageContent;
  compact?: boolean;
}) {
  return (
    <aside
      aria-label={page.cta.title}
      className={`surface-card rounded-2xl border border-slate-200/90 bg-white/90 ${
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
      }`}
    >
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div className="max-w-2xl">
          <h2
            className={`${compact ? "text-xl" : "text-2xl"} font-semibold tracking-tight text-neutral-950`}
          >
            {page.cta.title}
          </h2>
          <p className="mt-2 leading-7 text-neutral-600">{page.cta.body}</p>
        </div>
        <Link
          href={page.cta.href}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          {page.cta.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

export function SeoContentPage({ page }: { page: SeoPageContent }) {
  const isChinese = page.locale === "zh";
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.title,
      acceptedAnswer: { "@type": "Answer", text: item.body },
    })),
  };

  return (
    <main
      lang={isChinese ? "zh-CN" : "en"}
      className="public-page-background flex min-h-dvh flex-col text-neutral-950"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav
        aria-label={isChinese ? "页面导航" : "Page navigation"}
        className="fixed inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top)+1.75rem)]"
      >
        <Link
          href={isChinese ? "/zh" : "/"}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          IP Health
        </Link>
        <LanguageSwitcher
          href={page.alternatePath}
          label={isChinese ? "English" : "中文"}
        />
      </nav>

      <article className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20 pt-[calc(env(safe-area-inset-top)+7.5rem)] sm:px-8 sm:pb-24 sm:pt-[calc(env(safe-area-inset-top)+9rem)]">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-neutral-950 sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-neutral-600 sm:text-xl sm:leading-9">
            {page.opening}
          </p>
        </header>

        <div className="mt-16 space-y-16">
          {page.sections.map((section, sectionIndex) => (
            <div key={section.title} className="space-y-16">
              <section aria-labelledby={`section-${sectionIndex}`}>
                <div className="max-w-3xl">
                  <h2
                    id={`section-${sectionIndex}`}
                    className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl"
                  >
                    {section.title}
                  </h2>
                  {section.intro ? (
                    <p className="mt-4 text-base leading-7 text-neutral-600 sm:text-lg">
                      {section.intro}
                    </p>
                  ) : null}
                </div>

                <div
                  className={`mt-7 grid gap-x-10 gap-y-7 ${
                    section.presentation === "steps"
                      ? "sm:grid-cols-2"
                      : "md:grid-cols-2"
                  }`}
                >
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={item.title}
                      className={
                        section.presentation === "steps"
                          ? "grid grid-cols-[2rem_1fr] gap-3"
                          : "border-l-2 border-slate-200 pl-4"
                      }
                    >
                      {section.presentation === "steps" ? (
                        <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                          {itemIndex + 1}
                        </span>
                      ) : null}
                      <div>
                        <h3 className="font-semibold leading-6 text-neutral-900">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-[0.95rem] leading-7 text-neutral-600">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {section.note ? (
                  <p className="mt-7 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-neutral-600 sm:text-base sm:leading-7">
                    {section.note}
                  </p>
                ) : null}
              </section>

              {sectionIndex === 1 ? <Cta page={page} compact /> : null}
            </div>
          ))}
        </div>

        <section
          aria-labelledby="faq"
          className="mt-16 border-t border-slate-200 pt-16"
        >
          <h2
            id="faq"
            className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl"
          >
            {page.faqTitle}
          </h2>
          <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
            {page.faq.map((item) => (
              <details key={item.title} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-semibold leading-6 text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 [&::-webkit-details-marker]:hidden">
                  {item.title}
                  <span
                    aria-hidden="true"
                    className="relative size-4 shrink-0 text-neutral-400 before:absolute before:left-0 before:top-[7px] before:h-0.5 before:w-4 before:bg-current after:absolute after:left-[7px] after:top-0 after:h-4 after:w-0.5 after:bg-current after:transition-transform group-open:after:scale-y-0"
                  />
                </summary>
                <p className="max-w-3xl pb-5 pr-7 text-[0.95rem] leading-7 text-neutral-600">
                  {item.body}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-16">
          <Cta page={page} />
        </div>
      </article>

      <FooterLinks locale={page.locale} />
    </main>
  );
}
