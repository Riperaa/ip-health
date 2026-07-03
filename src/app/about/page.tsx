import { InfoPage } from "@/components/info-page";

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
