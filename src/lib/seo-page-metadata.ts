import type { Metadata } from "next";

import type { SeoPageContent } from "@/lib/seo-pages";
import { buildPageMetadata } from "@/lib/site-metadata";

export function buildSeoPageMetadata(page: SeoPageContent): Metadata {
  return buildPageMetadata({
    title: page.metadataTitle,
    description: page.description,
    path: page.canonical,
    alternatePath: page.alternatePath,
    locale: page.locale,
  });
}
