export type Locale = "en" | "zh";

const zh: Record<string, string> = {
  Footer: "页脚导航",
  Methodology: "方法说明",
  "Better choice": "更佳选择",
  "Compare two IP addresses side by side.": "并排比较两个 IP 地址。",
  Compare: "开始对比",
  "Comparing...": "正在对比…",
  "Enter both IP addresses.": "请输入两个 IP 地址。",
  "Unable to compare these IPs.": "无法对比这两个 IP。",
  "IP A": "IP A",
  "IP B": "IP B",
  "Usage Type": "使用类型",
  "Abuse Confidence": "滥用可信度",
  "ISP / Organization": "ISP / 组织",
  IP: "IP",
  Infrastructure: "基础设施",
  "No abuse score": "无滥用评分",
  Elevated: "偏高",
  Severe: "严重",
  "Similar risk": "风险相近",
  "Both IPs have similar risk levels.": "两个 IP 的风险水平相近。",
  "This IP has a stronger IP Health Score profile.":
    "该 IP 的健康评分表现更好。",
  "This IP has moderate IP quality signals.": "该 IP 的质量信号一般。",
  "This IP has elevated risk signals.": "该 IP 存在较高风险信号。",
  "IP address": "IP 地址",
  "QA mode: checks are not saved.": "QA 模式：检测记录不会保存。",
  "Enter an IPv4 address": "输入 IPv4 地址",
  "Analyzing IP...": "正在分析 IP…",
  Analyze: "开始分析",
  "Detecting...": "正在检测…",
  "Auto Detect My IP": "自动检测我的 IP",
  "Compare IPs": "对比 IP",
  "Analysis failed": "分析失败",
  "Unable to retrieve IP information.": "无法获取 IP 信息。",
  "Please try again in a moment.": "请稍后重试。",
  Retry: "重试",
  "Unable to detect your IP. You can enter it manually.":
    "无法自动检测你的 IP，请手动输入。",
  "Invalid IP address": "请输入有效的 IPv4 地址。",
  "Recent Checks": "最近检测",
  "Saved in this browser only": "仅保存在当前浏览器中",
  "No recent checks yet.": "暂无最近检测记录。",
  "Why check your IP?": "为什么要检测 IP？",
  "Account Registration": "账号注册",
  "Check whether your IP may trigger signup verification.":
    "了解当前 IP 是否可能触发注册验证。",
  "VPN Usage": "VPN 使用",
  "Understand whether your VPN exit IP looks trustworthy.":
    "判断 VPN 出口 IP 是否具有良好可信度。",
  "Online Security": "网络安全",
  "See how websites may evaluate your network identity.":
    "了解网站可能如何判断你的网络身份。",
  "Detecting your IP": "正在检测你的 IP",
  "Preparing IP check...": "正在准备 IP 检测…",
  "Querying AbuseIPDB": "正在查询 AbuseIPDB",
  "Checking AbuseIPDB...": "正在检查 AbuseIPDB…",
  "Querying IPinfo": "正在查询 IPinfo",
  "Querying IPinfo...": "正在查询 IPinfo…",
  "Querying Cloudflare": "正在查询 Cloudflare",
  "Querying Cloudflare...": "正在查询 Cloudflare…",
  "Querying IPQualityScore": "正在查询 IPQualityScore",
  "Checking IPQualityScore...": "正在检查 IPQualityScore…",
  "Querying Scamalytics": "正在查询 Scamalytics",
  "Checking Scamalytics...": "正在检查 Scamalytics…",
  "Querying ipapi.is": "正在查询 ipapi.is",
  "Checking ipapi.is...": "正在检查 ipapi.is…",
  "Calculating Trust Score": "正在计算可信评分",
  "Calculating reputation...": "正在计算声誉…",
  "Generating Report": "正在生成报告",
  "Generating recommendations...": "正在生成使用建议…",
  "Analysis complete. Preparing your report...": "分析完成，正在准备报告…",
  "Finishing analysis...": "正在完成分析…",
  "Analysis complete": "分析完成",
  "Analyzing your IP...": "正在分析你的 IP…",
  "Was this result useful?": "这个结果对你有帮助吗？",
  "Feedback is disabled in QA mode.": "QA 模式下反馈功能已停用。",
  Helpful: "有帮助",
  "Not Helpful": "没有帮助",
  "Wrong IP type": "IP 类型不准确",
  "Wrong location": "位置不准确",
  "Score not convincing": "评分缺乏说服力",
  "Missing information": "信息不完整",
  Other: "其他",
  "Thanks for the feedback.": "感谢你的反馈。",
  "IP Health Score": "IP 健康评分",
  "Checked IP": "已检测 IP",
  "Evidence Quality": "证据质量",
  Assessment: "综合评估",
  Reputation: "声誉",
  "Network Quality": "网络质量",
  Compatibility: "兼容性",
  "Network Identity": "网络身份",
  "Sharing Risk": "共享风险",
  Recommendation: "使用建议",
  "Technical Details": "技术详情",
  "Evidence and network details": "证据与网络详情",
  "Network identity, sharing risk, and reputation evidence":
    "网络身份、共享风险与声誉证据",
  Confidence: "可信度",
  Reason: "原因",
  Provider: "网络提供商",
  Location: "位置",
  Country: "国家/地区",
  City: "城市",
  Region: "区域",
  Evidence: "判断依据",
  "Risk Score": "风险评分",
  "Risk Level": "风险等级",
  "Abuse History": "滥用记录",
  Status: "状态",
  Available: "可用",
  available: "可用",
  Unavailable: "不可用",
  unavailable: "不可用",
  Pending: "等待分析",
  "Not analyzed": "尚未分析",
  "Not identified": "未识别",
  "Not available": "暂不可用",
  "Not reported": "未报告",
  Yes: "是",
  No: "否",
  "Bot Signal": "Bot 信号",
  Server: "服务器",
  Datacenter: "数据中心（Datacenter）",
  Hosting: "托管服务",
  Organization: "组织",
  "Abuser Signal": "滥用信号",
  "HTTP Status": "HTTP 状态",
  Connectivity: "连通性",
  Reachable: "可访问",
  Unreachable: "无法访问",
  "Not verified": "未验证",
  "Direct browser check": "浏览器直接检测",
  "Image probe": "图片探测",
  "Browser probe": "浏览器探测",
  "Browser reachability probes.": "通过浏览器探测服务可访问性。",
  "Connectivity probe data is unavailable.": "暂无连通性探测数据。",
  "Network owner and location fields.": "网络归属与位置字段。",
  "Provider reputation fields.": "声誉数据提供方字段。",
  "Secondary reputation provider fields.": "辅助声誉数据提供方字段。",
  "Secondary IP intelligence provider fields.": "辅助 IP 情报数据字段。",
  "Trace available": "Trace 数据可用",
  "Trace, WARP, and consistency signals.": "Trace、WARP 与一致性信号。",
  "Clean Signals": "良好信号",
  "Review Signals": "需复核信号",
  "No clean signals confirmed": "尚无已确认的良好信号",
  "No review signals detected": "未发现需复核信号",
  "Provider and history signals.": "综合数据提供方与历史记录信号。",
  "No sharing evidence available": "暂无共享风险依据",
  "Suitable Usage": "适合使用",
  "May Need Verification": "可能需要额外验证",
  "May Fail Verification": "可能无法通过验证",
  Avoid: "建议避免",
  Browsing: "日常浏览",
  Streaming: "流媒体",
  "Daily accounts": "日常账号使用",
  "Low-risk services": "低风险服务",
  "New account registration": "注册新账号",
  "Important verification": "重要身份验证",
  "Sensitive account changes": "敏感账号操作",
  "Basic browsing only": "仅基础浏览",
  "Existing account login": "登录已有账号",
  "Payment verification": "支付验证",
  "Residential ISP": "住宅宽带（Residential ISP）",
  "Mobile Network": "移动网络（Mobile Network）",
  "Enterprise Network": "企业网络（Enterprise Network）",
  "Public Infrastructure": "公共基础设施（Public Infrastructure）",
  "Public infrastructure review signal": "公共基础设施复核信号",
  "Provider VPN/proxy label treated as infrastructure metadata":
    "数据提供方的 VPN/代理标签已按基础设施元数据处理",
  "Public infrastructure provider label": "公共基础设施提供方标签",
  "Cloud Provider": "云服务商（Cloud Provider）",
  "VPN / Proxy": "VPN / 代理（Proxy）",
  "Tor Exit": "Tor 出口节点（Tor Exit）",
  Unknown: "未知",
  High: "高",
  Medium: "中",
  Low: "低",
  Good: "良好",
  Fair: "一般",
  Poor: "较差",
  Partial: "部分可用",
  Clean: "良好",
  Review: "需复核",
  Strong: "强",
  Weak: "弱",
  Detected: "已检测",
  "Not detected": "未检测到",
  Healthy: "健康",
  Risky: "高风险",
  Restricted: "受限",
  Verified: "已验证",
  "Not Verified": "未验证",
  Recommended: "推荐使用",
  "Not Recommended": "不推荐使用",
  "Use with Caution": "谨慎使用",
  "High Risk": "高风险",
  "High Risk Signals": "高风险信号",
  "High Reputation Risk": "高声誉风险",
  "High Network Risk": "高网络风险",
  "High Quality IP": "高质量 IP",
  "Good Reputation": "声誉良好",
  "Low Risk": "低风险",
  "Medium Risk": "中等风险",
  Residential: "住宅网络",
  "Enterprise network": "企业网络",
  "Public edge infrastructure": "公共边缘基础设施",
  "Public or edge infrastructure": "公共或边缘基础设施",
  "Strong VPN/proxy signal confirmed": "已确认强 VPN/代理信号",
  "Network appears to be hosting or infrastructure.":
    "网络表现为托管服务或基础设施。",
  "Network ownership appears to be hosting or infrastructure.":
    "网络归属表现为托管服务或基础设施。",
  "No VPN, proxy, Tor, or relay detected.": "未检测到 VPN、代理、Tor 或中继。",
  "No abuse database score was returned for this IP.":
    "滥用数据库未返回该 IP 的评分。",
  "IP not found in recent abuse reports.": "近期滥用报告中未发现该 IP。",
  "Connectivity probes completed.": "连通性探测已完成。",
  "Connectivity probes were unavailable.": "连通性探测不可用。",
  "Connectivity probes were partially verified.": "连通性探测已完成部分验证。",
  "Abuse history data was unavailable.": "滥用历史数据不可用。",
  "AbuseIPDB abuse history was unavailable.": "AbuseIPDB 滥用历史数据不可用。",
  "IPInfo network data was unavailable.": "IPInfo 网络数据不可用。",
  "IPInfo ownership data is incomplete.": "IPInfo 归属数据不完整。",
  "IPInfo ownership data was incomplete.": "IPInfo 归属数据不完整。",
  "Cloudflare trace data was unavailable.": "Cloudflare Trace 数据不可用。",
  "Important reputation providers were unavailable.":
    "重要声誉数据提供方不可用。",
  "A reputation data source was unavailable.": "一个声誉数据源不可用。",
  "A reputation data source was unavailable; Scamalytics was available.":
    "一个声誉数据源不可用；Scamalytics 可用。",
  "A reputation data source was unavailable; ipapi.is was available.":
    "一个声誉数据源不可用；ipapi.is 可用。",
  "Some reputation data sources were unavailable; ipapi.is was available.":
    "部分声誉数据源不可用；ipapi.is 可用。",
  "Provider reputation data shows low to moderate review signals.":
    "声誉数据提供方显示轻度至中度复核信号。",
  "Clean reputation signals, limited confidence": "声誉信号良好，但可信度有限",
  "Insufficient reputation evidence": "声誉证据不足",
  "Some reputation signals found": "检测到部分声誉风险信号",
  "Insufficient evidence for a high-confidence assessment":
    "证据不足，无法做出高可信度评估",
  "IPQS, IPInfo, ipapi.is, and connectivity probes were available":
    "IPQS、IPInfo、ipapi.is 与连通性探测均可用",
  "Clean reputation signals, but confidence is limited because IPQS data was unavailable.":
    "声誉信号良好，但由于 IPQS 数据不可用，可信度有限。",
  "Clean reputation signals, but confidence is limited because a reputation data source was unavailable.":
    "声誉信号良好，但由于一个声誉数据源不可用，可信度有限。",
  "Compatibility needs review before sensitive use.":
    "用于敏感场景前需要复核兼容性。",
  "Restricted Compatibility": "兼容性受限",
  "Strong Compatibility": "兼容性良好",
  "No browser connectivity probe data is available for this report.":
    "本报告暂无浏览器连通性探测数据。",
  "One or more service checks indicate regional or policy restrictions.":
    "一项或多项服务检测显示存在区域或策略限制。",
  "Mobile network detected. This IP appears to belong to a cellular carrier.":
    "检测到移动网络。该 IP 可能属于移动通信运营商。",
  "VPN or proxy network detected. Traffic may pass through a privacy or access service.":
    "检测到 VPN 或代理网络。流量可能经过隐私或接入服务。",
  "Tor exit network detected. Traffic exits through the Tor anonymity network.":
    "检测到 Tor 出口网络。流量通过 Tor 匿名网络离开。",
  "IPInfo privacy data marks this IP as Tor exit traffic.":
    "IPInfo 隐私数据将该 IP 标记为 Tor 出口流量。",
  "IPInfo privacy data marks this IP as VPN, proxy, or relay traffic.":
    "IPInfo 隐私数据将该 IP 标记为 VPN、代理或中继流量。",
  "IPQS marks this IP as Tor exit traffic.":
    "IPQS 将该 IP 标记为 Tor 出口流量。",
  "IPQS marks this IP as VPN or proxy traffic.":
    "IPQS 将该 IP 标记为 VPN 或代理流量。",
  "Provider data includes residential broadband ownership signals.":
    "数据提供方包含住宅宽带归属信号。",
  "Provider usage data identifies this IP as residential.":
    "数据提供方的使用类型数据将该 IP 识别为住宅网络。",
  "Provider usage data identifies this IP as mobile.":
    "数据提供方的使用类型数据将该 IP 识别为移动网络。",
  "ISP ownership signals suggest a residential broadband network.":
    "ISP 归属信号表明这是住宅宽带网络。",
  "Hosting or infrastructure signals were present, but a specific provider family was not identified.":
    "检测到托管或基础设施信号，但未识别出具体提供商类别。",
  "This IP appears less likely to be heavily shared.":
    "该 IP 被大量共享的可能性较低。",
  "Traffic may come from shared infrastructure rather than a single household or personal device.":
    "流量可能来自共享基础设施，而非单个家庭或个人设备。",
  "VPN or proxy infrastructure is commonly shared by many users or services.":
    "VPN 或代理基础设施通常由多个用户或服务共享。",
  "Tor exit traffic is high risk and is not recommended for account registration, verification, banking, payments, or sensitive login.":
    "Tor 出口流量风险较高，不建议用于账号注册、身份验证、银行、支付或敏感登录。",
  "This appears to be a normal access network. Minor review signals may still require extra checks on stricter platforms.":
    "这看起来是普通接入网络。轻微复核信号仍可能在风控较严格的平台触发额外检查。",
  "This appears to be a normal access network. Some checks may require review, but no strong sharing signal is confirmed.":
    "这看起来是普通接入网络。部分检测可能需要复核，但尚未确认强共享信号。",
  "Cloudflare WARP is active for this connection.":
    "此连接已启用 Cloudflare WARP。",
  "Cloudflare did not report WARP on this connection.":
    "Cloudflare 未报告此连接启用了 WARP。",
  "Cloudflare and IPinfo identify the same IP.":
    "Cloudflare 与 IPinfo 识别到相同的 IP。",
  "Cloudflare and IPinfo identify different IPs.":
    "Cloudflare 与 IPinfo 识别到不同的 IP。",
  "Unable to compare Cloudflare and IPinfo views.":
    "无法比较 Cloudflare 与 IPinfo 的检测结果。",
  Consistent: "一致",
  Consistency: "一致性",
  "Real IP": "真实 IP",
  "VPN/WARP": "VPN/WARP",
  "WARP on": "WARP 已开启",
  "WARP status was not returned.": "未返回 WARP 状态。",
  "Cloudflare network view.": "Cloudflare 网络视图。",
  "High quality IP": "高质量 IP",
  "Review dimensions": "部分维度需复核",
  "High risk signals": "发现高风险信号",
  "Review Needed": "需要复核",
  "Good Quality": "质量良好",
  "Strong overall IP quality signals.": "整体 IP 质量信号良好。",
  "Some signals may require verification.": "部分信号可能需要进一步验证。",
  "Sensitive services may restrict this IP.": "敏感服务可能会限制此 IP。",
  "Insufficient evidence for a high-confidence verdict.":
    "现有证据不足以做出高可信度判断。",
  "Good available signals with some data sources unavailable.":
    "现有信号良好，但部分数据源不可用。",
  "Insufficient evidence for a high-confidence assessment. Important data sources were unavailable: IPQS reputation data was unavailable; Scamalytics was available. Connectivity probes were partially verified.":
    "证据不足，无法做出高可信度评估。部分重要数据源不可用：IPQS 声誉数据不可用；Scamalytics 可用。连通性探测已完成部分验证。",
  "Important data sources were unavailable: IPQS reputation data was unavailable; Scamalytics was available. Connectivity probes were partially verified.":
    "部分重要数据源不可用：IPQS 声誉数据不可用；Scamalytics 可用。连通性探测已完成部分验证。",
  "Clean Signals, Limited Evidence": "信号良好，但证据有限",
  "Strong Network Quality": "网络质量良好",
  "Moderate Compatibility": "兼容性一般",
  "Clean IP history": "IP 历史记录良好",
  "No abuse history or high reputation provider risk was reported.":
    "未发现滥用记录，声誉数据提供方也未报告高风险。",
  "IPQS reputation data was unavailable; Scamalytics was available.":
    "IPQS 声誉数据不可用；Scamalytics 可用。",
  "Network type not fully identified": "网络类型尚未完全识别",
  "Provider data did not clearly identify a residential or infrastructure network.":
    "数据提供方未能明确判断该 IP 属于住宅网络还是基础设施网络。",
  "IPInfo network ownership data is available.": "IPInfo 网络归属数据可用。",
  "Connectivity not fully verified": "连通性尚未完全验证",
  "Browser probes ran, but reachability could not be fully confirmed.":
    "浏览器探测已完成，但无法完整确认可访问性。",
  "Some connectivity probes could not be fully verified.":
    "部分连通性探测无法完整验证。",
  "Public infrastructure detected. This IP appears to support DNS, CDN, edge, or other internet services.":
    "检测到公共基础设施。此 IP 可能用于 DNS、CDN、边缘节点或其他互联网服务。",
  "IP matches Google Public DNS infrastructure.":
    "此 IP 与 Google Public DNS 基础设施匹配。",
  "Public DNS, CDN, and edge infrastructure is normal for services, but it is not ideal as a personal browsing or account registration IP.":
    "公共 DNS、CDN 和边缘基础设施用于服务很正常，但不适合作为个人浏览或注册账号的 IP。",
  "Managed infrastructure pattern": "托管基础设施特征",
  "IP mismatch": "IP 信息不一致",
  "None detected": "未发现",
  "This is normal for public DNS, CDN, and edge infrastructure, but it is not ideal as a personal browsing or account registration IP.":
    "这类公共 DNS、CDN 和边缘基础设施用于服务很正常，但不适合作为个人浏览或注册账号的 IP。",
  "ASN, IPInfo, IPQS, Scamalytics, ipapi.is, connectivity, and Cloudflare":
    "ASN、IPInfo、IPQS、Scamalytics、ipapi.is、连通性与 Cloudflare",
  "ASN, IPInfo, Scamalytics, ipapi.is, connectivity, and Cloudflare":
    "ASN、IPInfo、Scamalytics、ipapi.is、连通性与 Cloudflare",
  "IP Health provides reputation-based guidance only. Services may also consider account history, device signals, payment method, browser fingerprint, and behavior.":
    "IP Health 仅提供基于声誉数据的参考建议。服务平台还可能综合账号历史、设备信号、支付方式、浏览器指纹和行为等因素。",
  "Residential ISP detected": "检测到住宅宽带",
  "Network ownership looks like a normal consumer ISP or mobile network.":
    "网络归属表现为普通消费级 ISP 或移动网络。",
  "Residential ISP detected. This IP appears to belong to a consumer broadband provider.":
    "检测到住宅宽带。此 IP 可能属于面向消费者的宽带提供商。",
  "This looks like a normal access network and is less likely to be heavily shared.":
    "这看起来是普通接入网络，被大量用户共享的可能性较低。",
  "No strong privacy or infrastructure signal":
    "未发现明显的匿名网络或基础设施信号",
  "This looks suitable for normal browsing and account use when reputation is clean. Minor review signals may still trigger extra checks on stricter platforms.":
    "在 IP 声誉良好时，适合日常浏览和账号使用。轻微复核信号仍可能在风控较严格的平台触发额外检查。",
  "IPQualityScore data is unavailable.": "IPQualityScore 数据不可用。",
  "Scamalytics data is unavailable.": "Scamalytics 数据不可用。",
  "ipapi.is data is unavailable.": "ipapi.is 数据不可用。",
  "Seen by Cloudflare trace.": "由 Cloudflare Trace 检测。",
  "No WARP detected": "未检测到 WARP",
  "Needs review": "需要复核",
  "Network integrity is unavailable right now.": "当前无法获取网络完整性数据。",
  "Tor network detected": "检测到 Tor 网络",
  "VPN or proxy network detected": "检测到 VPN 或代理网络",
  "Cloud or hosting infrastructure detected": "检测到云服务或托管基础设施",
  "Enterprise network detected": "检测到企业网络",
  "Enterprise network detected. This IP belongs to an organization-operated network.":
    "检测到企业网络。该 IP 属于由组织运营的网络。",
  "Enterprise networks are often clean, but some platforms may apply extra checks because traffic comes from a large organization or shared corporate network.":
    "企业网络通常具有良好声誉，但由于流量来自大型组织或共享的公司网络，部分平台可能会进行额外检查。",
  "Enterprise networks are often clean, but platforms may apply extra checks because traffic comes from a large organization or shared corporate network.":
    "企业网络通常具有良好声誉，但由于流量来自大型组织或共享的公司网络，平台可能会进行额外检查。",
  "Enterprise networks are often clean, but some platforms may apply extra checks to large organization or shared corporate traffic.":
    "企业网络通常具有良好声誉，但部分平台可能会对大型组织或共享公司网络的流量进行额外检查。",
  "Medium Network Quality": "中等网络质量",
  "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.":
    "该 IP 的声誉可能良好，但许多平台对托管基础设施的信任度通常低于住宅宽带流量。",
  "Cloud infrastructure detected. Often treated differently from residential ISP traffic.":
    "检测到云基础设施。此类流量通常会被平台区别于住宅宽带流量对待。",
  "Datacenter infrastructure detected. Often treated differently from residential ISP traffic.":
    "检测到数据中心基础设施。此类流量通常会被平台区别于住宅宽带流量对待。",
  "Hosted infrastructure review signal": "托管基础设施复核信号",
  "Secondary network review signal": "次要网络复核信号",
  "ipapi.is reported datacenter or hosting evidence.":
    "ipapi.is 报告了数据中心或托管基础设施证据。",
  "No hosting infrastructure signal was detected.":
    "未检测到托管基础设施信号。",
  "Mismatch signals suggest traffic may be relayed or shared across infrastructure.":
    "不一致信号表明流量可能经过中转，或在基础设施中被多个用户共享。",
  "Shared infrastructure pattern": "共享基础设施特征",
  "Network mismatch signal": "网络信息不一致信号",
  "Reputation may be clean, but many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic. Use extra caution for account registration, verification, banking, payments, and sensitive login.":
    "该 IP 的声誉可能良好，但许多平台对托管基础设施的信任度通常低于住宅宽带流量。用于账号注册、身份验证、银行、支付或敏感登录时应格外谨慎。",
  "Public infrastructure detected": "检测到公共基础设施",
  "Minor network review signals": "轻微网络复核信号",
  "Enterprise network review signals": "企业网络复核信号",
  "Regional restriction detected": "检测到区域限制",
  "Connectivity failure detected": "检测到连通性故障",
  "Connectivity verified": "连通性已验证",
  "Most tested services reachable": "大多数已测试服务均可访问",
  "Clean IP with strong compatibility": "IP 状态良好，兼容性较强",
  "All tested service probes were reachable.": "所有已测试的服务探测均可访问。",
  "Checking reputation and network identity.": "正在检查 IP 声誉与网络身份。",
  About: "关于",
  Privacy: "隐私政策",
  Disclaimer: "免责声明",
  Sponsor: "支持项目",
  "Reputation Needs Review": "IP 声誉需要复核",
  "High reputation risk detected": "检测到较高声誉风险",
  "Abuse history or reputation provider data raised a strong signal.":
    "滥用记录或声誉数据提供方报告了强风险信号。",
  "Network identity could not be confidently determined.":
    "无法可靠判断网络身份。",
  "Sharing level could not be confidently determined.":
    "无法可靠判断网络共享程度。",
  "Network identity unknown": "网络身份未知",
  "Provider data limited": "数据提供方信息有限",
  "High risk: severe abuse history was reported, so this IP is not recommended for account registration, verification, banking, payments, or sensitive login.":
    "高风险：检测到严重滥用记录，不建议将此 IP 用于账号注册、身份验证、银行、支付或敏感登录。",
  "Clean IP reputation": "IP 声誉良好",
  "Normal network path": "网络路径正常",
  "Strong compatibility": "兼容性良好",
  "Stable recent checks": "近期检测结果稳定",
  "No major risk signals detected": "未发现明显风险信号",
  "Clean abuse history": "未发现滥用记录",
  "Minor review signal": "轻微复核信号",
  "Enterprise network review": "企业网络复核信号",
  "Public infrastructure": "公共基础设施",
  "Cloud or hosting infrastructure": "云端或托管基础设施",
  "VPN or proxy signal detected": "检测到 VPN 或代理信号",
  "Tor exit signal detected": "检测到 Tor 出口节点信号",
  "Reputation risk signal": "声誉风险信号",
  "Connectivity signal detected": "检测到连通性风险信号",
  "Tor exit traffic is high risk for registration, verification, banking, payments, and sensitive login.":
    "Tor 出口流量在注册、身份验证、银行、支付及敏感登录场景中通常属于高风险信号。",
  "Some checks may require review, but this is not a strong privacy-network signal by itself.":
    "部分检测可能需要复核，但这一信号本身并不代表强匿名网络风险。",
  "Large organization and shared corporate networks can receive extra checks on some platforms.":
    "大型组织或企业共享网络在部分平台上可能触发额外验证。",
  "Normal for services and edge networks, but not ideal as a personal browsing or account registration IP.":
    "这类网络用于服务或边缘节点很正常，但不适合作为个人浏览或注册账号的 IP。",
  "Some platforms add review steps for shared cloud hosting IP ranges.":
    "部分平台会对共享云托管 IP 段增加复核步骤。",
  "Many platforms treat hosted infrastructure as less trustworthy than residential ISP traffic.":
    "许多平台对托管基础设施 IP 的信任度低于住宅宽带 IP。",
  "Some services may request additional verification.":
    "部分服务可能要求额外验证。",
  "Provider reputation data reported elevated risk.":
    "声誉数据提供方报告了较高风险。",
  "Some services may be harder to access from this network path.":
    "通过当前网络路径访问部分服务可能更困难。",
  "Reputation risk is the main issue for this IP.":
    "该 IP 的主要问题是声誉风险。",
  "Some data sources unavailable:": "部分数据源不可用：",
  "Important data sources were unavailable:": "部分重要数据源不可用：",
  "IPQS reputation data was unavailable": "IPQS 声誉数据不可用",
  "Scamalytics was available": "Scamalytics 可用",
  "ipapi.is was available": "ipapi.is 可用",
  "Scamalytics and ipapi.is secondary data were unavailable":
    "Scamalytics 与 ipapi.is 辅助数据不可用",
  "Connectivity probes were partially verified": "连通性探测已完成部分验证",
  "Limited Network Quality": "网络质量受限",
  "Confidence pending": "可信度待定",
  "No major review signals detected": "未发现明显需复核信号",
  "Proxy detected": "检测到代理",
  "VPN detected": "检测到 VPN",
  "Tor detected": "检测到 Tor",
  "Relay detected": "检测到中继",
  "WARP enabled": "WARP 已启用",
  "IPQS fraud score": "IPQS 风险评分",
  "Scamalytics risk score": "Scamalytics 风险评分",
  "ipapi.is Tor signal": "ipapi.is Tor 信号",
  "Enterprise network review signal": "企业网络复核信号",
  "ipapi.is VPN/proxy signal": "ipapi.is VPN/代理信号",
  "ipapi.is abuse signal": "ipapi.is 滥用信号",
  "Minor network review signal": "轻微网络复核信号",
  "Hosted infrastructure": "托管基础设施",
  "Hosting infrastructure": "托管基础设施",
  "ipapi.is hosting signal": "ipapi.is 托管服务信号",
  "Infrastructure route": "基础设施路由",
  "Secondary privacy review signal": "次要隐私网络复核信号",
  "Relay or multi-user access signal": "中继或多用户访问信号",
  "Infrastructure route detected": "检测到基础设施路由",
  "No strong sharing signal detected": "未检测到明显共享信号",
  "IP Address": "IP 地址",
  "Enter an IP address or analyze your current IP to see IP quality and compatibility.":
    "输入 IP 地址或分析当前 IP，以查看 IP 质量和兼容性。",
  "Score details will appear here after analysis.":
    "分析完成后将在此显示评分详情。",
  "Run an analysis to see score details.": "请先运行分析以查看评分详情。",
  Expand: "展开",
  Collapse: "收起",
  proxy: "代理",
  relay: "中继",
  "Traffic appears to be routed through a proxy service.":
    "流量似乎通过代理服务进行路由。",
  "Traffic appears to be routed through a VPN service.":
    "流量似乎通过 VPN 服务进行路由。",
  "Tor exit traffic is a strong risk signal for many services.":
    "Tor 出口流量对许多服务而言是强风险信号。",
  "Relay traffic can make the origin of activity harder to verify.":
    "中继流量会增加验证活动来源的难度。",
  "Cloudflare reports WARP is active for this network path.":
    "Cloudflare 报告当前网络路径已启用 WARP。",
  "A secondary provider reported a privacy review signal, but the primary classification remains a normal access network.":
    "辅助数据提供方报告了隐私网络复核信号，但主要分类仍为普通接入网络。",
  "A secondary provider reported a privacy review signal. Large organization and shared corporate traffic can receive extra checks.":
    "辅助数据提供方报告了隐私网络复核信号。大型组织和企业共享流量可能触发额外检查。",
  "ipapi.is reports this IP is linked to abusive activity.":
    "ipapi.is 报告此 IP 与滥用活动有关。",
  "Traffic comes from a large organization or shared corporate network, which some platforms review more closely.":
    "流量来自大型组织或企业共享网络，部分平台会对此进行更严格的复核。",
  "This is normal for public DNS, CDN, or edge services, but not ideal for personal browsing or account registration.":
    "这对公共 DNS、CDN 或边缘服务而言很正常，但不适合个人浏览或账号注册。",
  "This is normal for public DNS, CDN, and edge services, but it is not ideal as a personal browsing or account registration IP.":
    "这类公共 DNS、CDN 和边缘服务用于服务很正常，但不适合作为个人浏览或注册账号的 IP。",
  "A secondary provider reported an infrastructure review signal, but the primary classification remains a normal access network.":
    "辅助数据提供方报告了基础设施复核信号，但主要分类仍为普通接入网络。",
  "A secondary provider reported an infrastructure review signal. Enterprise traffic can receive extra checks because it comes from a shared corporate network.":
    "辅助数据提供方报告了基础设施复核信号。企业流量来自共享公司网络，因此可能触发额外检查。",
  "ipapi.is reports datacenter or hosting infrastructure.":
    "ipapi.is 报告此 IP 属于数据中心或托管基础设施。",
  "Cloudflare reported an edge routing signal, which is expected for service infrastructure.":
    "Cloudflare 报告了边缘路由信号，这符合服务基础设施的预期。",
  "Cloudflare reported an edge routing signal. Enterprise traffic may receive extra checks when network paths are shared.":
    "Cloudflare 报告了边缘路由信号。企业流量在共享网络路径时可能触发额外检查。",
  "Cloudflare reported an edge routing signal. Some checks may require review, but the primary classification remains a normal access network.":
    "Cloudflare 报告了边缘路由信号。部分检测可能需要复核，但主要分类仍为普通接入网络。",
  "Cloudflare detected an edge routing signal.":
    "Cloudflare 检测到边缘路由信号。",
  "IP matches Cloudflare DNS public resolver infrastructure.":
    "此 IP 与 Cloudflare DNS 公共解析器基础设施匹配。",
  "IP matches Quad9 public resolver infrastructure.":
    "此 IP 与 Quad9 公共解析器基础设施匹配。",
  "IP matches Cisco OpenDNS public resolver infrastructure.":
    "此 IP 与 Cisco OpenDNS 公共解析器基础设施匹配。",
  "ipapi.is marks this IP as Tor exit traffic.":
    "ipapi.is 将此 IP 标记为 Tor 出口流量。",
  "ipapi.is marks this IP as VPN or proxy traffic.":
    "ipapi.is 将此 IP 标记为 VPN 或代理流量。",
  "A provider applied a VPN or proxy label, but this IP is a known public service endpoint rather than evidence of a personal VPN connection.":
    "数据提供方为此 IP 添加了 VPN 或代理标签，但该 IP 是已知公共服务端点，并不能证明用户正在使用个人 VPN。",
  "ipapi.is applied a VPN or proxy label, but the primary classification remains known public service infrastructure.":
    "ipapi.is 添加了 VPN 或代理标签，但主要分类仍为已知公共服务基础设施。",
  "A provider applied a VPN or proxy label, but this known public service endpoint should not be interpreted as a personal VPN connection.":
    "数据提供方添加了 VPN 或代理标签，但这个已知公共服务端点不应被理解为个人 VPN 连接。",
  "IPQS reputation data is unavailable, so analysis continued without it.":
    "IPQS 声誉数据不可用，分析已在缺少该数据的情况下继续。",
  "Scamalytics reputation data is unavailable, so analysis continued without it.":
    "Scamalytics 声誉数据不可用，分析已在缺少该数据的情况下继续。",
  "ipapi.is data is unavailable, so analysis continued without it.":
    "ipapi.is 数据不可用，分析已在缺少该数据的情况下继续。",
  "ipapi.is reported a Tor exit signal.": "ipapi.is 报告了 Tor 出口信号。",
  "ipapi.is reported a secondary review signal; the primary classification remains a normal access network.":
    "ipapi.is 报告了次要复核信号；主要分类仍为普通接入网络。",
  "ipapi.is reported a secondary review signal; enterprise traffic can still receive extra checks on some platforms.":
    "ipapi.is 报告了次要复核信号；企业流量在部分平台仍可能触发额外检查。",
  "ipapi.is reported VPN, proxy, or Tor review signals.":
    "ipapi.is 报告了 VPN、代理或 Tor 复核信号。",
  "ipapi.is reported a secondary infrastructure signal; the primary classification remains an enterprise network.":
    "ipapi.is 报告了次要基础设施信号；主要分类仍为企业网络。",
  "ipapi.is reported service infrastructure, which is expected for public DNS, CDN, or edge networks.":
    "ipapi.is 报告了服务基础设施，这符合公共 DNS、CDN 或边缘网络的预期。",
  "ipapi.is reported a secondary infrastructure signal; some checks may require review.":
    "ipapi.is 报告了次要基础设施信号；部分检测可能需要复核。",
  "ipapi.is returned no VPN, proxy, Tor, or hosting signal.":
    "ipapi.is 未返回 VPN、代理、Tor 或托管服务信号。",
  "Cloudflare WARP is active, which increases network risk.":
    "Cloudflare WARP 已启用，这会增加网络风险。",
  "Cloudflare WARP is not active.": "Cloudflare WARP 未启用。",
  "Some infrastructure checks may require review, but network ownership still looks like a normal access network.":
    "部分基础设施检测可能需要复核，但网络归属仍表现为普通接入网络。",
  "Network integrity signals suggest infrastructure routing, which stricter services may review.":
    "网络完整性信号表明存在基础设施路由，风控较严格的服务可能会进行复核。",
  "Cloudflare and IPinfo agree on the visible IP.":
    "Cloudflare 与 IPinfo 对可见 IP 的检测结果一致。",
  "Cloudflare and IPinfo report different visible IPs.":
    "Cloudflare 与 IPinfo 报告了不同的可见 IP。",
  "ASN/ISP is unknown, so ownership confidence is lower.":
    "ASN/ISP 未知，因此网络归属可信度较低。",
  "DNS is present and does not show an obvious conflict.":
    "DNS 信息存在，且未显示明显冲突。",
  "DNS consistency could not be confirmed.": "无法确认 DNS 一致性。",
};

const zhFragments: ReadonlyArray<readonly [string, string]> = [
  [
    "Reputation risk is the main issue for this IP. ",
    "该 IP 的主要问题是声誉风险。",
  ],
  ["Some data sources unavailable: ", "部分数据源不可用："],
  ["Important data sources were unavailable: ", "部分重要数据源不可用："],
  [
    "Insufficient evidence for a high-confidence assessment. ",
    "证据不足，无法做出高可信度评估。",
  ],
  ["A reputation data source was unavailable; ", "一个声誉数据源不可用；"],
  ["IPQS reputation data was unavailable; ", "IPQS 声誉数据不可用；"],
  ["Scamalytics was available. ", "Scamalytics 可用。"],
  [
    "Connectivity probes were partially verified.",
    "连通性探测已完成部分验证。",
  ],
];

export function localizeText(locale: Locale, value: string): string {
  if (locale === "en" || !value) return value;
  if (zh[value]) return zh[value];

  const sentences = value.split(/(?<=\.)\s+/).filter(Boolean);
  if (sentences.length > 1) {
    return sentences.map((sentence) => localizeText(locale, sentence)).join("");
  }

  if (value.endsWith(".") && zh[value.slice(0, -1)]) {
    return `${zh[value.slice(0, -1)]}。`;
  }

  const unavailableSummary = value.match(
    /^(Some data sources unavailable:|Important data sources were unavailable:)\s+(.+)$/,
  );
  if (unavailableSummary) {
    return `${localizeText(locale, unavailableSummary[1])}${localizeText(locale, unavailableSummary[2])}`;
  }

  const cleanReputationSummary = value.match(
    /^Reputation signals are clean, but (.+)\.$/,
  );
  if (cleanReputationSummary) {
    const networkSummary = cleanReputationSummary[1];
    const localizedNetworkSummary = localizeText(
      locale,
      networkSummary.charAt(0).toUpperCase() + networkSummary.slice(1),
    );
    return `声誉信号良好，但${localizedNetworkSummary}。`;
  }

  const compound = value.match(/^(.+?) · (.+)$/);
  if (compound) {
    return `${localizeText(locale, compound[1])} · ${compound[2]}`;
  }

  const localizedFragments = zhFragments.reduce(
    (text, [english, chinese]) => text.replaceAll(english, chinese),
    value,
  );

  return localizedFragments
    .replace(
      /^Abuse history is (low|elevated|high) at (\d+)% confidence\.$/,
      (_, level, confidence) =>
        `滥用记录${level === "low" ? "较低" : level === "elevated" ? "有所升高" : "较高"}，可信度为 ${confidence}%。`,
    )
    .replace(/^IPQS fraud score is (\d+)\/100\.$/, "IPQS 风险评分为 $1/100。")
    .replace(
      /^Scamalytics risk score is (\d+)\/100\.$/,
      "Scamalytics 风险评分为 $1/100。",
    )
    .replace(/^(.+) detected\.$/, (_, signals) => {
      const localized = signals
        .split(/, | and /)
        .map((signal: string) => zh[signal] ?? signal)
        .join("、");
      return `检测到${localized}。`;
    })
    .replace(
      /^Network usage looks like (.+), which stricter services may review\.$/,
      (_, usageType) =>
        `网络使用类型表现为${localizeText(locale, usageType)}，风控较严格的服务可能会进行复核。`,
    )
    .replace(/^Network owner is visible: (.+)\.$/, "网络归属可见：$1。")
    .replace(/^(.+) confidence reported\.$/, (_, level) => {
      const confidence = level
        .replace(/^Low, /, "较低，")
        .replace(/^Elevated, /, "偏高，")
        .replace(/^High, /, "较高，")
        .replace(/^No abuse score$/, "无滥用评分");
      return `报告的滥用可信度：${confidence}。`;
    })
    .replace(
      /^Cloudflare reports edge routing through (.+), which is expected for service infrastructure\.$/,
      "Cloudflare 报告流量经由 $1 进行边缘路由，这符合服务基础设施的预期。",
    )
    .replace(
      /^Cloudflare routed this IP through (.+)\.$/,
      "Cloudflare 通过 $1 路由此 IP。",
    )
    .replace(
      /^Confidence: (.+)$/,
      (_, level) => `可信度：${zh[level] ?? level}`,
    )
    .replace(/^Abuse history: (.+)$/, "滥用记录：$1")
    .replace(/^Low IPQS risk score (.+)$/, "IPQS 风险评分较低：$1")
    .replace(/^IPQS risk score: (.+)$/, "IPQS 风险评分：$1")
    .replace(
      /^Provider data identifies (.+) as a residential ISP\.$/,
      "数据提供方将 $1 识别为住宅宽带 ISP。",
    )
    .replace(
      /^Provider data identifies (.+) as a mobile network\.$/,
      "数据提供方将 $1 识别为移动网络。",
    )
    .replace(/^ASN belongs to (.+) infrastructure\.$/, "ASN 属于 $1 基础设施。")
    .replace(
      /^ASN belongs to (.+) public internet infrastructure\.$/,
      "ASN 属于 $1 公共互联网基础设施。",
    )
    .replace(
      /^IPQualityScore reports (\d+)\/100 reputation risk\.$/,
      "IPQualityScore 报告的声誉风险评分为 $1/100。",
    )
    .replace(
      /^Scamalytics reports (\d+)\/100 reputation risk\.$/,
      "Scamalytics 报告的声誉风险评分为 $1/100。",
    )
    .replace(
      /^(\d+) of (\d+) browser probes were unreachable\.$/,
      "$2 项浏览器探测中有 $1 项无法访问。",
    )
    .replace(
      /^(\d+) probes were verified reachable and (\d+) could not be fully verified by the browser\.$/,
      "已确认 $1 项可访问，另有 $2 项无法由浏览器完整验证。",
    )
    .replace(
      /Service compatibility probability is (\d+)%\./,
      "服务兼容概率为 $1%。",
    )
    .replace(
      /^Why this IP received a (\d+)\/100 IP Health Score\.$/,
      "该 IP 获得 $1/100 健康评分的原因。",
    )
    .replace(
      /^This IP has an IP quality score of (\d+)\/100, with no major reputation or abuse signals detected\.$/,
      "该 IP 的质量评分为 $1/100，未检测到明显的声誉或滥用信号。",
    )
    .replace(
      /^AbuseIPDB reports a high abuse confidence of (\d+)%\.$/,
      "AbuseIPDB 报告的滥用可信度较高，为 $1%。",
    )
    .replace(
      /^AbuseIPDB reports an elevated abuse confidence of (\d+)%\.$/,
      "AbuseIPDB 报告的滥用可信度有所升高，为 $1%。",
    )
    .replace(
      /^AbuseIPDB abuse confidence is (\d+)%\.$/,
      "AbuseIPDB 滥用可信度为 $1%。",
    )
    .replace(
      /^The usage type is (.+), which is commonly associated with hosting or infrastructure networks\.$/,
      "使用类型为 $1，通常与托管服务或基础设施网络相关。",
    )
    .replace(/^The usage type is (.+)\.$/, "使用类型为 $1。")
    .replace(
      /^Detected privacy or infrastructure signals: (.+)\.$/,
      "检测到隐私或基础设施信号：$1。",
    )
    .replace(
      /^IPQS fraud score is (\d+) \((?:high|elevated) risk\)$/,
      "IPQS 风险评分为 $1（需重点复核）",
    )
    .replace(/^IPQS fraud score is (\d+)$/, "IPQS 风险评分为 $1")
    .replace(
      /^AbuseIPDB confidence is (\d+)% \((?:high|elevated) risk\)$/,
      "AbuseIPDB 可信度为 $1%（需重点复核）",
    )
    .replace(/^AbuseIPDB confidence is (\d+)%$/, "AbuseIPDB 可信度为 $1%")
    .replace(/^AbuseIPDB ISP: (.+)$/, "AbuseIPDB ISP：$1")
    .replace(/^AbuseIPDB domain: (.+)$/, "AbuseIPDB 域名：$1")
    .replace(
      /^(IP [AB]) avoids stronger abuse or Tor signals on the other IP\.$/,
      "$1 避开了另一个 IP 上更强的滥用或 Tor 信号。",
    )
    .replace(
      /^(IP [AB]) has fewer infrastructure signals and a cleaner usage profile\.$/,
      "$1 的基础设施信号更少，使用类型更干净。",
    )
    .replace(
      /^(IP [AB]) has a higher IP Health Score and lower abuse confidence\.$/,
      "$1 的 IP 健康评分更高，滥用可信度更低。",
    )
    .replace(
      /^(IP [AB]) has a higher IP Health Score\.$/,
      "$1 的 IP 健康评分更高。",
    )
    .replace(
      /^(IP [AB]) has lower abuse confidence\.$/,
      "$1 的滥用可信度更低。",
    )
    .replace(
      /^(IP [AB]) has the stronger overall comparison signals\.$/,
      "$1 的综合对比信号更好。",
    );
}

export function messages(locale: Locale) {
  return (value: string) => localizeText(locale, value);
}
