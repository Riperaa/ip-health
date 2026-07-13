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

| Name                     | Required                      | Purpose                                                                                                                                              |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ABUSEIPDB_API_KEY`      | Yes                           | Server-side AbuseIPDB API key for `/api/abuseipdb`.                                                                                                  |
| `IPINFO_TOKEN`           | Optional                      | Server-side IPinfo token for `/api/ipinfo`. If missing, the app can use the fallback provider after IPinfo rate limits.                              |
| `IPQS_API_KEY`           | Optional / currently disabled | Server-side IPQualityScore API key for `/api/ipqs`. Leave unset while IPQS is disabled; the client skips IPQS results when the route is unavailable. |
| `SCAMALYTICS_USER`       | Optional                      | Server-side Scamalytics account user for `/api/scamalytics`. Required with `SCAMALYTICS_API_KEY` before Scamalytics requests are made.               |
| `SCAMALYTICS_API_KEY`    | Optional                      | Server-side Scamalytics API key for `/api/scamalytics`. Required with `SCAMALYTICS_USER`; used as the second reputation provider when configured.    |
| `ABUSEIPDB_TIMEOUT_MS`   | Optional                      | Timeout for AbuseIPDB requests. Defaults to `5000`.                                                                                                  |
| `ABUSEIPDB_MAX_AGE_DAYS` | Optional                      | AbuseIPDB report lookback window. Defaults to `90`.                                                                                                  |
| `IPQS_TIMEOUT_MS`        | Optional                      | Timeout for IPQualityScore requests. Defaults to `5000`.                                                                                             |
| `SCAMALYTICS_TIMEOUT_MS` | Optional                      | Timeout for Scamalytics requests. Defaults to `5000`.                                                                                                |
| `ADMIN_ANALYTICS_TOKEN`  | Yes for admin analytics       | A long, random server-side secret used to protect `/admin/analytics` and `/api/admin/analytics`. If omitted, admin analytics fails closed.           |

Do not configure `NEXT_PUBLIC_IPINFO_TOKEN` for production unless a public browser-readable token is intentional. Prefer `IPINFO_TOKEN`.
Keep `.env.local` local only. It is already covered by `.gitignore` and must not be committed.

Open `/admin/login` to access the browser dashboard. The login form creates an
eight-hour `HttpOnly`, `SameSite=Strict` session cookie; the token is never put in
the URL. Programmatic access uses an authorization header:

```bash
curl -H "Authorization: Bearer $ADMIN_ANALYTICS_TOKEN" \
  https://your-domain.example/api/admin/analytics
```

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
- `/api/ipqs` (available only when IPQS is enabled with `IPQS_API_KEY`)
- `/api/scamalytics` (available only when Scamalytics is configured)
- `/sponsor`

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

When `IPQS_API_KEY` is configured, the response should include:

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

When IPQS is disabled, this route returns a configuration error and the app continues with the other providers.

You can also check the Scamalytics route directly:

```text
https://your-domain.example/api/scamalytics?ip=1.1.1.1
```

When Scamalytics is configured, the response should include:

```json
{
  "status": "available",
  "score": 0,
  "risk": "low",
  "proxy": false,
  "vpn": false,
  "tor": false,
  "server": false,
  "raw": {}
}
```

When Scamalytics is unavailable or not configured, the app shows that status separately from IPQS and continues with the remaining providers.
