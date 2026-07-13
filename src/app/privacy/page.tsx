import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy | IP Health",
  description:
    "Learn how IP Health handles analyzed IP addresses, local browser history, provider requests, and anonymous product analytics.",
  path: "/privacy",
  alternatePath: "/zh/privacy",
  locale: "en",
});

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy">
      <p>
        IP Health analyzes the IP address entered by the user. To provide
        reputation and network context, provider APIs may be called server-side.
      </p>
      <p>
        Local history is stored only in the browser localStorage on your device.
        IP Health does not have an account system.
      </p>
      <p>
        IP Health uses anonymous product analytics to understand whether core
        flows such as analysis, comparison, and feedback are working well. These
        events are limited to category-level fields such as country code,
        network identity category, evidence quality, success status, and
        feedback reason.
      </p>
      <p>
        Analytics events do not store raw IP addresses, request headers, API
        keys, tokens, account identifiers, device identifiers, or other personal
        identifiers.
      </p>
      <p>
        IP Health does not sell personal data and does not use tracking cookies.
      </p>
    </InfoPage>
  );
}
