import type { Metadata } from "next";
import Link from "next/link";

import { MethodologyPage } from "@/components/methodology-page";

const title = "IP Health 如何工作";
const description =
  "了解 IP Health 如何综合声誉、网络质量、兼容性、证据质量、网络身份与共享风险，形成实用的 IP 评估。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/zh/methodology",
    languages: { en: "/methodology", "zh-CN": "/zh/methodology" },
  },
  openGraph: {
    title,
    description,
    siteName: "IP Health",
    type: "website",
    url: "/zh/methodology",
    locale: "zh_CN",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function ChineseMethodologyRoute() {
  return (
    <MethodologyPage
      title={title}
      description="IP Health 将声誉、网络身份、基础设施、连通性和数据提供方证据综合为实用的 IP 风险评估，帮助你在登录、注册、支付、远程办公或业务使用前了解一个 IP。"
      locale="zh"
    >
      <section aria-labelledby="overall-score-zh">
        <h2 id="overall-score-zh">1. 综合评分</h2>
        <p>
          IP 健康评分是 0–100
          分的实用风险摘要，并非任何形式的保证。分数越高，通常表示观察到的风险信号越少；分数越低，则表示发现了更明显的声誉、隐私网络、基础设施或连通性问题。
        </p>
        <p>
          当前综合评分由三个维度组成：声誉占 50%，网络质量占 30%，兼容性占
          20%。每个维度均根据本次检测实际获得的证据计算。证据缺失或不完整时，某个维度的最高分可能受到限制，因此评分应始终结合证据质量与网络身份一起理解。
        </p>
      </section>

      <section aria-labelledby="dimensions-zh">
        <h2 id="dimensions-zh">2. 主要评估维度</h2>
        <h3>声誉</h3>
        <p>
          检查已报告的滥用可信度、数据提供方的欺诈或声誉评分、近期滥用与机器人信号，以及
          VPN、代理、Tor
          或滥用标记。数据提供方是否可用，也会影响“声誉良好”这一结论的可信程度。
        </p>
        <h3>网络质量</h3>
        <p>
          检查网络归属是否清晰、ASN
          与组织信息、消费级接入特征、托管或数据中心特征、VPN、代理、中继、Tor、WARP
          信号，以及 Cloudflare Trace
          上下文。若主要身份被识别为住宅或移动网络，单个辅助基础设施标记只会作为复核信息，不会独自改写网络身份。
        </p>
        <h3>兼容性</h3>
        <p>
          根据浏览器连通性探测以及结果中的区域或策略限制信号，估计所测试服务是否看起来可以访问。“未验证”表示浏览器无法完整确认该探测，并不等于“无法访问”。兼容性不会实际测试或预测账号注册、支付或登录能否通过。
        </p>
      </section>

      <section aria-labelledby="evidence-quality-zh">
        <h2 id="evidence-quality-zh">3. 证据质量</h2>
        <p>
          证据质量描述报告所用数据的覆盖度与完整性。它不是第二个风险评分，也不是所有数据提供方相互一致程度的直接评分。
        </p>
        <ul className="list-disc">
          <li>
            <strong>高：</strong>
            所需的网络归属、声誉、Trace、辅助情报和连通性证据均可用，且没有记录到覆盖缺口。
          </li>
          <li>
            <strong>中：</strong>
            部分证据不可用或不完整，但仍有足够的备用声誉证据和网络上下文，可以形成有参考价值的评估。
          </li>
          <li>
            <strong>低：</strong>重要数据源不可用或不完整，结果的不确定性更高。
          </li>
        </ul>
        <p>
          某个数据提供方失败不会自动将 IP
          判为高风险，但可能限制维度最高分、降低证据质量并让结果措辞更谨慎。证据质量低表示“确定性较低”，不等于“IP
          很差”。
        </p>
      </section>

      <section aria-labelledby="network-identity-zh">
        <h2 id="network-identity-zh">4. 网络身份</h2>
        <p>
          网络身份根据隐私标记、使用类型、归属文本、ASN
          特征以及部分已知公共服务端点，描述最可能的网络类型。当前支持的类别包括：住宅宽带、移动网络、企业网络、公共基础设施、云服务商、数据中心、VPN
          / 代理、Tor 出口节点和未知。
        </p>
        <p>
          网络身份是描述性结论，并不等于恶意判断。公共 DNS 或 CDN
          可以是正常基础设施，但不适合作为个人接入
          IP；企业网络可能很干净，但由多人共享；住宅 IP
          仍可能存在声誉问题；数据中心 IP
          即使没有滥用历史，也可能受到平台更严格的审核。
        </p>
      </section>

      <section aria-labelledby="sharing-risk-zh">
        <h2 id="sharing-risk-zh">5. 共享风险</h2>
        <p>
          共享风险是独立于网络身份的判断，用于估计流量是否可能来自共享、中继、托管、企业、公共服务、代理或多用户基础设施。其依据包括隐私信号、网络身份、托管与数据中心证据、归属数据覆盖度、Cloudflare
          路径一致性和辅助提供方信号。
        </p>
        <p>
          Tor 或强 VPN /
          代理信号会产生较高共享风险。托管、企业和公共基础设施会结合各自身份解释，可能得到中等共享风险，但不会因此被描述为恶意。没有强隐私或基础设施信号的普通住宅或移动接入通常属于低共享风险。归属与提供方数据不足时，共享程度可能为未知。
        </p>
      </section>

      <section aria-labelledby="signal-strength-zh">
        <h2 id="signal-strength-zh">6. 强信号与复核信号</h2>
        <p>
          强信号包括直接身份检查所识别的 Tor、VPN /
          代理或中继、严重滥用历史、近期滥用，以及数据提供方报告的高声誉风险。这些信号可以直接影响风险判断或使用建议。
        </p>
        <p>
          复核信号包括辅助隐私或基础设施标记、托管或受管网络特征、不同提供方看到的
          IP
          不一致、企业或公共路由上下文，以及未完整验证的连通性。其含义取决于网络身份。已知公共服务端点会先于通用隐私标签处理；当网络已被识别为消费级、企业或公共基础设施时，部分基础设施观察只作为复核上下文。
        </p>
      </section>

      <section aria-labelledby="data-sources-zh">
        <h2 id="data-sources-zh">7. 数据来源</h2>
        <p>报告可能使用以下来源，但无法保证每个来源在每次分析中都可用。</p>
        <ul className="list-disc">
          <li>
            <strong>IPinfo：</strong>提供 IP
            归属、ASN、组织、位置和隐私网络字段。
          </li>
          <li>
            <strong>AbuseIPDB：</strong>提供已报告的滥用可信度、使用类型和 ISP
            上下文。
          </li>
          <li>
            <strong>IPQualityScore（IPQS）：</strong>
            在提供方正常响应时，提供欺诈、近期滥用、机器人、VPN、代理和 Tor
            声誉信号。
          </li>
          <li>
            <strong>Scamalytics：</strong>提供辅助声誉评分，以及代理、VPN、Tor
            和服务器标记。
          </li>
          <li>
            <strong>ipapi.is：</strong>
            提供辅助隐私、托管、数据中心、滥用、归属和位置信息。
          </li>
          <li>
            <strong>Cloudflare：</strong>提供 Trace IP、WARP
            状态、边缘位置和一致性上下文。
          </li>
          <li>
            <strong>连通性探测：</strong>
            通过浏览器观察所选服务的可访问、无法访问或未验证状态。
          </li>
        </ul>
      </section>

      <section aria-labelledby="conflicts-zh">
        <h2 id="conflicts-zh">8. 如何处理冲突信号</h2>
        <p>
          系统会综合评估多个提供方的结果，但不同结果承担的作用并不相同。强隐私与声誉证据可以直接影响评分或分类；部分辅助字段则作为需要佐证的复核证据。网络身份按明确顺序判断，例如已知公共服务端点不会仅因某个提供方标记，就被描述成个人
          VPN 连接。
        </p>
        <p>
          结合网络身份的措辞可避免将正常基础设施描述为恶意。某个提供方不可用时，系统会降低可信度，而不是让整个分析失败。最终建议还会结合身份和风险上下文：即使声誉证据相近，干净的托管基础设施、共享企业网络和普通住宅接入也可能得到不同建议。
        </p>
      </section>

      <section aria-labelledby="limitations-zh">
        <h2 id="limitations-zh">9. 结果限制</h2>
        <ul className="list-disc">
          <li>评分不能保证账号一定会被接受。</li>
          <li>平台会使用 IP Health 无法看到的内部风险系统。</li>
          <li>IP 声誉与提供方数据可能不同，也会随时间变化。</li>
          <li>浏览器和网络条件可能影响连通性探测。</li>
          <li>“未验证”不等于“无法访问”。</li>
          <li>分数良好不能保证账号或交易安全。</li>
          <li>低分不能证明存在恶意活动。</li>
          <li>
            应结合具体用途理解结果，尤其是注册、验证、支付、银行或敏感账号变更。
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-zh">
        <h2 id="privacy-zh">10. 隐私与数据处理</h2>
        <p>
          IP Health 会将待分析的 IP 发送给服务器端数据提供方
          API。最近检测历史仅保存在你的浏览器 localStorage 中，且 IP Health
          没有账号系统。匿名产品分析仅使用类别级字段，不存储原始 IP
          地址、请求标头、API 密钥、令牌、账号标识符或设备标识符。IP Health
          不出售个人数据，也不使用跟踪 Cookie。
        </p>
        <p>
          当前数据处理说明请参阅完整的<Link href="/zh/privacy">隐私政策</Link>。
        </p>
      </section>
    </MethodologyPage>
  );
}
