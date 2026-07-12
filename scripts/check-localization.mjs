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

if (failedDynamicCases.length || changedEnglishCases.length) {
  console.error(
    [
      ...failedDynamicCases.map(
        (item) => `Dynamic Chinese localization failed: ${item}`,
      ),
      ...changedEnglishCases.map((item) => `English wording changed: ${item}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `Chinese localization coverage check passed (${Object.values(coverageMatrix).flat().length} required states, ${dynamicCases.length} dynamic patterns).`,
);
