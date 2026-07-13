import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "About IP Health",
  description:
    "Learn about IP Health, a privacy-conscious tool for reviewing IP reputation, network identity, compatibility, and risk signals.",
  path: "/about",
  alternatePath: "/zh/about",
  locale: "en",
});

export default function AboutPage() {
  return (
    <InfoPage title="About IP Health">
      <p>
        IP Health is an IP trust and reputation checker for quickly evaluating
        whether an address looks safe, risky, or worth extra caution.
      </p>
      <p>
        It combines reputation signals with service compatibility guidance so
        you can understand how an IP may behave across common online services.
      </p>
      <p>
        It is built for privacy-conscious users, developers, and people
        evaluating network quality.
      </p>
    </InfoPage>
  );
}
