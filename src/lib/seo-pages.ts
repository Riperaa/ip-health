import type { Locale } from "@/lib/localization";

export const seoPageSlugs = [
  "is-my-ip-clean",
  "vpn-ip-check",
  "why-is-my-ip-risky",
] as const;

export type SeoPageSlug = (typeof seoPageSlugs)[number];

type ContentItem = {
  title: string;
  body: string;
};

export type SeoContentSection = {
  title: string;
  intro?: string;
  items: ContentItem[];
  presentation?: "list" | "steps";
  note?: string;
};

export type SeoPageContent = {
  slug: SeoPageSlug;
  locale: Locale;
  eyebrow: string;
  title: string;
  metadataTitle: string;
  description: string;
  canonical: string;
  alternatePath: string;
  opening: string;
  sections: SeoContentSection[];
  cta: {
    title: string;
    body: string;
    label: string;
    href: string;
  };
  faqTitle: string;
  faq: ContentItem[];
};

type LocalizedPages = Record<SeoPageSlug, SeoPageContent>;

const englishPages: LocalizedPages = {
  "is-my-ip-clean": {
    slug: "is-my-ip-clean",
    locale: "en",
    eyebrow: "IP reputation guide",
    title: "Is My IP Clean?",
    metadataTitle:
      "Is My IP Clean? Check Reputation, Risk, and Network Identity | IP Health",
    description:
      "Check whether your IP has abuse history, VPN, proxy, hosting, sharing, or network-identity signals before using it for login, registration, payments, or remote work.",
    canonical: "/is-my-ip-clean",
    alternatePath: "/zh/is-my-ip-clean",
    opening:
      "A “clean” IP usually has low abuse history, a clear network identity, and few strong proxy, Tor, hosting, or sharing-risk signals. However, no IP score can guarantee that a platform will accept an account, payment, or login.",
    sections: [
      {
        title: "What “clean IP” really means",
        intro:
          "Clean is a useful shorthand, not a permanent or universal label.",
        items: [
          {
            title: "Clean does not mean perfect",
            body: "It means the available evidence shows fewer or weaker concerns, not that every possible risk has been ruled out.",
          },
          {
            title: "No provider has the full picture",
            body: "Reputation services use different data, update schedules, and classifications, so their conclusions can differ.",
          },
          {
            title: "Reputation changes",
            body: "New abuse reports, reassignment, or changes in network use can alter how an IP is assessed over time.",
          },
          {
            title: "Context matters",
            body: "A network that is reasonable for browsing or remote work may receive more review during payments, verification, or sensitive account changes.",
          },
        ],
      },
      {
        title: "What IP Health checks",
        items: [
          {
            title: "Reputation",
            body: "Reported abuse confidence and provider signals related to fraud, recent abuse, bots, VPNs, proxies, and Tor.",
          },
          {
            title: "Network Identity",
            body: "The most likely network type, such as residential, mobile, enterprise, public infrastructure, cloud, datacenter, VPN / proxy, or Tor.",
          },
          {
            title: "Sharing Risk",
            body: "Whether traffic may come through shared, relayed, hosted, corporate, public-service, or multi-user infrastructure.",
          },
          {
            title: "Network Quality",
            body: "Ownership clarity, ASN and organization data, infrastructure indicators, privacy-network signals, and trace context.",
          },
          {
            title: "Compatibility",
            body: "Browser-observed reachability for selected services. It does not predict whether a registration, payment, or login will be accepted.",
          },
          {
            title: "Evidence Quality",
            body: "How complete the data coverage is. It describes confidence and uncertainty, not whether the IP itself is good or bad.",
          },
        ],
      },
      {
        title: "Common signs of a risky IP",
        items: [
          {
            title: "Severe abuse history",
            body: "Recent or high-confidence reports can be a strong reputation concern.",
          },
          {
            title: "Tor, VPN, or proxy detection",
            body: "Tor exit status or confirmed privacy-network signals can lead to more cautious treatment.",
          },
          {
            title: "Hosting or datacenter infrastructure",
            body: "Some platforms review hosted networks differently from ordinary consumer access.",
          },
          {
            title: "Shared or relayed traffic",
            body: "Corporate gateways, relays, and multi-user exits can make one IP represent many unrelated users.",
          },
          {
            title: "Conflicting or limited evidence",
            body: "Provider mismatch and low Evidence Quality increase uncertainty and call for more context.",
          },
        ],
        note: "Infrastructure and privacy signals are not automatically malicious. They describe how the network appears and how it may be reviewed.",
      },
      {
        title: "Common misunderstandings",
        items: [
          {
            title: "Residential does not always mean clean",
            body: "A residential IP can still have recent abuse reports, shared use, or inconsistent provider evidence.",
          },
          {
            title: "Datacenter does not always mean malicious",
            body: "Cloud and hosted networks support legitimate services, development, and business workloads.",
          },
          {
            title: "VPN use does not automatically mean fraud",
            body: "VPNs are legitimate privacy and remote-access tools, although their exit IPs may be shared or hosted.",
          },
          {
            title: "A high score is not approval",
            body: "Platforms also evaluate account, device, behavior, payment, and private risk signals that IP Health cannot see.",
          },
          {
            title: "A low score is not proof",
            body: "Risk signals describe the IP and its available evidence; they do not establish wrongdoing by a user.",
          },
        ],
      },
      {
        title: "How to interpret the result",
        presentation: "steps",
        items: [
          {
            title: "Check the overall score",
            body: "Use it as a summary, not a guarantee.",
          },
          {
            title: "Read Evidence Quality",
            body: "Understand how complete and certain the report is.",
          },
          {
            title: "Review Network Identity",
            body: "See what kind of network the IP most likely belongs to.",
          },
          {
            title: "Review Sharing Risk",
            body: "Look for shared, relayed, hosted, or multi-user context.",
          },
          {
            title: "Read the recommendation",
            body: "Focus on the strongest evidence behind the guidance.",
          },
          {
            title: "Consider the intended use",
            body: "Apply more caution to payment, identity, and security-sensitive activity.",
          },
        ],
      },
    ],
    cta: {
      title: "Check your IP now",
      body: "Run a free IP Health analysis to review reputation, network identity, evidence quality, and risk signals.",
      label: "Check My IP",
      href: "/",
    },
    faqTitle: "Clean IP questions",
    faq: [
      {
        title: "Can a residential IP still be risky?",
        body: "Yes. Residential classification describes network type, not reputation. A residential IP may still have abuse reports, shared use, or conflicting evidence.",
      },
      {
        title: "Is a datacenter IP always bad?",
        body: "No. Datacenter IPs are normal for cloud services, hosting, development, and business systems. Some consumer platforms may review them more closely because they are not typical household access networks.",
      },
      {
        title: "Does changing IP improve reputation?",
        body: "A different IP has a different history and network context, but it is not automatically better. Review the new IP on its own and follow the rules of the service you use.",
      },
      {
        title: "How often can IP reputation change?",
        body: "It can change whenever providers receive new reports, refresh classifications, or observe that an address has been reassigned. Update timing differs by provider.",
      },
      {
        title: "Can a high score guarantee account approval?",
        body: "No. A platform may also use device, account, behavior, payment, location, and private risk signals that are outside an IP check.",
      },
      {
        title: "What does low evidence quality mean?",
        body: "It means important data was unavailable or incomplete, so the result is less certain. It does not automatically mean the IP is risky.",
      },
    ],
  },
  "vpn-ip-check": {
    slug: "vpn-ip-check",
    locale: "en",
    eyebrow: "VPN exit assessment",
    title: "VPN IP Check",
    metadataTitle:
      "VPN IP Check | Test Reputation, Sharing, and Hosting Signals | IP Health",
    description:
      "Check whether a VPN exit IP appears shared, hosted, abused, proxied, or likely to receive extra review from stricter platforms.",
    canonical: "/vpn-ip-check",
    alternatePath: "/zh/vpn-ip-check",
    opening:
      "A VPN IP is not automatically unsafe. The practical risk depends on its reputation, hosting classification, sharing pattern, abuse history, and whether multiple providers identify it as VPN, proxy, Tor, or datacenter infrastructure.",
    sections: [
      {
        title: "Why platforms review VPN IPs",
        items: [
          {
            title: "One exit can serve many users",
            body: "Unrelated activity may be associated with the same public IP.",
          },
          {
            title: "Location can change abruptly",
            body: "A VPN may make a session appear to move between regions or networks.",
          },
          {
            title: "Exits often use hosted networks",
            body: "Many VPN servers run on cloud or datacenter infrastructure rather than consumer access networks.",
          },
          {
            title: "Previous users affect reputation",
            body: "Abuse by someone else can remain attached to a shared exit IP until provider data changes.",
          },
          {
            title: "Providers may disagree",
            body: "Detection sources use different evidence and update cycles, so not every VPN label will match.",
          },
          {
            title: "Some services apply extra review",
            body: "Stricter platforms may ask for more verification when network identity or session context changes.",
          },
        ],
      },
      {
        title: "What IP Health checks for VPN exits",
        items: [
          {
            title: "Abuse history",
            body: "Reported abuse confidence, recent-abuse indicators, and provider reputation risk.",
          },
          {
            title: "VPN, proxy, and Tor signals",
            body: "Direct and supporting privacy-network classifications from available sources.",
          },
          {
            title: "Hosting and datacenter evidence",
            body: "Network ownership and infrastructure fields that indicate a hosted exit.",
          },
          {
            title: "Shared or relayed infrastructure",
            body: "Signals that traffic may represent many users or pass through an intermediary.",
          },
          {
            title: "Network owner",
            body: "ASN, organization, usage type, and ownership context.",
          },
          {
            title: "Provider coverage and agreement",
            body: "Whether the available evidence is complete, consistent, or needs contextual review.",
          },
        ],
      },
      {
        title: "VPN does not equal malicious",
        items: [
          {
            title: "VPNs are legitimate privacy tools",
            body: "People use them to protect traffic, connect to work, and reduce exposure on untrusted networks.",
          },
          {
            title: "Shared networks have normal uses",
            body: "Business gateways and remote-work systems may place many legitimate users behind one address.",
          },
          {
            title: "Reputation and evidence still matter",
            body: "A clean abuse history and clear provider context make a result easier to interpret.",
          },
          {
            title: "Classification is descriptive",
            body: "A VPN, proxy, or datacenter label describes network behavior or infrastructure, not a user’s intent.",
          },
        ],
      },
      {
        title: "Use cases that may receive more review",
        intro:
          "Risk depends on the service and its policies, but extra review is more plausible during:",
        items: [
          {
            title: "New account registration",
            body: "A new identity combined with a shared or hosted exit may provide less familiar context.",
          },
          {
            title: "Identity verification",
            body: "Location and network changes may be evaluated alongside other verification signals.",
          },
          {
            title: "Payments and banking",
            body: "Financial services often apply stricter security and fraud controls.",
          },
          {
            title: "Security-sensitive changes",
            body: "Password resets, recovery, or important account changes may trigger additional checks.",
          },
          {
            title: "Sensitive login activity",
            body: "An unfamiliar network or abrupt region change can prompt a challenge on some services.",
          },
        ],
        note: "These situations do not guarantee a block or failure. Each platform uses its own private rules and additional signals.",
      },
      {
        title: "Use cases that are often less sensitive",
        items: [
          {
            title: "General browsing",
            body: "Routine reading and research usually involve fewer identity or payment checks.",
          },
          {
            title: "Remote work",
            body: "Organizations commonly use VPNs for secure access, subject to their own policies.",
          },
          {
            title: "Public Wi-Fi protection",
            body: "A VPN can reduce local-network exposure on an untrusted connection.",
          },
          {
            title: "Privacy-preserving access",
            body: "Users may choose a VPN to limit disclosure of their direct network address.",
          },
          {
            title: "Development and testing",
            body: "Hosted and VPN networks are common in legitimate technical workflows.",
          },
        ],
        note: "The rules and acceptable-use policies of each platform still apply.",
      },
      {
        title: "What to do if the VPN IP looks risky",
        presentation: "steps",
        items: [
          {
            title: "Review the strongest signals",
            body: "Separate direct abuse or privacy-network evidence from secondary review context.",
          },
          {
            title: "Check abuse severity",
            body: "Recent or high-confidence abuse deserves more attention than a generic infrastructure label.",
          },
          {
            title: "Compare available exits",
            body: "Assess other exit IPs on their own; do not assume every server from a provider has the same profile.",
          },
          {
            title: "Prefer stable, reputable services",
            body: "Choose providers with clear policies, reliable operations, and appropriate support.",
          },
          {
            title: "Pause sensitive use if uncertain",
            body: "Understand the signals and the platform’s rules before payments, verification, or security changes.",
          },
        ],
      },
    ],
    cta: {
      title: "Check this VPN IP",
      body: "Use IP Health to review the exit IP’s reputation, network identity, sharing risk, and evidence quality.",
      label: "Check VPN IP",
      href: "/",
    },
    faqTitle: "VPN IP questions",
    faq: [
      {
        title: "Is every VPN IP blocked?",
        body: "No. Treatment varies by platform, exit reputation, network context, account activity, and other private signals. A VPN label alone does not guarantee a block.",
      },
      {
        title: "Why does a VPN IP look like a datacenter?",
        body: "Many VPN operators run exit servers on cloud or hosted infrastructure. VPN and datacenter labels can therefore both describe the same IP from different angles.",
      },
      {
        title: "Can one bad user damage an exit IP’s reputation?",
        body: "Yes. When many users share an exit, reported abuse from one user can affect how the public IP is viewed until reputation data is updated.",
      },
      {
        title: "Is a dedicated VPN IP always better?",
        body: "No. Dedicated use may reduce sharing, but the address can still be hosted, previously abused, misclassified, or unsuitable for a particular platform.",
      },
      {
        title: "Why do providers disagree about VPN detection?",
        body: "Providers use different data sources, definitions, and refresh schedules. One may identify a known exit while another sees only its hosting network.",
      },
      {
        title: "Does a VPN change my IP reputation?",
        body: "A VPN presents the exit IP’s reputation to external services; it does not rewrite the reputation of your original IP or guarantee that the exit has a better profile.",
      },
    ],
  },
  "why-is-my-ip-risky": {
    slug: "why-is-my-ip-risky",
    locale: "en",
    eyebrow: "Risk signal guide",
    title: "Why Is My IP Risky?",
    metadataTitle:
      "Why Is My IP Risky? Common Reputation and Network Signals | IP Health",
    description:
      "Learn why an IP may receive a low score or high-risk label, including abuse history, VPN, proxy, Tor, hosting, shared infrastructure, and provider mismatch signals.",
    canonical: "/why-is-my-ip-risky",
    alternatePath: "/zh/why-is-my-ip-risky",
    opening:
      "An IP can look risky because of abuse history, VPN or proxy detection, Tor exit status, hosting or datacenter infrastructure, shared routing, or conflicting provider evidence. A risk signal does not automatically mean the user is malicious.",
    sections: [
      {
        title: "Common reasons for a low score",
        items: [
          {
            title: "Severe abuse reports",
            body: "High-confidence or recent reports can directly increase reputation concern.",
          },
          {
            title: "High provider risk scores",
            body: "Fraud, abuse, bot, or reputation services may report elevated risk.",
          },
          {
            title: "Tor exit classification",
            body: "Tor exit traffic is a strong privacy-network and sharing signal.",
          },
          {
            title: "Confirmed VPN or proxy signals",
            body: "Direct detection can affect both reputation context and network identity.",
          },
          {
            title: "Datacenter or hosting network",
            body: "Hosted infrastructure may be less typical for personal account access and can receive extra review.",
          },
          {
            title: "Shared or relayed traffic",
            body: "One IP may represent an enterprise, relay, gateway, or many unrelated users.",
          },
          {
            title: "Network mismatch",
            body: "Providers or trace observations may not agree on the address or network context.",
          },
          {
            title: "Limited or conflicting evidence",
            body: "Low Evidence Quality and provider disagreement increase uncertainty, even when they do not prove risk by themselves.",
          },
        ],
      },
      {
        title: "Strong signals vs review signals",
        items: [
          {
            title: "Strong: severe abuse history",
            body: "Recent or high-confidence abuse can directly drive a risk assessment.",
          },
          {
            title: "Strong: Tor exit",
            body: "Direct Tor classification indicates anonymized, shared exit traffic.",
          },
          {
            title: "Strong: confirmed VPN or proxy",
            body: "Direct identity checks identifying privacy or relay traffic carry more weight.",
          },
          {
            title: "Strong: clear hosting infrastructure",
            body: "A well-supported datacenter or hosting identity can matter when the intended use expects consumer access.",
          },
          {
            title: "Review: provider mismatch",
            body: "Different provider views need context and may reflect data timing or routing differences.",
          },
          {
            title: "Review: partial coverage",
            body: "Source failure or incomplete ownership data reduces confidence rather than proving the IP is bad.",
          },
          {
            title: "Review: shared routing",
            body: "Enterprise, public, edge, or multi-user networks can be legitimate while still requiring caution.",
          },
          {
            title: "Review: secondary flags",
            body: "A single provider’s supporting privacy or infrastructure flag should be interpreted alongside stronger evidence.",
          },
        ],
        note: "Review signals require context. They should not be treated as proof of malicious behavior.",
      },
      {
        title: "Why a clean-looking IP can still be reviewed",
        items: [
          {
            title: "Residential with recent abuse",
            body: "Consumer network identity does not erase a current reputation concern.",
          },
          {
            title: "Enterprise with shared users",
            body: "A legitimate workplace gateway may represent many people and devices.",
          },
          {
            title: "Clean cloud infrastructure",
            body: "An address can have no meaningful abuse history yet still be classified as hosted.",
          },
          {
            title: "CDN or public infrastructure",
            body: "A legitimate public-service endpoint may be unsuitable as a personal account access IP.",
          },
          {
            title: "Old data after reassignment",
            body: "Some reputation records may persist temporarily after an address changes users or purpose.",
          },
        ],
      },
      {
        title: "What Evidence Quality changes",
        items: [
          {
            title: "High",
            body: "Network ownership, abuse history, and at least one secondary reputation source were available without a recorded coverage gap.",
          },
          {
            title: "Medium",
            body: "Some evidence was unavailable or partial, but enough fallback reputation and network context remained for a useful assessment.",
          },
          {
            title: "Low",
            body: "Important sources were unavailable or incomplete, so the result carries more uncertainty.",
          },
        ],
        note: "Low Evidence Quality means “less certain,” not “bad IP.”",
      },
      {
        title: "When to take the result seriously",
        items: [
          {
            title: "Severe abuse history",
            body: "Recent, repeated, or high-confidence reports deserve careful review.",
          },
          {
            title: "Tor exit status",
            body: "This is a strong indicator of anonymized and shared exit traffic.",
          },
          {
            title: "Provider agreement",
            body: "Multiple sources agreeing on VPN or proxy detection strengthens the signal.",
          },
          {
            title: "High Sharing Risk",
            body: "Relayed, hosted, or multi-user traffic may be treated more cautiously.",
          },
          {
            title: "Repeated mismatch",
            body: "Consistent disagreement across address, owner, or routing observations may warrant investigation.",
          },
          {
            title: "Sensitive intended use",
            body: "Apply greater caution to payments, identity checks, banking, or security-sensitive account activity.",
          },
        ],
      },
      {
        title: "What not to infer",
        items: [
          {
            title: "Not guilt or fraud",
            body: "An IP result cannot establish the intent or conduct of the person using it.",
          },
          {
            title: "Not a guaranteed block",
            body: "Platforms use their own rules and may accept, challenge, or review the same network differently.",
          },
          {
            title: "Not guaranteed account failure",
            body: "Account, device, behavior, payment, and verification context also affect outcomes.",
          },
          {
            title: "Not guaranteed safety",
            body: "A high score only summarizes the available IP evidence; it cannot prove that an account or transaction is safe.",
          },
        ],
      },
    ],
    cta: {
      title: "Find out why your IP looks risky",
      body: "Run a free analysis and review the strongest signals, network identity, sharing risk, and evidence quality.",
      label: "Analyze My IP",
      href: "/",
    },
    faqTitle: "IP risk questions",
    faq: [
      {
        title: "Why did my IP score change?",
        body: "Providers may receive new abuse reports, refresh network classifications, restore missing data, or observe reassignment. The available evidence can also differ between checks.",
      },
      {
        title: "Can a clean residential IP become risky?",
        body: "Yes. Network identity and reputation are different. New abuse reports, shared use, or provider evidence can change how a residential IP is assessed.",
      },
      {
        title: "Why is a cloud IP treated differently?",
        body: "Cloud addresses are hosted infrastructure and often support automated or shared workloads. Some services review them differently from ordinary home or mobile access, even when abuse history is clean.",
      },
      {
        title: "Does a high-risk score mean fraud?",
        body: "No. It means the available IP evidence contains stronger concerns or uncertainty. It does not prove fraud or malicious behavior by a user.",
      },
      {
        title: "Can different providers disagree?",
        body: "Yes. They use different sources, definitions, and update schedules. IP Health presents the available evidence together and treats some mismatches as review context.",
      },
      {
        title: "Should I change IP immediately?",
        body: "Not necessarily. First identify whether the concern is severe abuse, a strong privacy signal, normal infrastructure context, or simply limited evidence. Consider your intended use and the platform’s rules.",
      },
    ],
  },
};

const chinesePages: LocalizedPages = {
  "is-my-ip-clean": {
    slug: "is-my-ip-clean",
    locale: "zh",
    eyebrow: "IP 声誉指南",
    title: "我的 IP 干净吗？",
    metadataTitle: "我的 IP 干净吗？检查声誉、风险与网络身份 | IP Health",
    description:
      "检测你的 IP 是否存在滥用记录、VPN、代理、托管、共享或网络身份风险信号，适用于登录、注册、支付和远程办公前检查。",
    canonical: "/zh/is-my-ip-clean",
    alternatePath: "/is-my-ip-clean",
    opening:
      "一个相对“干净”的 IP，通常具有较低的滥用记录、清晰的网络身份，以及较少的代理、Tor、托管或共享风险强信号。但任何 IP 评分都不能保证平台一定接受账号、支付或登录。",
    sections: [
      {
        title: "“干净 IP”到底是什么意思",
        intro: "“干净”是便于理解的说法，并不是永久或通用的认证。",
        items: [
          {
            title: "干净不等于完美",
            body: "它表示现有证据中的问题较少或较弱，并不代表所有潜在风险都已排除。",
          },
          {
            title: "没有数据源掌握全貌",
            body: "不同声誉服务使用的数据、更新周期和分类标准不同，结论可能不一致。",
          },
          {
            title: "声誉会随时间变化",
            body: "新的滥用报告、IP 重新分配或网络用途变化，都可能影响后续判断。",
          },
          {
            title: "网络类型与用途都很重要",
            body: "适合日常浏览或远程办公的网络，在支付、验证或敏感账号操作中可能受到更多复核。",
          },
        ],
      },
      {
        title: "IP Health 检查什么",
        items: [
          {
            title: "声誉",
            body: "检查已报告的滥用可信度，以及欺诈、近期滥用、机器人、VPN、代理和 Tor 等提供方信号。",
          },
          {
            title: "网络身份",
            body: "判断最可能的网络类型，例如住宅、移动、企业、公共基础设施、云、数据中心、VPN / 代理或 Tor。",
          },
          {
            title: "共享风险",
            body: "估计流量是否来自共享、中继、托管、企业、公共服务或多用户基础设施。",
          },
          {
            title: "网络质量",
            body: "检查归属清晰度、ASN 与组织信息、基础设施标记、隐私网络信号和 Trace 上下文。",
          },
          {
            title: "兼容性",
            body: "展示浏览器对部分服务的连通性观察；它不预测注册、支付或登录是否会被接受。",
          },
          {
            title: "证据质量",
            body: "说明数据覆盖是否完整，用于表达可信度与不确定性，而不是判断 IP 本身好坏。",
          },
        ],
      },
      {
        title: "IP 风险较高的常见迹象",
        items: [
          {
            title: "严重滥用历史",
            body: "近期或高可信度的滥用报告可能构成较强的声誉风险。",
          },
          {
            title: "Tor、VPN 或代理识别",
            body: "Tor 出口状态或已确认的隐私网络信号，可能导致平台更谨慎地处理。",
          },
          {
            title: "托管或数据中心基础设施",
            body: "部分平台会以不同方式审核托管网络与普通消费级接入。",
          },
          {
            title: "共享或中继流量",
            body: "企业网关、中继和多人出口可能让同一个 IP 代表许多无关用户。",
          },
          {
            title: "证据冲突或不足",
            body: "数据源不一致和证据质量低会增加不确定性，需要结合更多上下文。",
          },
        ],
        note: "基础设施和隐私信号不等于恶意，它们描述的是网络呈现方式以及平台可能如何复核该网络。",
      },
      {
        title: "常见误解",
        items: [
          {
            title: "住宅 IP 不一定干净",
            body: "住宅 IP 仍可能存在近期滥用报告、共享使用或数据源判断冲突。",
          },
          {
            title: "数据中心 IP 不一定恶意",
            body: "云与托管网络广泛用于正常服务、开发和企业业务。",
          },
          {
            title: "使用 VPN 不等于欺诈",
            body: "VPN 是正常的隐私与远程接入工具，只是其出口 IP 可能由多人共享或位于托管网络。",
          },
          {
            title: "高分不代表一定通过",
            body: "平台还会评估 IP Health 无法看到的账号、设备、行为、支付和内部风控信号。",
          },
          {
            title: "低分不能证明违规",
            body: "风险信号描述的是 IP 及其现有证据，不能据此认定用户存在不当行为。",
          },
        ],
      },
      {
        title: "如何解读检测结果",
        presentation: "steps",
        items: [
          { title: "先看综合评分", body: "把它作为摘要，不要当作保证。" },
          {
            title: "再看证据质量",
            body: "确认报告的数据是否完整、结论有多大不确定性。",
          },
          { title: "查看网络身份", body: "了解该 IP 最可能属于哪类网络。" },
          {
            title: "查看共享风险",
            body: "留意共享、中继、托管或多用户网络背景。",
          },
          { title: "阅读使用建议", body: "重点理解建议背后的最强证据。" },
          {
            title: "结合实际用途",
            body: "支付、身份验证和敏感安全操作应采用更谨慎的标准。",
          },
        ],
      },
    ],
    cta: {
      title: "立即检查你的 IP",
      body: "免费运行 IP Health 分析，查看声誉、网络身份、证据质量与风险信号。",
      label: "检查我的 IP",
      href: "/zh",
    },
    faqTitle: "关于干净 IP 的常见问题",
    faq: [
      {
        title: "住宅 IP 也可能有风险吗？",
        body: "可能。住宅分类只说明网络类型，不代表声誉良好；它仍可能存在滥用报告、共享使用或证据冲突。",
      },
      {
        title: "数据中心 IP 一定不好吗？",
        body: "不一定。数据中心 IP 正常用于云服务、托管、开发和企业系统。部分消费平台会更严格地复核它们，因为这类地址并非典型的家庭接入。",
      },
      {
        title: "更换 IP 能改善声誉吗？",
        body: "另一个 IP 有不同的历史和网络背景，但不一定更好。应单独检查新 IP，并遵守所用平台的规则。",
      },
      {
        title: "IP 声誉多久会变化？",
        body: "当数据源收到新报告、更新分类或发现地址被重新分配时，声誉就可能变化；各数据源的更新时间并不相同。",
      },
      {
        title: "高分能保证账号通过吗？",
        body: "不能。平台还可能使用设备、账号、行为、支付、位置和内部风控信号，这些都不在单次 IP 检查范围内。",
      },
      {
        title: "证据质量低是什么意思？",
        body: "表示重要数据不可用或不完整，因此结论的不确定性更高；它不等于 IP 一定有风险。",
      },
    ],
  },
  "vpn-ip-check": {
    slug: "vpn-ip-check",
    locale: "zh",
    eyebrow: "VPN 出口评估",
    title: "VPN IP 风险检测",
    metadataTitle: "VPN IP 风险检测 | 检查声誉、共享与托管信号 | IP Health",
    description:
      "检测 VPN 出口 IP 是否存在共享、托管、滥用、代理或可能触发平台额外复核的风险信号。",
    canonical: "/zh/vpn-ip-check",
    alternatePath: "/vpn-ip-check",
    opening:
      "VPN IP 并不等于不安全。实际风险取决于它的声誉、托管分类、共享程度、滥用历史，以及多个数据源是否将其识别为 VPN、代理、Tor 或数据中心基础设施。",
    sections: [
      {
        title: "为什么平台会复核 VPN IP",
        items: [
          {
            title: "一个出口可能服务许多用户",
            body: "多个无关用户的活动可能都与同一个公网 IP 关联。",
          },
          {
            title: "位置可能突然变化",
            body: "VPN 可能让会话看起来在短时间内切换地区或网络。",
          },
          {
            title: "出口通常位于托管网络",
            body: "许多 VPN 服务器运行在云或数据中心基础设施上，而不是普通消费级网络。",
          },
          {
            title: "其他用户会影响声誉",
            body: "他人的滥用行为可能留在共享出口 IP 的记录中，直到数据源完成更新。",
          },
          {
            title: "数据源可能意见不同",
            body: "检测来源、证据和更新周期不同，因此 VPN 标记不一定完全一致。",
          },
          {
            title: "严格的服务可能额外审核",
            body: "当网络身份或会话上下文变化时，部分平台可能要求更多验证。",
          },
        ],
      },
      {
        title: "IP Health 如何检查 VPN 出口",
        items: [
          {
            title: "滥用历史",
            body: "检查滥用可信度、近期滥用标记和数据源声誉风险。",
          },
          {
            title: "VPN、代理与 Tor 信号",
            body: "综合可用数据中的直接识别与辅助隐私网络分类。",
          },
          {
            title: "托管与数据中心证据",
            body: "通过网络归属和基础设施字段识别托管出口。",
          },
          {
            title: "共享或中继基础设施",
            body: "判断流量是否可能代表多人，或经过中间网络。",
          },
          {
            title: "网络归属",
            body: "查看 ASN、组织、使用类型和所有者上下文。",
          },
          {
            title: "数据覆盖与一致性",
            body: "判断现有证据是否完整、一致，或需要结合上下文复核。",
          },
        ],
      },
      {
        title: "VPN 不等于恶意",
        items: [
          {
            title: "VPN 是正常的隐私工具",
            body: "人们会用它保护网络流量、连接工作环境，或降低不可信网络带来的暴露。",
          },
          {
            title: "共享网络有合理用途",
            body: "企业网关和远程办公系统通常会让多个正常用户共用一个地址。",
          },
          {
            title: "声誉和证据仍然重要",
            body: "干净的滥用历史与清晰的数据上下文会让结果更容易判断。",
          },
          {
            title: "分类只是描述",
            body: "VPN、代理或数据中心标签描述的是网络行为或基础设施，而不是用户意图。",
          },
        ],
      },
      {
        title: "可能受到更多复核的场景",
        intro: "实际风险取决于服务及其规则，但以下操作更可能触发额外检查：",
        items: [
          {
            title: "注册新账号",
            body: "新身份加上共享或托管出口，可能缺少平台熟悉的网络上下文。",
          },
          {
            title: "身份验证",
            body: "平台可能把位置和网络变化与其他验证信号一起评估。",
          },
          {
            title: "支付与银行服务",
            body: "金融服务通常采用更严格的安全与反欺诈控制。",
          },
          {
            title: "敏感安全操作",
            body: "重置密码、恢复账号或重要账号变更可能触发额外检查。",
          },
          {
            title: "敏感登录活动",
            body: "陌生网络或地区突然变化，可能让部分服务要求验证。",
          },
        ],
        note: "这些场景并不代表一定被拦截或失败。各平台会使用自己的内部规则和其他信号。",
      },
      {
        title: "通常敏感度较低的场景",
        items: [
          {
            title: "日常浏览",
            body: "一般的信息阅读与查询通常不涉及身份或支付检查。",
          },
          {
            title: "远程办公",
            body: "企业普遍使用 VPN 进行安全访问，但仍应遵守组织政策。",
          },
          {
            title: "保护公共 Wi-Fi 连接",
            body: "VPN 可以降低不可信本地网络带来的流量暴露。",
          },
          {
            title: "注重隐私的访问",
            body: "用户可能通过 VPN 减少直接网络地址的暴露。",
          },
          {
            title: "开发与测试",
            body: "托管网络和 VPN 在正常技术工作中很常见。",
          },
        ],
        note: "无论用途如何，都应遵守各平台的规则与可接受使用政策。",
      },
      {
        title: "如果 VPN IP 风险较高，该怎么做",
        presentation: "steps",
        items: [
          {
            title: "先看最强信号",
            body: "区分直接滥用或隐私网络证据与辅助复核信息。",
          },
          {
            title: "确认滥用严重程度",
            body: "近期或高可信度的滥用记录，比通用基础设施标签更值得关注。",
          },
          {
            title: "比较可用出口",
            body: "单独评估其他出口 IP，不要假设同一服务商的所有服务器表现相同。",
          },
          {
            title: "选择稳定可靠的服务",
            body: "优先考虑政策透明、运营稳定且支持渠道清晰的服务商。",
          },
          {
            title: "不确定时暂停敏感操作",
            body: "在支付、验证或安全变更前，先理解信号并确认平台规则。",
          },
        ],
      },
    ],
    cta: {
      title: "检查这个 VPN IP",
      body: "使用 IP Health 查看出口 IP 的声誉、网络身份、共享风险和证据质量。",
      label: "检测 VPN IP",
      href: "/zh",
    },
    faqTitle: "关于 VPN IP 的常见问题",
    faq: [
      {
        title: "所有 VPN IP 都会被拦截吗？",
        body: "不会。处理方式取决于平台、出口声誉、网络背景、账号活动和其他内部信号；单独的 VPN 标签不能保证一定被拦截。",
      },
      {
        title: "为什么 VPN IP 会显示为数据中心？",
        body: "许多 VPN 运营商把出口服务器部署在云或托管基础设施上，因此 VPN 与数据中心标签可以从不同角度同时描述一个 IP。",
      },
      {
        title: "一个不良用户会影响出口 IP 声誉吗？",
        body: "可能。当多人共享出口时，某个用户产生的滥用报告可能影响整个公网 IP，直到声誉数据更新。",
      },
      {
        title: "独享 VPN IP 一定更好吗？",
        body: "不一定。独享可能减少共享，但地址仍可能属于托管网络、存在旧滥用记录、被误分类，或不适合特定平台。",
      },
      {
        title: "为什么不同数据源对 VPN 的判断不一致？",
        body: "各数据源使用不同资料、定义和更新周期。有的能识别已知出口，有的可能只识别出其托管网络。",
      },
      {
        title: "VPN 会改变我的 IP 声誉吗？",
        body: "外部服务看到的是 VPN 出口 IP 的声誉；VPN 不会改写原始 IP 的声誉，也不能保证出口表现更好。",
      },
    ],
  },
  "why-is-my-ip-risky": {
    slug: "why-is-my-ip-risky",
    locale: "zh",
    eyebrow: "风险信号指南",
    title: "为什么我的 IP 被判定为高风险？",
    metadataTitle:
      "为什么我的 IP 被判定为高风险？常见声誉与网络信号 | IP Health",
    description:
      "了解 IP 低分或高风险标签的常见原因，包括滥用记录、VPN、代理、Tor、托管、共享基础设施和数据源不一致信号。",
    canonical: "/zh/why-is-my-ip-risky",
    alternatePath: "/why-is-my-ip-risky",
    opening:
      "IP 可能因为滥用记录、VPN 或代理识别、Tor 出口状态、托管或数据中心基础设施、共享路由，或数据源判断冲突而被标记为高风险。风险信号并不等于用户存在恶意行为。",
    sections: [
      {
        title: "低分的常见原因",
        items: [
          {
            title: "严重滥用报告",
            body: "高可信度或近期报告可能直接增加声誉风险。",
          },
          {
            title: "数据源风险评分较高",
            body: "欺诈、滥用、机器人或声誉服务可能报告偏高风险。",
          },
          {
            title: "Tor 出口分类",
            body: "Tor 出口流量属于较强的隐私网络与共享信号。",
          },
          {
            title: "已确认的 VPN 或代理信号",
            body: "直接识别结果可能同时影响声誉背景与网络身份。",
          },
          {
            title: "数据中心或托管网络",
            body: "托管基础设施并非典型个人接入，可能受到更多复核。",
          },
          {
            title: "共享或中继流量",
            body: "一个 IP 可能代表企业、中继、网关或大量无关用户。",
          },
          {
            title: "网络不一致",
            body: "不同数据源或 Trace 观察到的地址、归属或网络上下文可能不一致。",
          },
          {
            title: "证据不足或冲突",
            body: "证据质量低和数据源分歧会增加不确定性，但它们本身不等于恶意。",
          },
        ],
      },
      {
        title: "强信号与复核信号",
        items: [
          {
            title: "强信号：严重滥用历史",
            body: "近期或高可信度的滥用记录可以直接影响风险判断。",
          },
          {
            title: "强信号：Tor 出口",
            body: "直接 Tor 分类表示流量来自匿名且共享的出口。",
          },
          {
            title: "强信号：已确认 VPN 或代理",
            body: "直接身份检查识别出的隐私或中继流量权重更高。",
          },
          {
            title: "强信号：明确的托管基础设施",
            body: "当用途通常要求消费级接入时，证据充分的数据中心或托管身份会更重要。",
          },
          {
            title: "复核信号：数据源不一致",
            body: "不同判断需要结合上下文，可能由数据更新时间或路由差异造成。",
          },
          {
            title: "复核信号：覆盖不完整",
            body: "数据源失败或归属信息不完整会降低可信度，而不是直接证明 IP 很差。",
          },
          {
            title: "复核信号：共享路由",
            body: "企业、公共、边缘或多用户网络可能完全正常，但仍需谨慎理解。",
          },
          {
            title: "复核信号：单一辅助标记",
            body: "某个数据源的辅助隐私或基础设施标记，应与更强的证据一起判断。",
          },
        ],
        note: "复核信号需要结合上下文，不能把它们当作恶意行为的证据。",
      },
      {
        title: "为什么看起来干净的 IP 仍会被复核",
        items: [
          {
            title: "住宅 IP 存在近期滥用",
            body: "消费级网络身份不会消除当前的声誉问题。",
          },
          {
            title: "企业网络由多人共享",
            body: "正常的办公网关可能代表许多用户和设备。",
          },
          {
            title: "声誉干净的云基础设施",
            body: "一个地址即使没有明显滥用历史，仍可能被正确识别为托管网络。",
          },
          {
            title: "CDN 或公共基础设施",
            body: "合法的公共服务端点可能并不适合作为个人账号的接入 IP。",
          },
          {
            title: "重新分配后的旧声誉数据",
            body: "IP 更换用户或用途后，部分旧记录可能仍会保留一段时间。",
          },
        ],
      },
      {
        title: "证据质量会带来什么影响",
        items: [
          {
            title: "高",
            body: "网络归属、滥用历史以及至少一个辅助声誉数据源均可用，且没有记录到覆盖缺口。",
          },
          {
            title: "中",
            body: "部分证据不可用或不完整，但仍有足够的备用声誉与网络上下文形成有参考价值的评估。",
          },
          {
            title: "低",
            body: "重要数据源不可用或不完整，因此结果的不确定性更高。",
          },
        ],
        note: "证据质量低表示“确定性较低”，不等于“IP 很差”。",
      },
      {
        title: "什么时候应认真看待结果",
        items: [
          {
            title: "严重滥用历史",
            body: "近期、重复或高可信度的报告值得谨慎复核。",
          },
          { title: "Tor 出口状态", body: "这是匿名且共享出口流量的强信号。" },
          {
            title: "多个数据源一致",
            body: "多个来源同时识别 VPN 或代理，会增强该信号的可信度。",
          },
          {
            title: "共享风险高",
            body: "中继、托管或多用户流量可能受到更谨慎的处理。",
          },
          {
            title: "反复出现不一致",
            body: "地址、归属或路由观察持续冲突时，应进一步了解原因。",
          },
          {
            title: "用途较敏感",
            body: "支付、身份验证、银行和敏感账号安全操作应采用更谨慎的标准。",
          },
        ],
      },
      {
        title: "不应从结果推断什么",
        items: [
          {
            title: "不能推断有罪或欺诈",
            body: "IP 结果无法证明使用者的意图或行为。",
          },
          {
            title: "不能推断一定被拦截",
            body: "各平台规则不同，对同一网络可能采取接受、验证或复核等不同处理。",
          },
          {
            title: "不能推断账号一定失败",
            body: "账号、设备、行为、支付和验证上下文同样会影响结果。",
          },
          {
            title: "高分也不保证安全",
            body: "高分只概括现有 IP 证据，不能证明账号或交易一定安全。",
          },
        ],
      },
    ],
    cta: {
      title: "了解你的 IP 为什么有风险",
      body: "免费运行检测，查看最强风险信号、网络身份、共享风险和证据质量。",
      label: "分析我的 IP",
      href: "/zh",
    },
    faqTitle: "关于 IP 风险的常见问题",
    faq: [
      {
        title: "为什么我的 IP 评分变了？",
        body: "数据源可能收到新滥用报告、更新网络分类、恢复缺失数据或发现 IP 被重新分配；每次检测可获得的证据也可能不同。",
      },
      {
        title: "干净的住宅 IP 会变得有风险吗？",
        body: "会。网络身份与声誉是两回事；新的滥用报告、共享使用或数据源证据都可能改变住宅 IP 的评估。",
      },
      {
        title: "为什么云 IP 会被区别对待？",
        body: "云 IP 属于托管基础设施，常用于自动化或共享工作负载。即使滥用历史干净，部分服务仍会用不同于家庭或移动接入的方式复核它。",
      },
      {
        title: "高风险评分就代表欺诈吗？",
        body: "不代表。它表示现有 IP 证据中存在较强问题或较大不确定性，不能证明用户存在欺诈或恶意行为。",
      },
      {
        title: "不同数据源会有不同判断吗？",
        body: "会。它们使用不同的数据、定义和更新周期。IP Health 会综合展示现有证据，并把部分分歧作为复核上下文。",
      },
      {
        title: "我应该立刻更换 IP 吗？",
        body: "不一定。应先确认问题属于严重滥用、强隐私信号、正常基础设施背景，还是单纯证据不足，再结合实际用途和平台规则决定。",
      },
    ],
  },
};

export function isSeoPageSlug(value: string): value is SeoPageSlug {
  return seoPageSlugs.includes(value as SeoPageSlug);
}

export function getSeoPage(locale: Locale, slug: SeoPageSlug) {
  return locale === "zh" ? chinesePages[slug] : englishPages[slug];
}
