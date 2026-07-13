import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoContentPage } from "@/components/seo-content-page";
import { buildSeoPageMetadata } from "@/lib/seo-page-metadata";
import { getSeoPage, isSeoPageSlug, seoPageSlugs } from "@/lib/seo-pages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return seoPageSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isSeoPageSlug(slug)) return {};

  return buildSeoPageMetadata(getSeoPage("zh", slug));
}

export default async function ChineseSeoPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isSeoPageSlug(slug)) notFound();

  return <SeoContentPage page={getSeoPage("zh", slug)} />;
}
