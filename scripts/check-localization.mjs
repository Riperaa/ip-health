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

console.log(
  `Chinese localization coverage check passed (${Object.values(coverageMatrix).flat().length} required states).`,
);
