# IP Health

Check IP reputation, network quality, and service compatibility before logging in.

Live demo: [https://ip-health.vercel.app](https://ip-health.vercel.app)

## Features

- IP Health Score with Reputation, Network Quality, and Compatibility breakdowns.
- Risk Summary with plain-language context.
- Recommendation with Confidence based on available signals.
- Service Compatibility guidance for popular platforms.
- Compare IPs side by side.
- Local IP History for recent checks in the browser.
- Reputation Sources showing which data providers contributed.

## How it works

IP Health combines network context, privacy indicators, abuse signals, IPQS and Scamalytics signals, and connectivity probes into a readable IP quality report. It highlights hosting, VPN, proxy, Tor, relay, ASN, ISP, usage type, and provider reputation data when available.

The IP Health Score blends Reputation (50%), Network Quality (30%), and Compatibility (20%). Recommendations are guidance, not guarantees. Service compatibility is estimated from connectivity, regional access, reputation, and infrastructure signals, with stricter handling for sensitive account, finance, crypto, and verification-heavy services.

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- ESLint
- IPinfo
- AbuseIPDB
- IPQualityScore
- Scamalytics

## Privacy

- No user accounts.
- Local history stays in the browser.
- Provider APIs may be called server-side to retrieve reputation data.
- No tracking cookies.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Disclaimer

IP Health provides reputation-based guidance only. Services may also consider account history, device reputation, browser fingerprint, payment method, and behavior.

## Roadmap

- Add focused tests for scoring and service compatibility rules.
- Improve provider coverage and confidence messaging.
- Add exportable reports for saved IP checks.
- Continue refining compatibility rules for v1.x releases.
