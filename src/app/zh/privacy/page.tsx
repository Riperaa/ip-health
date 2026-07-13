import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "隐私政策 | IP Health",
  description:
    "了解 IP Health 如何处理待分析的 IP 地址、本地浏览器历史、数据提供方请求和匿名产品分析数据。",
  path: "/zh/privacy",
  alternatePath: "/privacy",
  locale: "zh",
});

export default function ChinesePrivacyPage() {
  return (
    <InfoPage title="隐私政策" locale="zh">
      <p>
        IP Health 会分析用户输入的 IP 地址，并可能在服务器端调用数据提供方的
        API，以获取声誉和网络信息。
      </p>
      <p>
        本地检测历史仅保存在你设备的浏览器 localStorage 中。IP Health
        不提供账号系统。
      </p>
      <p>
        IP Health
        使用匿名产品分析数据来了解分析、对比和反馈等核心流程是否正常。这些事件仅包含国家/地区代码、网络身份类别、证据质量、成功状态和反馈原因等类别信息。
      </p>
      <p>
        分析事件不会存储原始 IP 地址、请求标头、API
        密钥、令牌、账号标识符、设备标识符或其他个人标识信息。
      </p>
      <p>IP Health 不出售个人数据，也不使用跟踪 Cookie。</p>
    </InfoPage>
  );
}
