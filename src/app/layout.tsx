import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

import { SOCIAL_IMAGE } from "@/lib/site-metadata";

import "./globals.css";

const siteUrl = "https://iphealth.app";
const title = "IP Health – Check IP Trust, Risk, and Compatibility";
const description =
  "Know whether you can trust an IP in 5 seconds. Check IP reputation, risk signals, service compatibility, and compare IPs.";

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();
const baiduVerification = process.env.BAIDU_SITE_VERIFICATION?.trim();

const otherVerification = {
  ...(bingVerification ? { "msvalidate.01": bingVerification } : {}),
  ...(baiduVerification
    ? { "baidu-site-verification": baiduVerification }
    : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "IP Health",
  alternates: {
    canonical: "/",
    languages: { en: "/", "zh-CN": "/zh", "x-default": "/" },
  },
  openGraph: {
    title,
    description,
    siteName: "IP Health",
    type: "website",
    url: siteUrl,
    locale: "en_US",
    alternateLocale: ["zh_CN"],
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [SOCIAL_IMAGE],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  verification:
    googleVerification || Object.keys(otherVerification).length > 0
      ? {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(Object.keys(otherVerification).length > 0
            ? { other: otherVerification }
            : {}),
        }
      : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f7f8fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
