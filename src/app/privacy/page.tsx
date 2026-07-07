import { InfoPage } from "@/components/info-page";

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
        Product analytics, when configured, use category-level events such as
        analysis started, analysis completed, compare started, evidence quality,
        country code, network identity category, and feedback reason. Analytics
        payloads do not include searched IP addresses, API keys, or personal
        identifiers.
      </p>
      <p>
        IP Health does not sell personal data and does not use tracking cookies.
      </p>
    </InfoPage>
  );
}
