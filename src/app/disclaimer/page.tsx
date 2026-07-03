import { InfoPage } from "@/components/info-page";

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
