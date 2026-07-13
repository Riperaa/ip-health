import type { Metadata } from "next";

import { SponsorPage } from "@/components/sponsor-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Support IP Health",
  description:
    "Support the independent maintenance of IP Health and its IP reputation, network identity, and risk-signal analysis.",
  path: "/sponsor",
  alternatePath: "/zh/sponsor",
  locale: "en",
});

export default function SponsorRoute() {
  return <SponsorPage locale="en" />;
}
