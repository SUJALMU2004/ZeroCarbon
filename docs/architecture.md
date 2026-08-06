# Architecture

## Product boundaries

ZeroCarbon is a single Next.js App Router application with server-rendered access control and client components for interaction-heavy workflows.

- `src/app` owns route composition, server components, and HTTP handlers.
- `src/components` owns reusable and feature-specific UI.
- `src/lib` owns domain calculations, validation, database clients, and external provider adapters.
- `src/types` contains contracts shared across routes and components.
- `supabase` contains the database and storage changes required by the application.

The `(authenticated)` route group organizes signed-in product pages without changing their public URLs. Authentication cookies are refreshed by the root middleware, while protected pages and API routes verify the current user on the server.

## Core flows

### Identity and company verification

Supabase provides user identity. Phone verification uses Twilio Verify, identity evidence is stored privately, and company submissions are reviewed through tokenized administrative email links. Server-side checks gate company and project workflows.

### Project verification

Sellers submit project metadata, map coordinates or polygons, ownership declarations, and evidence. Supported project models are forestry, agricultural, solar, methane, and windmill. Approval can trigger Google Earth Engine analysis; derived satellite and valuation fields are persisted for marketplace use.

### Emissions assessment

Buyer companies enter operational data for Scope 1, 2, and 3 calculations. Provider adapters resolve emission factors, deterministic math produces totals, and assessment records retain inputs and diagnostics for later dashboards.

### Marketplace and payments

Verified projects are readable across authenticated accounts through Row Level Security. Razorpay orders reserve inventory before checkout. Signed verification and webhooks finalize or release credits, while immutable snapshots support order history.

## Trust boundaries

- Browser input is untrusted and must be validated again in route handlers.
- The Supabase anon client is user-scoped through cookies and Row Level Security.
- Service-role access bypasses Row Level Security and must follow an explicit authentication and authorization check.
- Payment signatures, webhook signatures, admin tokens, and internal API secrets are verified server-side.
- Storage evidence remains private and is exposed through short-lived signed URLs.

## Extension guidelines

Preserve route URLs and response contracts where possible. Add domain tests before changing valuation or emissions math, use additive database scripts, and keep external-provider failures observable without leaking secrets or customer payloads.
