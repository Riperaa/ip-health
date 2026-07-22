import Link from "next/link";

import { messages, type Locale } from "@/lib/localization";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/methodology", label: "Methodology" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/sponsor", label: "Sponsor" },
];

export function FooterLinks({
  locale = "en",
  reserveFloatingShareSpace = false,
}: {
  locale?: Locale;
  reserveFloatingShareSpace?: boolean;
}) {
  const t = messages(locale);

  return (
    <footer
      className={`px-5 text-center text-sm text-neutral-400 ${
        reserveFloatingShareSpace
          ? "pb-[calc(env(safe-area-inset-bottom)+5rem)]"
          : "pb-6"
      }`}
    >
      <nav
        aria-label={t("Footer")}
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      >
        {footerLinks.map((link, index) => (
          <span key={link.href} className="inline-flex items-center gap-x-2">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            <Link
              href={locale === "zh" ? `/zh${link.href}` : link.href}
              className="font-medium transition hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              {t(link.label)}
            </Link>
          </span>
        ))}
      </nav>
    </footer>
  );
}
