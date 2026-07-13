import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "免责声明 | IP Health",
  description:
    "了解 IP Health 检测结果、IP 声誉信号、兼容性建议和服务访问预测的适用范围与限制。",
  path: "/zh/disclaimer",
  alternatePath: "/disclaimer",
  locale: "zh",
});

export default function ChineseDisclaimerPage() {
  return (
    <InfoPage title="免责声明" locale="zh">
      <p>
        IP Health 的结果仅供参考。IP
        声誉只是评估访问、风险或兼容性时使用的信号之一。
      </p>
      <p>
        服务平台在决定允许或阻止操作时，还可能使用设备、账号、行为、支付方式和浏览器指纹等信号。
      </p>
      <p>IP Health 无法保证任何服务一定会允许或阻止访问。</p>
    </InfoPage>
  );
}
