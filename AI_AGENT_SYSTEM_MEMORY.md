# AI_AGENT_SYSTEM_MEMORY

## Document Scope, Baseline, and Evidence Rules

This document is a forensic system memory for the ZeroCarbon codebase in `c:\Users\SUJAL M\Desktop\zerocarbon`.

- Baseline mode: **working tree baseline** (includes uncommitted local modifications).
- Primary code baseline commit: `c7dc525` on branch `master`.
- Current working tree delta included in this memory:
  - Modified:
    - `AI_AGENT_SYSTEM_MEMORY.md`
    - `package-lock.json`
    - `package.json`
    - `src/app/(authenticated)/verify-project/ProjectVerifyForm.tsx`
    - `src/app/(authenticated)/verify-project/page.tsx`
    - `src/app/api/verify-project/route.ts`
  - Untracked:
    - `src/components/verify-project/Form1ProjectInfo.tsx`
    - `src/components/verify-project/Form2Location.tsx`
    - `src/components/verify-project/Form3SellerInfo.tsx`
    - `src/components/verify-project/Form4Ownership.tsx`
    - `src/components/verify-project/Form5LandDetails.tsx`
    - `src/components/verify-project/Form6Evidence.tsx`
    - `src/components/verify-project/Form7Agreement.tsx`
    - `src/components/verify-project/FormProgress.tsx`
    - `src/components/verify-project/MapPinDrop.tsx`
    - `src/components/verify-project/MapPolygonDraw.tsx`
    - `src/lib/data/species.ts`
    - `src/types/verify-project.ts`
    - `supabase/add_polygon_geojson_to_projects.sql`
    - `supabase/add_project_photos_bucket.sql`
    - `supabase/add_project_types_agricultural_windmill.sql`
- External systems referenced but not code-defined:
  - Supabase project settings and storage buckets/policies.
  - Resend account/domain configuration.
  - Twilio Verify service setup.
  - Google Earth Engine service-account permissions.
  - Google Maps JavaScript API project restrictions.
- Secret handling policy in this document:
  - Environment variable names are documented.
  - Environment variable values, API keys, tokens, passwords, and private keys are intentionally omitted.

What changed since the previous memory snapshot:

- Routing moved to an authenticated route-group model with `src/app/(authenticated)/layout.tsx` and path-invisible grouping.
- Mobile nav architecture changed to a fixed 5-tab bottom bar (`src/components/dashboard/MobileBottomBar.tsx`) derived from URL mode.
- Leaflet was removed and map stack is now Google Maps via `@vis.gl/react-google-maps` (`src/components/satellite/*`, `src/app/(authenticated)/projects/map/page.tsx`).
- Project verification evolved to a 7-step wizard implementation (`src/app/(authenticated)/verify-project/ProjectVerifyForm.tsx` + `src/components/verify-project/*`).
- Project photo storage now has a dedicated SQL setup script (`supabase/add_project_photos_bucket.sql`) and upload target `project-photos` bucket.
- GPS-photo policy is currently advisory-only in UI/API (no hard EXIF reject path in current working tree).

Evidence sources used:

- Application routes and UI:
  - `src/app/**/*.tsx`
  - `src/components/**/*.tsx`
  - `src/app/layout.tsx`
  - `src/app/globals.css`
- Auth and Supabase integration:
  - `src/lib/supabase/env.ts`
  - `src/lib/supabase/client.ts`
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/middleware.ts`
  - `src/lib/supabase/service.ts`
  - `src/lib/supabase/admin.ts`
  - `middleware.ts`
- Satellite and geospatial stack:
  - `src/app/(authenticated)/projects/map/page.tsx`
  - `src/components/satellite/MapClientLoader.tsx`
  - `src/components/satellite/GoogleMapClient.tsx`
  - `src/components/satellite/ProjectInfoCard.tsx`
  - `src/hooks/useMapHeight.ts`
  - `src/types/satellite.ts`
  - `src/app/api/satellite/analyze/route.ts`
  - `src/app/api/satellite/projects/route.ts`
  - `src/lib/gee/auth.ts`
  - `src/lib/gee/ndvi-analysis.ts`
  - `src/lib/gee/location-analysis.ts`
  - `src/lib/gee/confidence-calculator.ts`
- Verify-project subsystem:
  - `src/app/(authenticated)/verify-project/page.tsx`
  - `src/app/(authenticated)/verify-project/ProjectVerifyForm.tsx`
  - `src/components/verify-project/*.tsx`
  - `src/types/verify-project.ts`
  - `src/lib/data/species.ts`
  - `src/app/api/verify-project/route.ts`
- Company/profile/verification APIs:
  - `src/app/api/verify-company/route.ts`
  - `src/app/api/verification/submit/route.ts`
  - `src/app/api/phone/send-otp/route.ts`
  - `src/app/api/phone/verify-otp/route.ts`
  - `src/app/api/admin/company-review/route.ts`
  - `src/app/api/admin/project-review/route.ts`
- Database setup and migrations:
  - `supabase/profiles_setup.sql`
  - `supabase/add_companies_and_projects.sql`
  - `supabase/add_company_registration_fields.sql`
  - `supabase/add_satellite_columns.sql`
  - `supabase/add_project_types_agricultural_windmill.sql`
  - `supabase/add_polygon_geojson_to_projects.sql`
  - `supabase/add_project_photos_bucket.sql`
  - `supabase/seed_profiles.sql`
- Build/runtime/toolchain:
  - `package.json`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `next.config.ts`
  - `.env.example`
  - `.gitignore`
- Git history:
  - `git log --oneline`
  - `git status --short`

---

## 1) Project Vision & Intended Product Direction

### Intent

ZeroCarbon is implemented as a dual-persona climate marketplace shell:

- Buyers: company-side dashboard, company verification, satellite map access to verified projects.
- Sellers: project submission/verification and seller dashboard posture.

The product promise remains "verified climate outcomes", and the latest architecture pushes that through identity gating, company/project review workflows, and satellite verification metadata.

### Implementation

Current product surface is grouped into:

1. Public and legal routes (root-level `src/app/*`):
- `/`
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/register-company`
- `/cookie-policy`, `/privacy-policy`, `/terms-of-service`
- `/resources/*`

2. Authenticated route group (`src/app/(authenticated)/*`, URL path-invisible):
- `/dashboard/*`
- `/profile`
- `/projects`
- `/projects/map`
- `/verify-company`
- `/verify-project`
- `/how-it-works`
- `/how-to-offset-emissions`

3. Verification-led product arcs:
- Identity and phone verification gates before company/project workflows.
- Admin tokenized approve/reject flows for company and project.
- Satellite analysis trigger after project approval.

### Risks / Failure Modes

- Marketing narrative is still ahead of monetization/checkout implementation.
- Buyer/seller mode is URL-derived in mobile bar, not persisted user preference.
- Project verification metadata is partially serialized into `review_notes` JSON, creating schema drift risk.

### Safe Modification Approach

1. Preserve route URLs; use route groups for structural changes without URL changes.
2. Preserve gate order for verification-sensitive routes.
3. Treat satellite/project verification as compliance-critical paths and avoid broad refactors without regression tests.

---
## 2) Technical Stack & Architectural Philosophy

### Intent

Use Next.js App Router with SSR auth gates, client-rendered interaction-heavy workflows, Supabase-backed persistence/auth/storage, and Google APIs for geospatial verification.

### Implementation

Framework/runtime/toolchain (`package.json`):

- Next.js `16.1.6`
- React `19.2.3`
- TypeScript strict mode (`tsconfig.json`)
- Tailwind v4 core stack (`tailwindcss`, `@tailwindcss/postcss`)

Key dependencies:

- Auth/data: `@supabase/ssr`, `@supabase/supabase-js`
- Motion/icons: `framer-motion`, `lucide-react`
- Maps: `@vis.gl/react-google-maps`
- Geospatial auth: `google-auth-library`
- Evidence uploads: `exifr` (dependency present; current step-6 logic is advisory-only)
- Infra: `@vercel/functions`, `@vercel/analytics`

Architecture style:

1. Server-first access control:
- Authenticated pages use server-component guards (`redirect` + `supabase.auth.getUser()`).

2. Client interaction modules:
- Wizard forms, map interaction, navbar auth listeners, and mobile bottom nav are client components.

3. Path alias contract:
- `@/*` resolves to `src/*` via `tsconfig.json`.

4. Functional domain slicing:
- `src/components/satellite/*`
- `src/components/verify-project/*`
- `src/lib/gee/*`
- `src/lib/dashboard/*`

### Risks / Failure Modes

- No end-to-end test harness; behavior relies on manual validation.
- Long client orchestrator files (`ProjectVerifyForm.tsx`) increase regression risk.
- Mixed temporary/final schema strategy (typed columns + JSON summary fallback) can cause divergence.

### Safe Modification Approach

1. Keep SSR gates in server components, interaction logic in client components.
2. Add tests before extracting large orchestrators.
3. Prefer additive schema migrations over overloading `review_notes` long-term.

---

## 3) Folder Structure Breakdown

### Intent

Organize around route groups and domain modules while keeping URL stability.

### Implementation

Current high-signal tree:

```text
src/
  app/
    (authenticated)/
      layout.tsx
      dashboard/
        layout.tsx
        page.tsx
        buyer/page.tsx
        seller/page.tsx
      profile/page.tsx
      projects/page.tsx
      projects/map/page.tsx
      verify-company/
        page.tsx
        CompanyVerifyForm.tsx
      verify-project/
        page.tsx
        ProjectVerifyForm.tsx
      how-it-works/page.tsx
      how-to-offset-emissions/page.tsx
    api/
      verify-project/route.ts
      verify-company/route.ts
      satellite/analyze/route.ts
      satellite/projects/route.ts
      admin/project-review/route.ts
      admin/company-review/route.ts
      phone/send-otp/route.ts
      phone/verify-otp/route.ts
      verification/submit/route.ts
      dashboard/route.ts
      dashboard/buyer/stats/route.ts
      dashboard/seller/stats/route.ts
    layout.tsx
    page.tsx
    login/page.tsx
    register/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    register-company/page.tsx
  components/
    dashboard/
      DashboardSidebar.tsx
      MobileBottomBar.tsx
      verification-banner.tsx
    satellite/
      MapClientLoader.tsx
      GoogleMapClient.tsx
      ProjectInfoCard.tsx
    verify-project/
      FormProgress.tsx
      MapPinDrop.tsx
      MapPolygonDraw.tsx
      Form1ProjectInfo.tsx
      Form2Location.tsx
      Form3SellerInfo.tsx
      Form4Ownership.tsx
      Form5LandDetails.tsx
      Form6Evidence.tsx
      Form7Agreement.tsx
    ui/
      zerocarbon-navbar.tsx
      zerocarbon-footer.tsx
      global-tiles-background.tsx
  hooks/
    useMapHeight.ts
  lib/
    supabase/*
    gee/*
    dashboard/*
    data/countries.ts
    data/species.ts
  types/
    dashboard.ts
    satellite.ts
    verify-project.ts
supabase/
  profiles_setup.sql
  add_companies_and_projects.sql
  add_company_registration_fields.sql
  add_satellite_columns.sql
  add_project_types_agricultural_windmill.sql
  add_polygon_geojson_to_projects.sql
  add_project_photos_bucket.sql
```

What changed since previous memory:

- Authenticated route group introduced and now owns dashboard/profile/projects/verify routes plus two marketing pages.
- Satellite and verify-project subsystems now have dedicated component folders.
- New SQL migration scripts for project types, polygon data, and project photo bucket/policies.

### Risks / Failure Modes

- Route moves inside/outside `(authenticated)` can unintentionally change bottom-bar coverage.
- Large domain modules in single files (`ProjectVerifyForm.tsx`, API routes) are hard to review safely.

### Safe Modification Approach

1. Preserve route-group boundaries unless intentionally changing auth shell behavior.
2. Keep domain components split by step/map mode to reduce merge conflicts.
3. Update architecture memory whenever folder moves occur, because URL remains unchanged and can mask structural changes.

---
## 4) Authentication System Deep Dive

### Intent

Enforce layered auth:

- Session integrity via middleware.
- SSR guards for protected pages.
- Profile-state gates for identity/phone-sensitive flows.

### Implementation

Core auth pipeline:

1. Middleware session sync:
- `middleware.ts` -> `src/lib/supabase/middleware.ts` -> `supabase.auth.getUser()` refresh.

2. Client/server Supabase wrappers:
- Browser singleton: `src/lib/supabase/client.ts`
- Server request-bound: `src/lib/supabase/server.ts`
- Service-role clients: `src/lib/supabase/service.ts`, `src/lib/supabase/admin.ts`

3. SSR page guards:
- Example: `src/app/(authenticated)/verify-project/page.tsx`
  - Gate 1: user required.
  - Gate 2: `phone_verified` required.
  - Gate 3: `verification_status === verified` required.

4. Phone verification:
- OTP send: `src/app/api/phone/send-otp/route.ts`
- OTP verify: `src/app/api/phone/verify-otp/route.ts`
- Twilio Verify integration: `src/lib/twilio/verify.ts`

5. Identity verification submission:
- `src/app/api/verification/submit/route.ts`
- Enforces profile identity field completeness and document constraints.

6. Navbar auth state:
- `src/components/ui/zerocarbon-navbar.tsx` uses browser client session listener.

### Risks / Failure Modes

- Any break in middleware cookie refresh causes inconsistent SSR/client auth state.
- Phone verification depends on Twilio service settings and cooldown handling.
- Profile identity lock behavior is partly DB-trigger enforced (`supabase/profiles_setup.sql`); drift between SQL and API assumptions can break updates.

### Safe Modification Approach

1. Keep middleware + SSR guards + client session listener in sync.
2. For auth changes, validate both first render (SSR) and post-login/post-logout client transitions.
3. Treat `profiles_setup.sql` as a runtime contract, not optional documentation.

---

## 5) Database Architecture

### Intent

Model users, identity verification, company verification, project verification, satellite metadata, and storage-based documents/photos.

### Implementation

Primary entities and scripts:

1. Profiles and identity:
- `supabase/profiles_setup.sql`
- `profiles` fields include identity status, phone verification state, identity fields, and verification document metadata.
- Adds `verification_tokens` and `verification_submissions` tables plus secure helper functions.

2. Company and project entities:
- `supabase/add_companies_and_projects.sql`
- `companies` and `carbon_projects` tables with RLS policies.

3. Company schema extensions:
- `supabase/add_company_registration_fields.sql` (existing project script set).

4. Satellite schema extension:
- `supabase/add_satellite_columns.sql`
- Adds status/NDVI/confidence/thumbnail/raw payload/admin token columns and checks/indexes.

5. Project-type and polygon extensions:
- `supabase/add_project_types_agricultural_windmill.sql`
- `supabase/add_polygon_geojson_to_projects.sql`

6. Storage buckets/policies:
- Avatars + verification docs in `supabase/profiles_setup.sql` and `supabase/add_companies_and_projects.sql`.
- Project photos bucket + RLS policies in `supabase/add_project_photos_bucket.sql`.

Current app-level usage notes:

- `src/app/api/verify-project/route.ts` inserts core project fields in native columns.
- Extended payload is currently persisted as JSON string inside `carbon_projects.review_notes` (`submission_metadata` wrapper).
- `polygon_geojson` is inserted into dedicated column when supplied.

What changed since previous memory:

- `carbon_project_type_enum` now includes `agricultural` and `windmill` (migration script present).
- `polygon_geojson` column/index script added.
- Dedicated `project-photos` bucket setup script added.

### Risks / Failure Modes

- Schema/application mismatch:
  - `src/types/satellite.ts` still defines project types as `forestry|solar|methane|other`, while DB/project flow now includes `agricultural` and `windmill`.
- Metadata overload:
  - Review notes carry JSON payload and can collide with human rejection notes usage.
- Bucket policy drift:
  - If SQL scripts are not run in active Supabase project, uploads fail with bucket/policy errors.

### Safe Modification Approach

1. Run SQL scripts in order and verify with `information_schema` before deploying code relying on new columns/buckets.
2. Move extended project fields from `review_notes` to dedicated columns in a staged migration.
3. Keep RLS and path conventions aligned with actual upload paths (`projects/{userId}/...`, `{userId}/...`).

---

## 6) Role-Based Behavior

### Intent

Provide buyer/seller mode UX without full RBAC rewrite, while keeping verification state visible and actionable.

### Implementation

1. Dashboard mode selection:
- `src/components/dashboard/DashboardSidebar.tsx`
- Determines mode from pathname (`/dashboard/seller` -> seller, else buyer).

2. Mobile bottom bar mode:
- `src/components/dashboard/MobileBottomBar.tsx`
- Derives mode from pathname.
- Center toggle switches buyer/seller dashboards.

3. Buyer-side links and CTAs:
- Sidebar buyer links include `Satellite Map` to `/projects/map`.
- Company registration CTA/state card based on `companies.status` and identity state.

4. Seller-side CTA:
- Sidebar includes `Verify Your Project` to `/verify-project`.

5. Verification banner model:
- `src/lib/dashboard/verification-banner.ts`
- Banner messaging based on phone and identity verification state.

### Risks / Failure Modes

- Mode is URL-derived; if paths change without updating logic, mode labels/routes break.
- No backend role-policy enforcement for many "role" behaviors; current model is UX-driven.

### Safe Modification Approach

1. Keep mode derivation logic centralized in sidebar/mobile bar.
2. If persistent dashboard mode is reintroduced, define clear precedence vs URL.
3. Do not infer security policy from UI mode.

---
## 7) Navbar Architecture

### Intent

Maintain a consistent top navigation shell plus authenticated mobile bottom navigation.

### Implementation

1. Root navbar:
- `src/components/ui/zerocarbon-navbar.tsx`
- Fixed top glass navbar in `src/app/layout.tsx`.
- Desktop authenticated dropdown: Profile, Dashboard, Logout.
- Mobile dropdown hides Profile and Dashboard below `md` (`hidden md:block`), keeps nav links and logout.

2. Authenticated bottom bar:
- `src/components/dashboard/MobileBottomBar.tsx`
- Rendered only by `src/app/(authenticated)/layout.tsx` when user exists.
- 5 tabs: Home, Satellite, Toggle, Company, Profile.
- Toggle button is elevated and mode-aware.

3. Layout interaction:
- Authenticated layout adds bottom padding `pb-[calc(5rem+env(safe-area-inset-bottom))]` to prevent content overlap.

What changed since previous memory:

- Bottom bar moved from dashboard-scoped rendering to route-group layout rendering.
- `/how-it-works` and `/how-to-offset-emissions` now receive the same authenticated-shell bottom bar behavior for logged-in users.

### Risks / Failure Modes

- Double rendering if a nested layout reintroduces `MobileBottomBar`.
- If route is moved outside `(authenticated)`, bottom bar disappears for that route.

### Safe Modification Approach

1. Keep bottom bar render ownership in one place (`src/app/(authenticated)/layout.tsx`).
2. Keep navbar desktop/mobile behavior split explicit.
3. Validate at breakpoints 767px and 768px whenever dropdown classes change.

---

## 8) Email System

### Intent

Use transactional email for admin review workflows and user status notifications.

### Implementation

1. Identity verification admin emails:
- Trigger path: `src/app/api/verification/submit/route.ts`
- Sender helper: `src/lib/verification/send-verification-email.ts`

2. Company review email loop:
- Submission route: `src/app/api/verify-company/route.ts`
- Admin action route: `src/app/api/admin/company-review/route.ts`
- Includes approve/reject token links and rejection-reason roundtrip form.

3. Project review email loop:
- Submission route: `src/app/api/verify-project/route.ts`
- Admin action route: `src/app/api/admin/project-review/route.ts`
- Approval triggers satellite analysis asynchronously via `waitUntil`.

4. Provider/config:
- Resend endpoint integration via `RESEND_API_KEY` and `ADMIN_EMAIL`.
- Base URL via `NEXT_PUBLIC_APP_URL`.

### Risks / Failure Modes

- Missing Resend/admin env values degrade to partial success (submission can succeed while email send fails).
- Tokenized action links depend on correct `NEXT_PUBLIC_APP_URL`.

### Safe Modification Approach

1. Keep email failure non-fatal for primary write path where intended.
2. Keep token expiry and one-time-use invalidation semantics intact.
3. Add provider health alerts outside app runtime for production reliability.

---

## 9) Rate Limiting & Hardening Strategy

### Intent

Prevent abuse and accidental spam across OTP, verification submissions, and resubmits.

### Implementation

Current hardening controls in code:

1. OTP resend cooldown:
- `src/app/api/phone/send-otp/route.ts`
- 60 seconds based on `profiles.phone_otp_last_sent_at`.

2. Verification submission cooldown:
- `src/app/api/verification/submit/route.ts`
- 5 minutes based on `verification_submissions.submitted_at`.

3. Company resubmission cooldown:
- `src/app/api/verify-company/route.ts`
- 60 seconds based on `companies.submitted_at`.

4. Identity gate before company/project submit:
- Company route checks verified phone + identity.
- Project page route checks verified phone + identity before rendering form.

5. File/type validation:
- Ownership docs and verification docs have type/size checks in client/API.
- Project photos currently enforce type/size and required count (no hard EXIF check).

### Risks / Failure Modes

- Cooldowns are per-row timestamp checks, not distributed global throttles.
- API/DB drift can bypass expected safeguards if columns/functions are missing.

### Safe Modification Approach

1. Keep cooldown constants and user-facing retry messages aligned.
2. Add structured telemetry for repeated 429/409 patterns.
3. If abuse increases, add edge-level rate limiting in front of route handlers.

---

## 10) Environment Variables

### Intent

Keep runtime config explicit and secret-safe while supporting Supabase, Twilio, Resend, Maps, and GEE.

### Implementation

Documented names in `.env.example`:

Supabase and app base:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Email and phone:
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `ADMIN_EMAIL`

Google Earth Engine:
- `GEE_PROJECT_ID`
- `GEE_SERVICE_ACCOUNT_EMAIL`
- `GEE_SERVICE_ACCOUNT_KEY`
- `GEE_DEFAULT_DATASET`
- `GEE_NDVI_RED_BAND`
- `GEE_NDVI_NIR_BAND`

Maps and internal calls:
- `GOOGLE_MAPS_STATIC_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `INTERNAL_API_SECRET`

### Risks / Failure Modes

- Missing env values cause runtime errors in map, GEE, email, or service-role flows.
- `GEE_SERVICE_ACCOUNT_KEY` must be valid JSON; malformed values fail auth.

### Safe Modification Approach

1. Keep env access centralized in helper modules where possible.
2. Never commit secret values in docs or repository files.
3. Validate env completeness in deployment pipeline before rollout.

---
## 11) Routing Contracts

### Intent

Define stable URL behavior, guard order, and route-group implications.

### Implementation

Key routing contracts:

1. Route-group invisibility:
- Files moved under `src/app/(authenticated)/**` keep same public URLs.

2. Authenticated shell ownership:
- `src/app/(authenticated)/layout.tsx` controls bottom-bar rendering and bottom content padding for logged-in sessions.

3. Verify-project gates (strict order):
- `src/app/(authenticated)/verify-project/page.tsx`
  - Not logged in -> `/login?redirect=/verify-project`
  - Phone not verified -> `/profile?message=verify-phone`
  - Identity not verified -> `/profile?message=verify-identity`

4. Projects map gate:
- `src/app/(authenticated)/projects/map/page.tsx`
  - Not logged in -> `/login?redirect=/projects/map`
  - Not fully verified -> `/profile?message=verify-to-access-map`

5. Map import chain contract:
- `src/app/(authenticated)/projects/map/page.tsx`
  -> `src/components/satellite/MapClientLoader.tsx`
  -> dynamic import of `src/components/satellite/GoogleMapClient.tsx` with `ssr: false`.

6. Dashboard mode routes:
- Buyer home: `/dashboard/buyer`
- Seller home: `/dashboard/seller`
- Toggle and home route decisions in `MobileBottomBar.tsx` are URL-derived.

What changed since previous memory:

- Dashboard, profile, projects, verify-company, verify-project, and two marketing pages are now route-grouped under `(authenticated)`.

### Risks / Failure Modes

- Breaking chain `page -> loader -> map client` can reintroduce map SSR race issues.
- Moving pages out of `(authenticated)` accidentally removes bottom-bar coverage for logged-in users.

### Safe Modification Approach

1. Keep route-group migration atomic with layout behavior checks.
2. Preserve redirect query conventions (`redirect`, `message`).
3. Validate map page imports to prevent direct server import of map client.

---

## 12) Known Constraints (Architectural and Contractual Invariants)

### Intent

Capture invariants that must hold to avoid silent behavior regressions.

### Implementation

1. Protected auth/data layers:
- `src/lib/supabase/*` wrappers are contract-critical.
- Middleware-driven auth refresh is required for SSR consistency.

2. Bottom bar ownership:
- Must be rendered only by `src/app/(authenticated)/layout.tsx`.

3. Verify-project step behavior:
- 7-step progress always shown.
- Step 5 is skipped for non-land project types by orchestrator logic.

4. Map mode split:
- Pin mode for `solar|methane|windmill`.
- Polygon mode for `forestry|agricultural`.

5. Storage path contracts:
- Ownership docs: `verification-documents/projects/{userId}/...`.
- Project photos: `project-photos/{userId}/...`.

6. Advisory-only GPS policy (current working tree):
- UI warning is present, but GPS EXIF is not hard-enforced.
- `photo_gps_data` currently sent as empty array from client submit flow.

7. Satellite project typing mismatch (current risk invariant):
- Satellite route/typing currently model `other` but not `agricultural|windmill` in all places.

### Risks / Failure Modes

- Contract mismatches between UI, API payload, and DB columns can fail late during submission/review.
- Invariants encoded in prompt history may not match current code if not reconciled in memory.

### Safe Modification Approach

1. Treat this section as canonical for cross-agent changes.
2. Update contracts here whenever behavior changes, even if URL/UX appears unchanged.
3. Prefer explicit compile-time types for evolving enum domains.

---

## 13) Known Bugs Fixed Historically (Evidence-Backed)

### Intent

Track high-impact fixes already landed to avoid regression reintroduction.

### Implementation

Evidence-backed fixes from recent commit history:

1. URL-derived mobile mode fix:
- Commit `c7dc525`.
- Mobile mode no longer depends on server-provided dashboard mode prop; derived from pathname.

2. Authenticated route-group bottom-nav rollout:
- Commit `ef233f9`.
- Bottom bar moved to authenticated layout and dashboard-level duplication removed.

3. Leaflet removal and Google Maps migration:
- Commit `f3e2db1`.
- Satellite map stack now uses `@vis.gl/react-google-maps`.

4. Phone verification hardening:
- Commits `81d1f1f`, `9c28916`, `7e73c92`, `91d1305`.
- Twilio Verify integration and improved OTP flow/error handling.

5. Verification banner/dashboard identity gate improvements:
- Commit `c9d74f3`.

Working-tree fixes in progress (not committed yet):

- Full 7-step verify-project wizard implementation and expanded verify-project API payload handling.
- Project photo upload path and bucket setup scripts.
- GPS policy changed to advisory-only in evidence step.

### Risks / Failure Modes

- Regression risk is high if old assumptions (Leaflet, server mode prop, root route locations) are reintroduced.

### Safe Modification Approach

1. Reference commit IDs before undoing architecture-level behavior.
2. For in-progress changes, convert to committed atomic units to reduce drift between memory and branch state.

---
## 14) Testing Assumptions

### Intent

Define current testing reality and required validation gates for safe delivery.

### Implementation

Current test posture:

- Unit coverage is minimal; one known test exists: `src/lib/dashboard/verification-banner.test.ts`.
- Most feature validation is manual for now.
- Quality gates expected by workflow:
  - `npm run lint`
  - `npm run build`

High-priority manual tests for current architecture:

1. Auth and route gating:
- Verify redirects for `/verify-project` and `/projects/map` under all gate states.

2. Bottom bar behavior:
- Check routes inside `(authenticated)` on mobile viewport.
- Validate mode toggle on `/dashboard/buyer` and `/dashboard/seller`.

3. Verify-project wizard:
- Step skip logic 4 -> 6 for non-land projects.
- Polygon draw + redraw behavior for land projects.
- Required photo slots and file constraints.
- Sequential upload and error surfacing in submit flow.

4. Satellite map:
- Map load via loader chain.
- Marker click/info window behavior.
- Empty projects overlay.

### Risks / Failure Modes

- No integration tests for multi-step submit and storage upload paths.
- API contract shifts can pass lint/build while failing runtime payload expectations.

### Safe Modification Approach

1. Add integration tests for verify-project and map gate flows before further complexity.
2. Keep manual QA checklist versioned in repo until automated coverage exists.
3. Run lint/build after every architecture-level change set.

---

## 15) Development Guardrails for Next Agent

### Intent

Reduce accidental breakage in a rapidly evolving branch with mixed committed/uncommitted architecture work.

### Implementation

Guardrails:

1. Preserve protected infrastructure contracts:
- Do not bypass `src/lib/supabase/*` wrappers.
- Do not remove middleware auth refresh path.

2. Preserve routing shell contracts:
- Keep `(authenticated)` layout responsible for bottom bar.
- Do not break map import chain (`page -> MapClientLoader -> GoogleMapClient`).

3. Preserve verification gate order and redirect query conventions.

4. Preserve storage path conventions and ensure SQL bucket policies match code paths.

5. Keep API and type enums synchronized (project types especially).

6. Do not document or commit secret values; only env names.

7. When updating memory, explicitly separate committed baseline from working-tree delta.

### Risks / Failure Modes

- Editing APIs without SQL/type sync introduces hidden runtime failures.
- Moving routes across groups can silently change authenticated shell behavior.

### Safe Modification Approach

1. Make behavior changes in small commits with matching docs update.
2. Validate changed contracts in `Implicit Contracts Index` and `Risk Register` each time.
3. Keep migrations idempotent and tied to feature PRs.

---

## 16) Future Roadmap & Extension Points (Inferred from Current Skeleton)

### Intent

Capture realistic next-phase work implied by the current architecture and known debt.

### Implementation

Near-term roadmap candidates:

1. Verify-project schema normalization:
- Move metadata fields from `review_notes` JSON into dedicated `carbon_projects` columns.

2. Satellite domain sync:
- Align all map/satellite types and analysis paths with `agricultural` and `windmill`.

3. Storage robustness:
- Add startup checks/tooling for bucket existence and policy drift.

4. Verification UX hardening:
- Optional server-side GPS validation policy if business rules re-enable hard enforcement.

5. Testing:
- Add route-gate integration tests and submit/upload flow tests.

6. Observability:
- Structured logs and alerting for email send failures, upload failures, and satellite trigger failures.

### Risks / Failure Modes

- Continued metadata-overload approach will complicate admin tooling and analytics.
- Satellite-type mismatch can produce silent review pipeline failures for new project types.

### Safe Modification Approach

1. Prioritize schema and type alignment before adding more workflow branches.
2. Add migration verification scripts to CI/CD.
3. Add explicit health checks for external dependencies (Resend, Twilio, GEE, Maps).

---

## Working Tree Delta vs HEAD (Required)

Baseline commit: `c7dc525`  
Current delta: 6 modified tracked files + 15 untracked files.

Tracked modifications:

1. `AI_AGENT_SYSTEM_MEMORY.md`
- Full architecture memory refresh to match current route groups, satellite stack, verify-project wizard, storage scripts, and git baseline.

2. `package.json`
- Dependency set reflects verify-project and maps-era stack (`exifr`, `@vis.gl/react-google-maps`, `google-auth-library`).

3. `package-lock.json`
- Lockfile sync for dependency changes.

4. `src/app/(authenticated)/verify-project/ProjectVerifyForm.tsx`
- Large orchestrator rewrite for 7-step flow.
- Includes draft autosave, step skip logic, sequential ownership/photo uploads, and final API submission payload expansion.
- Current behavior sends `photo_gps_data: []` and does not enforce EXIF GPS.

5. `src/app/(authenticated)/verify-project/page.tsx`
- SSR gate order implemented (login -> phone verify -> identity verify).
- Hosts page header and form mount.

6. `src/app/api/verify-project/route.ts`
- Expanded payload parsing/validation for new wizard fields.
- Accepts project types including `agricultural` and `windmill`.
- Stores extended metadata in `review_notes` JSON wrapper pending dedicated columns.

Untracked additions:

1. Verify-project components:
- `src/components/verify-project/FormProgress.tsx`
- `src/components/verify-project/MapPinDrop.tsx`
- `src/components/verify-project/MapPolygonDraw.tsx`
- `src/components/verify-project/Form1ProjectInfo.tsx`
- `src/components/verify-project/Form2Location.tsx`
- `src/components/verify-project/Form3SellerInfo.tsx`
- `src/components/verify-project/Form4Ownership.tsx`
- `src/components/verify-project/Form5LandDetails.tsx`
- `src/components/verify-project/Form6Evidence.tsx`
- `src/components/verify-project/Form7Agreement.tsx`

2. Verify-project type/data:
- `src/types/verify-project.ts`
- `src/lib/data/species.ts`

3. Supabase SQL scripts:
- `supabase/add_project_types_agricultural_windmill.sql`
- `supabase/add_polygon_geojson_to_projects.sql`
- `supabase/add_project_photos_bucket.sql`

Inference:

- Working tree includes major verify-project architecture not yet committed.
- Runtime behavior depends on SQL scripts being applied in the target Supabase project.

---
## Commit Timeline Snapshot (Required)

Committed timeline (latest first):

1. `c7dc525` - fix(nav): derive mobile mode from URL and include marketing pages in authenticated layout
2. `ef233f9` - feat(nav): add authenticated route group and implement approved mobile navigation
3. `c3701aa` - merge: resolve package/layout conflicts with origin/main
4. `f3e2db1` - feature: satellite verification flow + Google Maps project map
5. `c9d74f3` - feature: dashboard verification gate and sticky in-content banner
6. `7e73c92` - feature: profile phone verification UX redesign + toast system
7. `9c28916` - feature: Twilio Verify migration
8. `81d1f1f` - fix: OTP verification hardening and 422 handling
9. `b81c1c3` - fix: Turbopack root pin
10. `61b71f2` - chore: viewport themeColor/turbopack root updates
11. `91d1305` - feature: phone OTP verification and profile verification hardening
12. `397eac2` - harden verification email links + browser review route

Working-tree-only changes (not yet committed):

- Verify-project 7-step subsystem implementation files.
- Verify-project API payload/storage extension changes.
- New SQL scripts for project types, polygon, and project photo bucket/policies.

---

## Risk Register (Required)

| ID | Risk | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| R-001 | Bucket/policy drift causes upload failures | High | `supabase/add_project_photos_bucket.sql`, `ProjectVerifyForm.tsx` upload target `project-photos` | Apply SQL in each environment; add environment readiness checks |
| R-002 | Advisory-only GPS policy can reduce evidence integrity | High | `Form6Evidence.tsx` warning-only, `ProjectVerifyForm.tsx` sends empty `photo_gps_data` | Define explicit reviewer SOP or reintroduce server-side GPS validation |
| R-003 | Route-group/auth shell coupling can silently change bottom-bar coverage | Medium | `src/app/(authenticated)/layout.tsx`, route-group move pattern | Validate route placement before merge; add coverage tests |
| R-004 | API/DB schema drift due metadata-heavy `review_notes` storage | High | `src/app/api/verify-project/route.ts` TODO + metadata JSON in review notes | Add dedicated columns and migration/backfill plan |
| R-005 | Satellite type mismatch for new project types (`agricultural`,`windmill`) | High | `src/app/api/satellite/analyze/route.ts` accepted types vs verify-project types | Expand satellite type parser and downstream typings |
| R-006 | Satellite map typing drift (`src/types/satellite.ts`) excludes new types | Medium | `ProjectType` union currently `forestry|solar|methane|other` | Align type unions across map/API/DB |
| R-007 | No integration tests on multi-step submission and storage upload | High | manual validation only, large orchestrator | Add end-to-end tests for submit path and error states |
| R-008 | External dependency outages degrade async workflows | Medium | Resend/Twilio/GEE calls in APIs | Add retry/alerting and clear partial-failure UX |
| R-009 | Encoding artifacts in map info card text (mojibake arrows/icons) | Low | `src/components/satellite/ProjectInfoCard.tsx`, `GoogleMapClient.tsx` | Normalize UTF-8 literals and add lint/check for encoding |
| R-010 | Long client/server files increase merge conflict and review risk | Medium | `ProjectVerifyForm.tsx`, `verify-project` API route size | Continue componentization + handler extraction |

---

## Implicit Contracts Index (Required)

| Contract ID | Producer | Consumer | Contract | Breakage Effect |
|---|---|---|---|---|
| IC-001 | `src/lib/supabase/env.ts` | all Supabase clients | Required env names must be present | startup/runtime auth failure |
| IC-002 | `src/lib/supabase/middleware.ts` | `middleware.ts`, SSR pages | `auth.getUser()` refresh keeps cookies in sync | stale session behavior |
| IC-003 | `src/app/(authenticated)/layout.tsx` | all authenticated routes | bottom bar render + bottom padding ownership | missing/duplicate bottom nav |
| IC-004 | `src/components/dashboard/MobileBottomBar.tsx` | authenticated users | mode derived from pathname (`/dashboard/seller`) | wrong home/toggle route behavior |
| IC-005 | `src/components/dashboard/DashboardSidebar.tsx` | dashboard layout | buyer link includes `/projects/map` and company CTA rules | navigation regressions |
| IC-006 | `src/app/(authenticated)/projects/map/page.tsx` | map feature | must import `MapClientLoader`, not direct map client | SSR map breakage |
| IC-007 | `src/components/satellite/MapClientLoader.tsx` | map page | dynamic import with `ssr:false` | client-only map load failures |
| IC-008 | `src/hooks/useMapHeight.ts` | `GoogleMapClient.tsx` | runtime navbar/footer measurement for map height | clipped or oversized map |
| IC-009 | `src/components/verify-project/Form2Location.tsx` | wizard orchestrator | project type controls pin vs polygon map mode | invalid location capture |
| IC-010 | `src/components/verify-project/MapPolygonDraw.tsx` | `Form2Location.tsx` | emits GeoJSON + hectares via callback | step-2 validation failure |
| IC-011 | `src/components/verify-project/Form6Evidence.tsx` | `ProjectVerifyForm.tsx` | first two photo slots required, accepted mime/size constraints | submit blocked or invalid uploads |
| IC-012 | `ProjectVerifyForm.tsx` | `/api/verify-project` | payload field names and shapes must match API parser | 400 submit failures |
| IC-013 | `/api/verify-project` | `carbon_projects` schema | expects `polygon_geojson` and compatible enum values | insert/validation failure |
| IC-014 | `supabase/add_project_photos_bucket.sql` | photo upload flow | bucket name `project-photos` and folder policy `[1]=auth.uid()` | "Bucket not found" or RLS denial |
| IC-015 | `src/app/api/admin/project-review/route.ts` | satellite pipeline | approved projects trigger `/api/satellite/analyze` with internal secret | satellite status stalls/fails |
| IC-016 | `src/app/api/satellite/analyze/route.ts` | `carbon_projects` satellite fields | accepted project types must match verification domain | failed analysis for new types |
| IC-017 | `src/app/api/verify-company/route.ts` | company form | identity gate required before company submission | unauthorized workflow access |
| IC-018 | `src/app/api/verification/submit/route.ts` | profile flow | identity field completeness + doc rules before pending | inconsistent verification states |

---

## Glossary (Required)

- **Authenticated route group**: Next.js App Router folder `(authenticated)` that is URL-invisible but layout-active.
- **SSR guard**: Server-component auth/profile check with `redirect(...)` on failure.
- **Satellite status**: `pending|processing|completed|failed` lifecycle in `carbon_projects`.
- **Polygon GeoJSON**: Land-project boundary saved in `carbon_projects.polygon_geojson`.
- **Advisory-only GPS policy**: UI warning for GPS-enabled photos without strict client/API EXIF enforcement.
- **Submission metadata JSON**: Extended verify-project payload currently serialized into `carbon_projects.review_notes`.
- **Internal secret hop**: `x-internal-secret` header used between admin approval path and satellite analyze route.
- **Path-invisible grouping**: Next route groups that alter file structure/layout composition without URL path segment changes.

---

## Technical Debt Ledger

1. Verify-project extended fields are not fully normalized into dedicated DB columns.
2. Satellite type unions/parsers are not fully aligned with newly added project types.
3. Multi-step wizard has limited automated coverage and high orchestration complexity.
4. Photo evidence policy changed from strict GPS to advisory without explicit reviewer-audit tooling.
5. Encoding artifacts present in some map UI text literals.
6. SQL migration execution is manual; no automatic environment drift detection.
7. Lack of shared contract tests between form payload and API parser.

---

## Conventions and Style Contracts

1. App Router routes use `src/app/**/page.tsx` and group layouts.
2. Shared imports use `@/*` alias.
3. Tailwind utility-first styling with rounded-card dashboard/map aesthetic.
4. Client/server boundaries are explicit via `'use client'` and server component defaults.
5. Domain modules live under `src/components/{dashboard,satellite,verify-project}`.
6. SQL scripts are idempotent and stored under `supabase/*.sql`.
7. Sensitive config is env-driven; only variable names appear in code/docs.

---

## Security Considerations Summary

1. Auth session refresh and SSR guards are active on protected routes.
2. Service-role operations are isolated to server-only helpers/routes.
3. Company/project admin actions use one-time token links with expiry.
4. Storage access uses per-user folder policy patterns.
5. Remaining security concern:
- Project evidence GPS is advisory-only in current working tree, so authenticity relies more on manual review.

---

## Validation Checklist Outcome

1. Required top-level sections `## 1)` through `## 16)` are present.
2. Required appendices are present in the mandated order.
3. Baseline reflects current branch/commit and working-tree reality.
4. Architecture sections include current route-group, satellite map stack, verify-project wizard, and storage SQL setup.
5. `Working Tree Delta vs HEAD` aligns with current `git status --short` at documentation time.
6. No secret values are included; env names only.
7. File path references are explicit to support handoff to other AI models.
