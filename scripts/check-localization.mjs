import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/localization.ts", "utf8");
const file = ts.createSourceFile(
  "localization.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const keys = new Set();

function visit(node) {
  if (ts.isPropertyAssignment(node)) {
    if (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) {
      keys.add(node.name.text);
    }
  }
  ts.forEachChild(node, visit);
}
visit(file);

const coverageMatrix = {
  "network identity": [
    "Residential ISP",
    "Datacenter",
    "Cloud Provider",
    "Enterprise Network",
    "Public Infrastructure",
    "Tor Exit",
    "VPN / Proxy",
    "Unknown",
  ],
  "risk levels": ["High", "Medium", "Low"],
  "evidence quality": ["High", "Medium", "Low", "Partial", "Unavailable"],
  "result summary": [
    "Clean IP history",
    "Clean reputation signals, limited confidence",
    "Some reputation signals found",
    "High reputation risk detected",
    "Insufficient reputation evidence",
    "Tor network detected",
    "VPN or proxy network detected",
    "Cloud or hosting infrastructure detected",
    "Enterprise network detected",
    "Enterprise network review signal",
    "Enterprise network review signals",
    "Hosted infrastructure review signal",
    "Minor network review signals",
    "Minor review signal",
    "Network type not fully identified",
    "Public infrastructure detected",
    "Public infrastructure review signal",
    "Regional restriction detected",
    "Residential ISP detected",
    "Secondary network review signal",
    "Connectivity failure detected",
    "Connectivity not fully verified",
    "Connectivity verified",
    "Most tested services reachable",
    "Clean IP with strong compatibility",
    "Compatibility needs review before sensitive use.",
    "Reputation risk is the main issue for this IP.",
  ],
  "result states": [
    "Analyzing IP...",
    "Analysis failed",
    "Invalid IP address",
    "No recent checks yet.",
    "Thanks for the feedback.",
    "QA mode: checks are not saved.",
  ],
  "compare flow": [
    "Compare IPs",
    "Compare",
    "Comparing...",
    "Better choice",
    "Enter both IP addresses.",
    "Unable to compare these IPs.",
  ],
  "remaining status labels": [
    "Confidence pending",
    "No major review signals detected",
    "Proxy detected",
    "VPN detected",
    "Tor detected",
    "Relay detected",
    "WARP enabled",
    "IPQS fraud score",
    "Scamalytics risk score",
    "ipapi.is Tor signal",
    "Enterprise network review signal",
    "ipapi.is VPN/proxy signal",
    "ipapi.is abuse signal",
    "Minor network review signal",
    "Enterprise network",
    "Hosted infrastructure",
    "Hosting infrastructure",
    "ipapi.is hosting signal",
    "Infrastructure route",
    "Secondary privacy review signal",
    "Relay or multi-user access signal",
    "Infrastructure route detected",
    "No strong sharing signal detected",
    "Limited Network Quality",
  ],
  "minor UI copy": [
    "IP Address",
    "Enter an IP address or analyze your current IP to see IP quality and compatibility.",
    "Score details will appear here after analysis.",
    "Run an analysis to see score details.",
    "Expand",
    "Collapse",
  ],
};

const missing = Object.entries(coverageMatrix).flatMap(([category, values]) =>
  values
    .filter((value) => !keys.has(value))
    .map((value) => `${category}: ${value}`),
);

if (missing.length) {
  console.error(
    `Missing Chinese localization coverage:\n${missing.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exit(1);
}

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { localizeText } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const dynamicCases = [
  [
    "Reputation risk is the main issue for this IP.",
    "该 IP 的主要问题是声誉风险。",
  ],
  [
    "Some reputation signals found. Cloud or hosting infrastructure detected. Scamalytics was available.",
    "检测到部分声誉风险信号。检测到云服务或托管基础设施。Scamalytics 可用。",
  ],
  [
    "Some reputation signals found. Cloud or hosting infrastructure detected. Most tested services reachable. Connectivity probes were partially verified.",
    "检测到部分声誉风险信号。检测到云服务或托管基础设施。大多数已测试服务均可访问。连通性探测已完成部分验证。",
  ],
  [
    "Some data sources unavailable: AbuseIPDB abuse history was unavailable.",
    "部分数据源不可用：AbuseIPDB 滥用历史数据不可用。",
  ],
  ["Scamalytics was available", "Scamalytics 可用"],
  ["Connectivity probes were partially verified", "连通性探测已完成部分验证"],
  [
    "This is normal for public DNS, CDN, and edge services, but it is not ideal as a personal browsing or account registration IP.",
    "这类公共 DNS、CDN 和边缘服务用于服务很正常，但不适合作为个人浏览或注册账号的 IP。",
  ],
  ["Abuse history is low at 12% confidence.", "滥用记录较低，可信度为 12%。"],
  [
    "Abuse history is elevated at 38% confidence.",
    "滥用记录有所升高，可信度为 38%。",
  ],
  ["Abuse history is high at 87% confidence.", "滥用记录较高，可信度为 87%。"],
  ["IPQS fraud score is 42/100.", "IPQS 风险评分为 42/100。"],
  ["Scamalytics risk score is 63/100.", "Scamalytics 风险评分为 63/100。"],
  ["VPN, proxy and Tor detected.", "检测到VPN、代理、Tor。"],
  [
    "Network usage looks like Data Center/Web Hosting/Transit, which stricter services may review.",
    "网络使用类型表现为Data Center/Web Hosting/Transit，风控较严格的服务可能会进行复核。",
  ],
  [
    "Network owner is visible: AS13335 / Cloudflare.",
    "网络归属可见：AS13335 / Cloudflare。",
  ],
  ["Low, 7% confidence reported.", "报告的滥用可信度：较低，7%。"],
  [
    "Cloudflare reports edge routing through HKG, which is expected for service infrastructure.",
    "Cloudflare 报告流量经由 HKG 进行边缘路由，这符合服务基础设施的预期。",
  ],
  ["Cloudflare routed this IP through LAX.", "Cloudflare 通过 LAX 路由此 IP。"],
];

const failedDynamicCases = dynamicCases.flatMap(([english, chinese]) => {
  const actual = localizeText("zh", english);
  return actual === chinese ? [] : [`${english} -> ${actual}`];
});
const changedEnglishCases = dynamicCases.flatMap(([english]) =>
  localizeText("en", english) === english ? [] : [english],
);

const presentationSource = fs.readFileSync(
  "src/lib/analysis/summary-presentation.ts",
  "utf8",
);
const presentationCompiled = ts.transpileModule(presentationSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { joinEnglishSummaryFragments } = await import(
  `data:text/javascript;base64,${Buffer.from(presentationCompiled).toString("base64")}`
);

const allUnverifiedSummary = joinEnglishSummaryFragments([
  { text: "Some reputation signals found" },
  { text: "Cloud or hosting infrastructure detected" },
  {
    text: "IPQS reputation data was unavailable",
    source: "ipqs-unavailable",
  },
  { text: "Scamalytics was available" },
  {
    text: "Connectivity not fully verified",
    source: "connectivity-status",
    hasDefinitiveConnectivity: false,
  },
]);
const partiallyVerifiedSummary = joinEnglishSummaryFragments([
  { text: "Some reputation signals found" },
  {
    text: "Connectivity probes were partially verified",
    source: "connectivity-status",
    hasDefinitiveConnectivity: true,
  },
]);
const localizedAllUnverifiedSummary = localizeText("zh", allUnverifiedSummary);
const summaryRegressionFailures = [
  allUnverifiedSummary ===
  "Some reputation signals found. Cloud or hosting infrastructure detected. Scamalytics was available."
    ? null
    : `Unexpected all-unverified summary: ${allUnverifiedSummary}`,
  !allUnverifiedSummary.includes("IPQS")
    ? null
    : "Hidden IPQS wording remained",
  !allUnverifiedSummary.includes("Connectivity")
    ? null
    : "All-unverified connectivity wording remained",
  partiallyVerifiedSummary.includes(
    "Connectivity probes were partially verified.",
  )
    ? null
    : "Definitive partial-connectivity wording was removed",
  localizedAllUnverifiedSummary ===
  "检测到部分声誉风险信号。检测到云服务或托管基础设施。Scamalytics 可用。"
    ? null
    : `Unexpected Chinese summary: ${localizedAllUnverifiedSummary}`,
  /[A-Za-z]+\s+(?:reputation|signals|infrastructure|connectivity|detected|found)/i.test(
    localizedAllUnverifiedSummary,
  )
    ? "Mixed English explanatory copy remained in Chinese summary"
    : null,
  /[.；]|。\s|：\s|。。/.test(localizedAllUnverifiedSummary)
    ? `Dangling or mixed punctuation remained: ${localizedAllUnverifiedSummary}`
    : null,
].filter(Boolean);

if (
  failedDynamicCases.length ||
  changedEnglishCases.length ||
  summaryRegressionFailures.length
) {
  console.error(
    [
      ...failedDynamicCases.map(
        (item) => `Dynamic Chinese localization failed: ${item}`,
      ),
      ...changedEnglishCases.map((item) => `English wording changed: ${item}`),
      ...summaryRegressionFailures.map(
        (item) => `Summary presentation regression: ${item}`,
      ),
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `Chinese localization coverage check passed (${Object.values(coverageMatrix).flat().length} required states, ${dynamicCases.length} dynamic patterns).`,
);
