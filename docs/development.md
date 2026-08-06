# Development

## Requirements

- Node.js 24 and npm 11.
- Git.
- A Supabase development project.
- Optional provider accounts for the feature being exercised.

## Installation

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The lockfile is authoritative; use `npm ci` for reproducible installs. Do not commit `.env.local`.

## Environment configuration

`.env.example` is the canonical variable inventory. Configure groups incrementally:

- Supabase variables are required for authentication and database access.
- `NEXT_PUBLIC_APP_URL` should be `http://localhost:3000` locally.
- Resend and `ADMIN_EMAIL` enable verification notifications.
- Twilio variables enable phone verification.
- Google Maps variables enable maps; Earth Engine variables enable satellite analysis.
- Razorpay variables enable checkout and webhook validation.
- Emissions-provider variables enable provider-backed corporate calculations.

Values prefixed with `NEXT_PUBLIC_` are bundled for the browser. All other values are server-only.

## Quality checks

```bash
npm run lint
npm run test:unit
npm run build
```

Unit tests run in a Node environment and currently focus on deterministic dashboard state, emissions mappings and math, payment signatures and totals, project metadata, and valuation models.

## Common constraints

- Dynamic pages may compile without contacting providers, but exercising their flows requires valid development credentials.
- Database scripts are not run automatically by `npm ci` or `npm run dev`.
- Admin review links and Razorpay webhooks require an externally reachable application URL for end-to-end testing.
