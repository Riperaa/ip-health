import type { Metadata } from "next";

import type { Locale } from "@/lib/localization";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  alternatePath: string;
  locale: Locale;
};

export function buildPageMetadata({
  title,
  description,
  path,
  alternatePath,
  locale,
}: PageMetadataOptions): Metadata {
  const englishPath = locale === "en" ? path : alternatePath;
  const chinesePath = locale === "zh" ? path : alternatePath;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: englishPath,
        "zh-CN": chinesePath,
        "x-default": englishPath,
      },
    },
    openGraph: {
      title,
      description,
      siteName: "IP Health",
      type: "website",
      url: path,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      alternateLocale: [locale === "zh" ? "en_US" : "zh_CN"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
