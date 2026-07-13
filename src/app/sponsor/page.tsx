import type { Metadata } from "next";

import { SponsorPage } from "@/components/sponsor-page";

export const metadata: Metadata = {
  alternates: {
    canonical: "/sponsor",
    languages: { en: "/sponsor", "zh-CN": "/zh/sponsor" },
  },
};

export default function SponsorRoute() {
  return <SponsorPage locale="en" />;
}
