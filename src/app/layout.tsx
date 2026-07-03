import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = "https://ip-health.vercel.app";
const title = "IP Health – Check IP Trust, Risk, and Compatibility";
const description =
  "Know whether you can trust an IP in 5 seconds. Check IP reputation, risk signals, service compatibility, and compare IPs.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "IP Health",
  openGraph: {
    title,
    description,
    siteName: "IP Health",
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
