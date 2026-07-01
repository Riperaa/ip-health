# IP Health

IP Health is a minimalist IP reputation and network context checker. It helps users quickly inspect an IP address, review location and network details, and understand whether the IP appears trustworthy.

The app is designed with a clean Apple-style interface and focuses on fast, readable results rather than dense security dashboards.

## Features

- Auto-detect the user's public IP address.
- Analyze any IPv4 or IPv6 address manually.
- Display core IP details, including country, city, ASN, ISP, hosting status, and privacy indicators.
- Show a Trust Score card with a clear status badge.
- Detect common privacy signals such as VPN, proxy, Tor, relay, and hosting infrastructure when available.
- Use IPinfo for IP intelligence, with a fallback provider when no token is configured and rate limits are encountered.
- Responsive, minimalist interface built for quick scanning.

## Screenshots

Add screenshots here once the UI is ready to document visually.

Recommended screenshots:

- Home screen with the IP input.
- Analysis results with the Trust Score card.
- Mobile layout.

```md
![IP Health home screen](./screenshots/home.png)
![IP Health analysis results](./screenshots/results.png)
```

## Tech Stack

- [Next.js](https://nextjs.org/) 15
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [ESLint](https://eslint.org/)
- [IPinfo](https://ipinfo.io/) API
- [ipwho.is](https://ipwho.is/) fallback API

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

Optional environment variable:

```bash
IPINFO_TOKEN=your_ipinfo_token
```

You can also use `NEXT_PUBLIC_IPINFO_TOKEN`, but `IPINFO_TOKEN` is preferred for server-side API access.

Run lint checks:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Roadmap

- Replace the placeholder Trust Score with a weighted scoring model.
- Add richer explanations for score changes and risk factors.
- Save recent lookups locally.
- Add screenshot assets for documentation.
- Add automated tests for scoring and API normalization.
- Improve handling for API limits and provider-specific errors.

## MIT License

MIT License

Copyright (c) 2026 IP Health

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
