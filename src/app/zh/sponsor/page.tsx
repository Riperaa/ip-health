import type { Metadata } from "next";

import { SponsorPage } from "@/components/sponsor-page";
import { buildPageMetadata } from "@/lib/site-metadata";

const title = "支持 IP Health";
const description =
  "IP Health 是一个免费、独立维护的 IP 声誉、网络身份和风险信号分析工具。";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/zh/sponsor",
  alternatePath: "/sponsor",
  locale: "zh",
});

export default function ChineseSponsorRoute() {
  return <SponsorPage locale="zh" />;
}
