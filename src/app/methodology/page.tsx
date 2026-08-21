import type { Metadata } from "next";
import Link from "next/link";

import { MethodologyPage } from "@/components/methodology-page";
import { buildPageMetadata } from "@/lib/site-metadata";

const title = "How IP Health Works";
const description =
  "Learn how IP Health combines reputation, network quality, compatibility, evidence quality, network identity, and sharing risk into a practical IP assessment.";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/methodology",
  alternatePath: "/zh/methodology",
  locale: "en",
});

export default function MethodologyRoute() {
  return (
    <MethodologyPage
      title={title}
      description="IP Health combines reputation, network identity, infrastructure, connectivity, and provider evidence into a practical IP risk assessment. It is designed to help you understand an IP before using it for login, registration, payments, remote work, or business operations."
      locale="en"
    >
      <section aria-labelledby="overall-score">
        <h2 id="overall-score">1. Overall Score</h2>
        <p>
          The IP Health Score is a practical risk summary on a 0–100 scale, not
          a guarantee. Higher scores generally mean fewer observed concerns;
          lower scores mean stronger reputation, privacy-network,
          infrastructure, or connectivity concerns were found.
        </p>
        <p>
          The current score combines three dimension scores: Reputation (50%),
          Network Quality (30%), and Compatibility (20%). Each dimension is
          calculated from the evidence available for that check. Missing or
          incomplete evidence can limit a dimension&apos;s maximum score, so the
          result should always be read together with Evidence Quality and
          Network Identity.
        </p>
      </section>

      <section aria-labelledby="dimensions">
        <h2 id="dimensions">2. Main Assessment Dimensions</h2>
        <h3>Reputation</h3>
        <p>
          Reviews reported abuse confidence, provider fraud or reputation
          scores, recent-abuse and bot signals, and reported VPN, proxy, Tor, or
          abuse indicators. Provider availability also affects how confidently a
          clean reputation result can be stated.
        </p>
        <h3>Network Quality</h3>
        <p>
          Reviews ownership visibility, ASN and organization data, consumer
          access signals, hosting or datacenter indicators, VPN, proxy, relay,
          and Tor signals. A residential or mobile classification can keep a
          secondary infrastructure flag in review context instead of letting
          that flag redefine the network by itself.
        </p>
        <h3>Compatibility</h3>
        <p>
          Uses browser connectivity probes and the result&apos;s regional or
          policy restriction signals to estimate whether the tested services
          appear reachable. “Not verified” means the browser could not fully
          confirm a probe; it is not the same as “unreachable.” Compatibility
          does not test or predict whether an account registration, payment, or
          login will be accepted.
        </p>
      </section>

      <section aria-labelledby="evidence-quality">
        <h2 id="evidence-quality">3. Evidence Quality</h2>
        <p>
          Evidence Quality describes the coverage and completeness of the data
          used for the report. It is not a second risk score and it is not a
          direct measurement of agreement between every provider.
        </p>
        <ul className="list-disc">
          <li>
            <strong>High:</strong> network ownership, abuse history, and at
            least one secondary reputation source were available without a
            recorded coverage gap.
          </li>
          <li>
            <strong>Medium:</strong> some evidence was unavailable or partial,
            but enough fallback reputation and network context remained for a
            useful assessment.
          </li>
          <li>
            <strong>Low:</strong> important sources were unavailable or
            incomplete, increasing uncertainty in the result.
          </li>
        </ul>
        <p>
          A provider failure does not automatically make an IP risky. It can cap
          a dimension score, reduce Evidence Quality, and produce more cautious
          wording. Browser connectivity is reported under Compatibility and does
          not reduce overall Evidence Quality. Low Evidence Quality means “less
          certain,” not “bad IP.”
        </p>
      </section>

      <section aria-labelledby="network-identity">
        <h2 id="network-identity">4. Network Identity</h2>
        <p>
          Network Identity describes the most likely kind of network, based on
          privacy flags, provider usage data, ownership text, ASN patterns, and
          selected known public-service endpoints. The supported categories are
          Residential ISP, Mobile Network, Enterprise Network, Public
          Infrastructure, Cloud Provider, Datacenter, VPN / Proxy, Tor Exit, and
          Unknown.
        </p>
        <p>
          Identity is descriptive, not a finding of maliciousness. A public DNS
          or CDN endpoint can be legitimate infrastructure but unsuitable as a
          personal access IP. An enterprise network can be clean but shared. A
          residential IP can still carry reputation concerns, while a datacenter
          IP can have clean abuse history and still face stricter platform
          review.
        </p>
      </section>

      <section aria-labelledby="sharing-risk">
        <h2 id="sharing-risk">5. Sharing Risk</h2>
        <p>
          Sharing Risk separately estimates whether traffic may come through
          shared, relayed, hosted, corporate, public-service, proxy, or
          multi-user infrastructure. It uses privacy signals, network identity,
          hosting and datacenter evidence, ownership coverage, and secondary
          provider signals.
        </p>
        <p>
          Tor or a strong VPN/proxy signal produces high sharing concern.
          Hosted, enterprise, and public infrastructure are interpreted in their
          identity context and can produce medium concern without being treated
          as malicious. Normal residential or mobile access without a strong
          privacy or infrastructure signal is generally assessed as low sharing
          risk. Limited ownership and provider data can leave the level unknown.
        </p>
      </section>

      <section aria-labelledby="signal-strength">
        <h2 id="signal-strength">6. Strong Signals and Review Signals</h2>
        <p>
          Strong signals include Tor, VPN/proxy or relay indicators recognized
          by the direct identity checks, severe abuse history, recent abuse, and
          high provider reputation risk. These can directly drive a risk
          assessment or recommendation.
        </p>
        <p>
          Review signals include secondary privacy or infrastructure flags,
          hosting or managed-network observations, enterprise or public routing
          context, and partially verified connectivity. Their meaning depends on
          Network Identity. Known public-service endpoints are handled before
          generic privacy labels, while some infrastructure observations remain
          review context when the network is otherwise classified as consumer,
          enterprise, or public infrastructure.
        </p>
      </section>

      <section aria-labelledby="data-sources">
        <h2 id="data-sources">7. Data Sources</h2>
        <p>
          A report may use the following sources. No source is guaranteed to be
          available for every analysis.
        </p>
        <ul className="list-disc">
          <li>
            <strong>IPinfo:</strong> IP ownership, ASN, organization, location,
            and privacy-network fields.
          </li>
          <li>
            <strong>AbuseIPDB:</strong> reported abuse confidence, usage type,
            and ISP context.
          </li>
          <li>
            <strong>Scamalytics:</strong> secondary reputation score and proxy,
            VPN, Tor, and server indicators.
          </li>
          <li>
            <strong>ipapi.is:</strong> secondary privacy, hosting, datacenter,
            abuse, ownership, and location context.
          </li>
          <li>
            <strong>Connectivity probes:</strong> browser-observed reachable,
            unreachable, or not-verified states for selected services.
          </li>
        </ul>
      </section>

      <section aria-labelledby="conflicts">
        <h2 id="conflicts">8. How Conflicting Signals Are Handled</h2>
        <p>
          Provider results are evaluated together, but they do not all have the
          same role. Strong privacy and reputation evidence can directly affect
          a score or classification; some secondary fields instead act as
          corroborating review evidence. Network Identity is evaluated in a
          defined order so that, for example, a known public-service endpoint is
          not presented as a personal VPN solely because of a provider label.
        </p>
        <p>
          Classification-aware wording keeps legitimate infrastructure from
          being described as malicious. Missing providers reduce confidence
          instead of failing the whole analysis. Recommendations then combine
          score context with identity: clean hosted infrastructure, shared
          enterprise traffic, and normal residential access can receive
          different guidance even when their reputation evidence is similar.
        </p>
      </section>

      <section aria-labelledby="limitations">
        <h2 id="limitations">9. Limitations</h2>
        <ul className="list-disc">
          <li>
            The score does not guarantee that an account will be accepted.
          </li>
          <li>Platforms use private risk systems that IP Health cannot see.</li>
          <li>
            IP reputation and provider data can differ and change over time.
          </li>
          <li>
            Browser and network conditions can affect connectivity probes.
          </li>
          <li>“Not verified” does not mean “unreachable.”</li>
          <li>
            A clean score does not guarantee account or transaction safety.
          </li>
          <li>A low score does not prove malicious activity.</li>
          <li>
            The result should be interpreted for the intended use, especially
            for registration, verification, payments, banking, or sensitive
            account changes.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy">
        <h2 id="privacy">10. Privacy and Data Handling</h2>
        <p>
          IP Health sends the IP being analyzed to server-side provider APIs.
          Recent-check history is stored only in your browser&apos;s
          localStorage, and IP Health has no account system. Anonymous product
          analytics use category-level fields and do not store raw IP addresses,
          request headers, API keys, tokens, account identifiers, or device
          identifiers. IP Health does not sell personal data or use tracking
          cookies.
        </p>
        <p>
          Read the full <Link href="/privacy">Privacy page</Link> for the
          current data-handling statement.
        </p>
      </section>
    </MethodologyPage>
  );
}
