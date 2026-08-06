# ZeroCarbon

[![CI](https://github.com/SUJALMU2004/ZeroCarbon/actions/workflows/ci.yml/badge.svg)](https://github.com/SUJALMU2004/ZeroCarbon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

ZeroCarbon is a climate-tech marketplace for measuring corporate emissions, validating climate projects, and purchasing verified carbon credits. It combines identity and company verification, project evidence collection, satellite analysis, carbon valuation, payment processing, and buyer/seller dashboards in one Next.js application.

Live application: [zerocarbonworld.vercel.app](https://zerocarbonworld.vercel.app)

## What the platform supports

- Buyer and seller onboarding with Supabase authentication.
- Phone, identity, company, and project verification workflows.
- Forestry, agricultural, solar, methane, and windmill projects.
- Google Maps and Google Earth Engine analysis for project evidence.
- Corporate Scope 1, 2, and 3 emissions assessment.
- Carbon-credit valuation and marketplace discovery.
- Razorpay credit reservations, checkout verification, and order history.
- Role-aware dashboards and project administration.

## Technology

- Next.js 16 App Router, React 19, and strict TypeScript.
- Tailwind CSS 4, Framer Motion, Recharts, and Lucide.
- Supabase Auth, Postgres, Row Level Security, and Storage.
- Google Maps, Google Earth Engine, Gemini, and external emissions providers.
- Twilio Verify, Resend, Razorpay, Vercel Analytics, Vitest, and ESLint.

## Repository map

```text
src/
  app/                 Pages, layouts, and API route handlers
  components/          UI grouped by product area
  hooks/               Shared React hooks
  lib/                 Domain logic and service integrations
  types/               Shared application contracts
supabase/               Ordered, manually applied database scripts
public/                 Static brand and favicon assets
docs/                   Maintained architecture and operations guides
.github/                CI, issue forms, and pull-request guidance
```

See [Architecture](docs/architecture.md) for the runtime boundaries and major product flows.

## Local development

### Prerequisites

- Node.js 24 and npm 11.
- A Supabase project.
- Credentials for the external services needed by the feature being tested.

### Setup

```bash
git clone https://github.com/SUJALMU2004/ZeroCarbon.git
cd ZeroCarbon
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

Populate only local values in `.env.local`. Environment files are ignored by Git and must never be committed. The application is then available at `http://localhost:3000`.

Detailed setup and service-specific requirements are documented in [Development](docs/development.md) and [External services](docs/services.md).

## Database setup

The SQL files under `supabase/` are idempotent where noted, but several must be applied in a specific order. Start with the profile schema, then apply company, project, marketplace, emissions, and payment extensions.

Follow the exact sequence and deployment cautions in [Database](docs/database.md). `seed_profiles.sql` is a one-time backfill, not a regular migration.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run Next.js and TypeScript ESLint rules |
| `npm run test:unit` | Run the Vitest unit suite once |
| `npm run build` | Compile and validate a production build |
| `npm run start` | Serve an existing production build |

GitHub Actions runs install, lint, unit tests, and the production build for pushes and pull requests targeting `main`.

## Deployment

The application is designed for Vercel with Supabase and the external providers documented in `.env.example`. Configure production secrets in the hosting platform, apply database changes before dependent application changes, and register the Razorpay webhook endpoint after deployment.

See [Deployment](docs/deployment.md) for the release checklist and rollback guidance.

## Security

- Never expose service-role, payment, email, phone, or Google service-account credentials to browser code.
- Keep `NEXT_PUBLIC_` variables limited to intentionally public client configuration.
- Report vulnerabilities privately by following [SECURITY.md](SECURITY.md).
- Current dependency-audit findings are recorded in [Known issues](docs/known-issues.md); package versions are intentionally unchanged in this repository-polish release.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Contributions should keep route contracts stable, preserve server-side authorization, include focused tests, and pass the full CI workflow.

## License

ZeroCarbon is available under the [MIT License](LICENSE).
