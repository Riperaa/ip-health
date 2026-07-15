const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const productionOrigin = "https://iphealth.app";
const socialImage = `${productionOrigin}/social/ip-health-og.png`;

const routePairs = [
  ["/", "/zh"],
  ["/methodology", "/zh/methodology"],
  ["/compare", "/zh/compare"],
  ["/sponsor", "/zh/sponsor"],
  ["/about", "/zh/about"],
  ["/privacy", "/zh/privacy"],
  ["/disclaimer", "/zh/disclaimer"],
  ["/is-my-ip-clean", "/zh/is-my-ip-clean"],
  ["/vpn-ip-check", "/zh/vpn-ip-check"],
  ["/why-is-my-ip-risky", "/zh/why-is-my-ip-risky"],
];

const routes = routePairs.flat();
const seoRoutes = new Set(routes.filter((route) => route.includes("ip-")));
const failures = [];

function productionUrl(route) {
  return route === "/" ? productionOrigin : `${productionOrigin}${route}`;
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1];
}

function metaContent(html, attributeName, attributeValue) {
  const tag = tags(html, "meta").find(
    (candidate) => attribute(candidate, attributeName) === attributeValue,
  );
  return tag ? attribute(tag, "content") : undefined;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const pages = new Map();

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  const html = await response.text();
  const canonicalTags = tags(html, "link").filter(
    (tag) => attribute(tag, "rel") === "canonical",
  );
  const languageAlternates = Object.fromEntries(
    tags(html, "link")
      .filter((tag) => attribute(tag, "rel") === "alternate")
      .map((tag) => [attribute(tag, "hreflang"), attribute(tag, "href")])
      .filter(([language, href]) => language && href),
  );
  const canonical = canonicalTags[0]
    ? attribute(canonicalTags[0], "href")
    : undefined;
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = metaContent(html, "name", "description");
  const expectedCanonical = productionUrl(route);
  const jsonLdCount = tags(html, "script").filter(
    (tag) => attribute(tag, "type") === "application/ld+json",
  ).length;

  pages.set(route, { canonical, languageAlternates });

  assert(
    response.status === 200,
    `${route}: expected 200, got ${response.status}`,
  );
  assert(!response.headers.get("location"), `${route}: unexpectedly redirects`);
  assert(
    canonicalTags.length === 1,
    `${route}: expected exactly one canonical`,
  );
  assert(
    canonical === expectedCanonical,
    `${route}: canonical is ${canonical ?? "missing"}`,
  );
  assert(Boolean(title?.trim()), `${route}: missing title`);
  assert(Boolean(description?.trim()), `${route}: missing description`);
  assert(
    !metaContent(html, "name", "robots")?.toLowerCase().includes("noindex"),
    `${route}: contains noindex`,
  );
  assert(
    metaContent(html, "property", "og:title") === title,
    `${route}: Open Graph title does not match the page title`,
  );
  assert(
    metaContent(html, "property", "og:description") === description,
    `${route}: Open Graph description does not match`,
  );
  assert(
    metaContent(html, "property", "og:url") === canonical,
    `${route}: Open Graph URL does not match the canonical`,
  );
  assert(
    Boolean(metaContent(html, "property", "og:locale")),
    `${route}: missing Open Graph locale`,
  );
  assert(
    metaContent(html, "property", "og:image") === socialImage,
    `${route}: Open Graph image does not match`,
  );
  assert(
    metaContent(html, "property", "og:image:width") === "1200" &&
      metaContent(html, "property", "og:image:height") === "630",
    `${route}: Open Graph image dimensions do not match`,
  );
  assert(
    Boolean(metaContent(html, "name", "twitter:card")),
    `${route}: missing Twitter card metadata`,
  );
  assert(
    Boolean(metaContent(html, "name", "twitter:title")),
    `${route}: missing Twitter title`,
  );
  assert(
    Boolean(metaContent(html, "name", "twitter:description")),
    `${route}: missing Twitter description`,
  );
  assert(
    metaContent(html, "name", "twitter:image") === socialImage,
    `${route}: Twitter image does not match`,
  );
  assert(
    jsonLdCount === (seoRoutes.has(route) ? 1 : 0),
    `${route}: unexpected JSON-LD count ${jsonLdCount}`,
  );
  assert(
    !seoRoutes.has(route) || /<details\b/i.test(html),
    `${route}: FAQ schema has no matching visible FAQ`,
  );
  assert(
    !route.startsWith("/zh") || /<main\b[^>]*\blang="zh-CN"/i.test(html),
    `${route}: Chinese content has no server-rendered language marker`,
  );
}

for (const [englishRoute, chineseRoute] of routePairs) {
  const english = pages.get(englishRoute);
  const chinese = pages.get(chineseRoute);
  const englishCanonical = productionUrl(englishRoute);
  const chineseCanonical = productionUrl(chineseRoute);

  assert(
    english.languageAlternates.en === englishCanonical &&
      english.languageAlternates["zh-CN"] === chineseCanonical &&
      english.languageAlternates["x-default"] === englishCanonical,
    `${englishRoute}: incorrect language alternates`,
  );
  assert(
    chinese.languageAlternates.en === englishCanonical &&
      chinese.languageAlternates["zh-CN"] === chineseCanonical &&
      chinese.languageAlternates["x-default"] === englishCanonical,
    `${chineseRoute}: language alternates are not reciprocal`,
  );
}

const robotsResponse = await fetch(`${baseUrl}/robots.txt`, {
  redirect: "manual",
});
const robots = await robotsResponse.text();
assert(robotsResponse.status === 200, "robots.txt: expected 200");
assert(
  robots.includes("Allow: /"),
  "robots.txt: public crawling is not allowed",
);
assert(
  robots.includes("Disallow: /admin/"),
  "robots.txt: admin is not disallowed",
);
assert(robots.includes("Disallow: /api/"), "robots.txt: API is not disallowed");
assert(
  robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`),
  "robots.txt: production sitemap is missing",
);

const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`, {
  redirect: "manual",
});
const sitemap = await sitemapResponse.text();
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
const sitemapPaths = sitemapUrls.map((url) => new URL(url).pathname);

assert(sitemapResponse.status === 200, "sitemap.xml: expected 200");
assert(
  sitemap.trimStart().startsWith("<?xml") && sitemap.includes("<urlset"),
  "sitemap.xml: does not look like a valid XML sitemap",
);
assert(
  sitemapUrls.length === new Set(sitemapUrls).size,
  "sitemap.xml: contains duplicate URLs",
);
assert(
  sitemapUrls.every((url) => url.startsWith(`${productionOrigin}/`)),
  "sitemap.xml: contains a non-apex URL",
);
assert(
  routes.every((route) => sitemapPaths.includes(route)),
  "sitemap.xml: is missing an intended public route",
);
assert(
  sitemapPaths.every((route) => routes.includes(route)),
  "sitemap.xml: contains an unexpected route",
);

for (const url of sitemapUrls) {
  const path = new URL(url).pathname;
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  assert(response.status === 200, `sitemap ${path}: expected 200`);
  assert(!response.headers.get("location"), `sitemap ${path}: redirects`);
}

for (const [route, expectedLinks] of [
  ["/", ["/is-my-ip-clean", "/vpn-ip-check", "/why-is-my-ip-risky"]],
  ["/zh", ["/zh/is-my-ip-clean", "/zh/vpn-ip-check", "/zh/why-is-my-ip-risky"]],
]) {
  const html = await (await fetch(`${baseUrl}${route}`)).text();
  const links = tags(html, "a").map((tag) => attribute(tag, "href"));
  assert(
    expectedLinks.every((link) => links.includes(link)),
    `${route}: acquisition guides are not all linked with crawlable anchors`,
  );
}

if (failures.length > 0) {
  console.error(`SEO audit failed (${failures.length} issue(s)):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `SEO audit passed: ${routes.length} routes and ${sitemapUrls.length} sitemap URLs verified against ${baseUrl}.`,
  );
  routes.forEach((route) => console.log(`- ${route}`));
}
