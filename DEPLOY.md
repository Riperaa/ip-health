# Deploying IP Health to Vercel

This project is a Next.js app and can be deployed directly to Vercel.

## Production Configuration

The Vercel project should use:

- Framework preset: `Next.js`
- Node.js runtime: `22.x`
- Install command: `npm install`
- Build command: `npm run build`
- Output: handled by the Next.js preset

These settings are also captured in `vercel.json`.

## Environment Variables

Set these variables in the Vercel project settings before deploying.

| Name | Required | Purpose |
| --- | --- | --- |
| `IPQS_API_KEY` | Yes | Server-side IPQualityScore API key for `/api/ipqs`. |
| `ABUSEIPDB_API_KEY` | Recommended | Server-side AbuseIPDB API key for `/api/abuseipdb`. If missing, AbuseIPDB results are skipped by the client. |
| `IPINFO_TOKEN` | Recommended | Server-side IPinfo token for `/api/ipinfo`. If missing, the app can use the fallback provider after IPinfo rate limits. |
| `ABUSEIPDB_TIMEOUT_MS` | Optional | Timeout for AbuseIPDB requests. Defaults to `5000`. |
| `ABUSEIPDB_MAX_AGE_DAYS` | Optional | AbuseIPDB report lookback window. Defaults to `90`. |
| `IPQS_TIMEOUT_MS` | Optional | Timeout for IPQualityScore requests. Defaults to `5000`. |
| `NEXT_PUBLIC_SPONSOR_URL` | Optional | Public sponsor or donation page URL. When unset, the Sponsor button is hidden. |

Do not configure `NEXT_PUBLIC_IPINFO_TOKEN` for production unless a public browser-readable token is intentional. Prefer `IPINFO_TOKEN`.

## Preflight

Run these checks before deployment:

```bash
npm install
npm run lint
npm run build
```

The production build should include these dynamic API routes:

- `/api/ipinfo`
- `/api/abuseipdb`
- `/api/ipqs`

## Deploy

Authenticate first if this machine is not already logged in:

```bash
vercel login
```

From the project root:

```bash
vercel --prod
```

If this is the first deployment, Vercel will ask to link or create a project. After linking, confirm that all required environment variables are set for the Production environment and redeploy.

## Verify Production

After deployment, open the production URL and submit a known IP address, such as:

```text
1.1.1.1
```

You can also check the IPQS route directly:

```text
https://your-domain.example/api/ipqs?ip=1.1.1.1
```

The response should include:

```json
{
  "fraudScore": 0,
  "vpn": false,
  "proxy": false,
  "tor": false,
  "bot": false,
  "activeVpn": false,
  "recentAbuse": false,
  "raw": {}
}
```

Actual values will vary by IP address and provider data.
