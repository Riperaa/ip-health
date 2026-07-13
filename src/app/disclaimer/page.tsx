import type { Metadata } from "next";

import { InfoPage } from "@/components/info-page";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Disclaimer | IP Health",
  description:
    "Understand the limits of IP Health results, IP reputation signals, compatibility guidance, and service access predictions.",
  path: "/disclaimer",
  alternatePath: "/zh/disclaimer",
  locale: "en",
});

export default function DisclaimerPage() {
  return (
    <InfoPage title="Disclaimer">
      <p>
        IP Health results are informational only. IP reputation is only one
        signal when evaluating access, risk, or compatibility.
      </p>
      <p>
        Services may also use device, account, behavior, payment, and browser
        fingerprint signals when deciding whether to allow or block activity.
      </p>
      <p>
        IP Health cannot guarantee that any service will allow or block access.
      </p>
    </InfoPage>
  );
}
