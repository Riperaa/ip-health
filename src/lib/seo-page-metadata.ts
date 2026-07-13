import type { Metadata } from "next";

import type { SeoPageContent } from "@/lib/seo-pages";

export function buildSeoPageMetadata(page: SeoPageContent): Metadata {
  const englishPath =
    page.locale === "en" ? page.canonical : page.alternatePath;
  const chinesePath =
    page.locale === "zh" ? page.canonical : page.alternatePath;

  return {
    title: page.metadataTitle,
    description: page.description,
    alternates: {
      canonical: page.canonical,
      languages: {
        en: englishPath,
        "zh-CN": chinesePath,
        "x-default": englishPath,
      },
    },
    openGraph: {
      title: page.metadataTitle,
      description: page.description,
      siteName: "IP Health",
      type: "website",
      url: page.canonical,
      locale: page.locale === "zh" ? "zh_CN" : "en_US",
      alternateLocale: [page.locale === "zh" ? "en_US" : "zh_CN"],
    },
    twitter: {
      card: "summary_large_image",
      title: page.metadataTitle,
      description: page.description,
    },
  };
}
