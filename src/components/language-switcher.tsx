import Link from "next/link";

type LanguageSwitcherProps = {
  href: string;
  label: string;
};

export function LanguageSwitcher({ href, label }: LanguageSwitcherProps) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      hrefLang={href.startsWith("/zh") ? "zh-CN" : "en"}
    >
      {label}
    </Link>
  );
}
