import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "关于 IP Health",
  description:
    "了解 IP Health：一款注重隐私、用于检查 IP 声誉、网络身份、兼容性和风险信号的工具。",
  path: "/zh/about",
  alternatePath: "/about",
  locale: "zh",
});

export default function ChineseAboutPage() {
  return (
    <InfoPage title="关于 IP Health" locale="zh">
      <p>
        IP Health 是一款 IP
        可信度与声誉检测工具，可帮助你快速判断一个地址是否安全、存在风险或需要谨慎使用。
      </p>
      <p>
        它综合声誉信号与服务兼容性建议，帮助你了解某个 IP
        在常见在线服务中的使用表现。
      </p>
      <p>本工具面向注重隐私的用户、开发者以及需要评估网络质量的人群。</p>
    </InfoPage>
  );
}
