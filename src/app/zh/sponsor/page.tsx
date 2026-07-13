import type { Metadata } from "next";

import { SponsorPage } from "@/components/sponsor-page";

const title = "支持 IP Health";
const description =
  "IP Health 是一个免费、独立维护的 IP 声誉、网络身份和风险信号分析工具。";

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

export default function ChineseSponsorRoute() {
  return <SponsorPage locale="zh" />;
}
