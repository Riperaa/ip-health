import type { Metadata } from "next";
import Link from "next/link";

import { FooterLinks } from "@/components/footer-links";
import { IpCompare } from "@/components/ip-compare";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "IP 地址对比 | IP Health",
  description:
    "并排对比两个 IP 地址的声誉、网络身份、共享风险、证据质量与兼容性信号。",
  path: "/zh/compare",
  alternatePath: "/compare",
  locale: "zh",
});

export default function ChineseComparePage() {
  return (
    <main
      lang="zh-CN"
      className="public-page-background flex min-h-dvh flex-col text-neutral-950"
    >
      <Link
        href="/zh"
        className="fixed left-4 top-4 z-10 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:text-neutral-950 sm:left-8 sm:top-7"
      >
        IP Health
      </Link>
      <IpCompare locale="zh" />
      <FooterLinks locale="zh" />
    </main>
  );
}
