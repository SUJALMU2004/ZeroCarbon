# AI_AGENT_SYSTEM_MEMORY

## Document Scope, Baseline, and Evidence Rules

This document is a forensic system memory for the ZeroCarbon codebase in `c:\Users\SUJAL M\Desktop\zerocarbon`.

- Baseline mode: **working tree baseline** (includes uncommitted local modifications).
- Primary code baseline commit: `53959a1` on branch `master`.
- Working tree delta files included in this memory:
  - `src/components/auth/forgot-password-form.tsx`
  - `src/components/auth/login-form.tsx`
  - `src/components/auth/register-form.tsx`
  - `src/components/auth/reset-password-form.tsx`
  - `src/components/ui/zerocarbon-navbar.tsx`
  - `src/lib/supabase/client.ts`
- External systems referenced but not code-defined: Supabase dashboard settings (Site URL, redirect allowlist, email templates).
- Secret handling policy in this document:
  - Environment variable **names** are documented.
  - Environment variable values, API keys, tokens, passwords, and any secret material are intentionally omitted.

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
  - `middleware.ts`
- Database setup:
  - `supabase/profiles_setup.sql`
  - `supabase/seed_profiles.sql`
- Build/runtime/toolchain:
  - `package.json`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `postcss.config.mjs`
  - `next.config.ts`
  - `.env.example`
  - `.gitignore`
  - `public/favicon/site.webmanifest`
- Git history:
  - `git log --oneline`
  - `git show` for commits `2f43709`, `aea56e4`, `53959a1`, `c47e00f`

---

## 1) Project Vision & Intended Product Direction

### Intent

The product intent, as implemented in public-facing content, is a climate-tech marketplace that enables emissions offsetting through verified carbon projects. The platform positions itself for both individuals and companies, with messaging around impact transparency, project verification, and dashboard-driven account visibility.

This is inferred directly from:

- Landing narrative in `src/app/page.tsx`
- Footer product copy in `src/components/ui/zerocarbon-footer.tsx`
- Route labels and public route set in `src/components/ui/zerocarbon-navbar.tsx`
- Company onboarding placeholder in `src/app/register-company/page.tsx`
- Resource/legal content pages under `src/app/resources/**`, `src/app/privacy-policy/page.tsx`, `src/app/terms-of-service/page.tsx`, `src/app/cookie-policy/page.tsx`

### Implementation

Current product surface is split into:

1. Marketing/informational pages:
- `/` (`src/app/page.tsx`)
- `/how-to-offset-emissions` (`src/app/how-to-offset-emissions/page.tsx`)
- `/how-it-works` (`src/app/how-it-works/page.tsx`)
- `/projects` (`src/app/projects/page.tsx`)
- `/resources/*` pages (four pages in `src/app/resources/**`)
- Legal pages (`/privacy-policy`, `/terms-of-service`, `/cookie-policy`)

2. Authentication and account pages:
- `/login` (`src/app/login/page.tsx`)
- `/register` (`src/app/register/page.tsx`)
- `/forgot-password` (`src/app/forgot-password/page.tsx`)
- `/reset-password` (`src/app/reset-password/page.tsx`)

3. Protected authenticated pages:
- `/dashboard` (`src/app/dashboard/page.tsx`)
- `/profile` (`src/app/profile/page.tsx`)

4. Enterprise/company intent placeholder:
- `/register-company` (`src/app/register-company/page.tsx`) currently static placeholder copy, no data capture logic.

User-role-like personas implied by current behavior:

- Guest visitor:
  - Can browse all public marketing/resource/legal pages.
  - Sees guest navbar CTAs (`Register Company`, `Register / Login`) in `src/components/ui/zerocarbon-navbar.tsx`.
- Authenticated user:
  - Redirected away from auth-entry pages (`/login`, `/register`, `/forgot-password`) to `/dashboard`.
  - Sees avatar-based profile dropdown in navbar with Profile, Dashboard, Logout.
  - Can access `/dashboard` and `/profile`.
- Company/enterprise actor (future):
  - Landing CTA and page exist, but no backend/company schema currently implemented in this repository.

Development stage inferred from implementation:

- Frontend maturity: medium (responsive, branded, consistent layout and components).
- Auth maturity: foundational and actively hardened (login/register/forgot/reset + navbar auth state + protected routes).
- Domain workflows (project catalog, purchasing, retirement, reporting automation): mostly placeholder content.

### Risks / Failure Modes

- Product narrative exceeds implemented transactional capability; users may expect purchase workflows not yet present.
- `/register-company` implies business onboarding but has no persistence flow; risk of user confusion.
- Legal and policy pages are clearly placeholder-level and may not satisfy production legal requirements.

### Safe Modification Approach

1. Treat current messaging as intent contract, not functional contract.
2. When adding real marketplace features, preserve existing route URLs to avoid navigation regression.
3. Add explicit "coming soon" cues if functionality remains placeholder.
4. Keep protected-route conventions unchanged (`/dashboard`, `/profile`) to avoid auth regressions while extending product scope.

---

## 2) Technical Stack & Architectural Philosophy

### Intent

Use a modern Next.js App Router stack with Supabase authentication, strong SSR protection for sensitive routes, and client-side interactivity for auth forms/nav state transitions.

### Implementation

Framework/runtime/toolchain (`package.json`):

- Next.js `16.1.6`
- React `19.2.3`
- TypeScript `^5`
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Supabase client libs:
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- UI utilities:
  - `clsx`
  - `tailwind-merge`
  - `framer-motion`

Architecture style:

1. App Router with mixed SSR + CSR:
- Server components used for route guarding and server-side data fetch (`/login`, `/register`, `/forgot-password`, `/dashboard`, `/profile` pages).
- Client components used for interactive auth flows and navbar live auth state:
  - `src/components/auth/*.tsx`
  - `src/components/ui/zerocarbon-navbar.tsx`

2. Supabase auth model:
- Only anon public credentials used via env contract (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.example`, consumed by `src/lib/supabase/env.ts`).
- Server client wrapper in `src/lib/supabase/server.ts`.
- Browser client wrapper in `src/lib/supabase/client.ts`.
- Middleware session update layer in `src/lib/supabase/middleware.ts` + root `middleware.ts`.

3. Middleware strategy:
- `middleware.ts` applies `updateSession(request)` to almost all non-static routes.
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and common asset extensions.
- `updateSession` triggers `supabase.auth.getUser()` to refresh auth cookies.

4. State management philosophy:
- No global app state store.
- Local component state in auth forms and navbar.
- Auth state changes streamed via `supabase.auth.onAuthStateChange` in navbar and reset-password flow.

5. Build and lint:
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run start`.
- Build/lint are currently passing in this working tree.

### Risks / Failure Modes

- No typed DB schema generation layer; query fields are stringly typed (`.from("profiles").select("role, created_at")`).
- No centralized error telemetry pipeline in codebase.
- No dedicated global state layer means auth UI consistency relies on correct listener wiring.
- Middleware matcher may need updates if new asset extension types are added.

### Safe Modification Approach

1. Preserve Supabase wrapper abstraction (`src/lib/supabase/*`) and consume wrappers rather than direct raw clients.
2. Preserve server/client boundary:
- Route guards in server components.
- Form interactions and auth listeners in client components.
3. Keep middleware behavior deterministic; do not remove `auth.getUser()` refresh step without replacement.
4. If introducing typed schemas, migrate incrementally and keep runtime behavior unchanged first.

---

## 3) Folder Structure Breakdown

### Intent

Current repository structure separates:

- App Router route modules
- Reusable UI/auth components
- Supabase infrastructure wrappers
- SQL setup scripts
- Public static assets and favicon pack

### Implementation

Repository tree (application-relevant; excludes `.next`, `node_modules`, `.git`):

```text
.
|-- .env.example
|-- .env.local                (local-only runtime file, gitignored)
|-- .gitignore
|-- eslint.config.mjs
|-- middleware.ts
|-- next-env.d.ts
|-- next.config.ts
|-- package-lock.json
|-- package.json
|-- postcss.config.mjs
|-- README.md
|-- tsconfig.json
|-- public
|   |-- ZeroCarbon.png
|   `-- favicon
|       |-- android-chrome-192x192.png
|       |-- android-chrome-512x512.png
|       |-- apple-touch-icon.png
|       |-- favicon-16x16.png
|       |-- favicon-32x32.png
|       |-- favicon.ico
|       `-- site.webmanifest
|-- src
|   |-- app
|   |   |-- cookie-policy/page.tsx
|   |   |-- dashboard/page.tsx
|   |   |-- forgot-password/page.tsx
|   |   |-- globals.css
|   |   |-- how-it-works/page.tsx
|   |   |-- how-to-offset-emissions/page.tsx
|   |   |-- layout.tsx
|   |   |-- login/page.tsx
|   |   |-- page.tsx
|   |   |-- privacy-policy/page.tsx
|   |   |-- profile/page.tsx
|   |   |-- projects/page.tsx
|   |   |-- register/page.tsx
|   |   |-- register-company/page.tsx
|   |   |-- reset-password/page.tsx
|   |   |-- resources
|   |   |   |-- carbon-market-integrity/page.tsx
|   |   |   |-- faq/page.tsx
|   |   |   |-- how-carbon-credits-work/page.tsx
|   |   |   `-- sustainability-reports/page.tsx
|   |   `-- terms-of-service/page.tsx
|   |-- components
|   |   |-- auth
|   |   |   |-- forgot-password-form.tsx
|   |   |   |-- login-form.tsx
|   |   |   |-- logout-button.tsx
|   |   |   |-- register-form.tsx
|   |   |   `-- reset-password-form.tsx
|   |   `-- ui
|   |       |-- demo.tsx
|   |       |-- global-tiles-background.tsx
|   |       |-- tiles.tsx
|   |       |-- zerocarbon-footer.tsx
|   |       `-- zerocarbon-navbar.tsx
|   `-- lib
|       |-- supabase
|       |   |-- client.ts
|       |   |-- env.ts
|       |   |-- middleware.ts
|       |   `-- server.ts
|       `-- utils.ts
`-- supabase
    |-- profiles_setup.sql
    `-- seed_profiles.sql
```

Important file purposes and dependencies:

1. Root shell:
- `src/app/layout.tsx`
  - Declares metadata including favicon/manifest.
  - Composes `GlobalTilesBackground`, `ZeroCarbonNavbar`, page content, and `ZeroCarbonFooter`.

2. Routing:
- Every route is file-based under `src/app/**/page.tsx`.
- Protected pages (`dashboard`, `profile`) depend on `createServerSupabaseClient` and redirect logic.
- Auth pages (`login`, `register`, `forgot-password`) also use server-side user checks and redirect authenticated users away.

3. Auth components:
- `login-form.tsx`: sign-in + error mapping + cross-linking.
- `register-form.tsx`: sign-up + duplicate detection + verify-email/session branching.
- `forgot-password-form.tsx`: generic account-existence-safe reset request messaging.
- `reset-password-form.tsx`: recovery token/session handling + password update.
- `logout-button.tsx`: canonical client-side logout trigger.

4. Navbar:
- `zerocarbon-navbar.tsx` controls guest/auth rendering states and dropdown behavior.

5. Supabase wrappers:
- `env.ts` centralizes env retrieval and throws descriptive errors when missing.
- `client.ts` creates browser Supabase client (singleton in working tree baseline).
- `server.ts` creates SSR client with Next cookie adapter.
- `middleware.ts` handles session cookie synchronization.

6. SQL:
- `profiles_setup.sql`: schema + trigger + backfill.
- `seed_profiles.sql`: schema + backfill (without trigger function).

Inter-file dependency map (critical paths):

1. Route guard path:
- `src/app/dashboard/page.tsx` -> `src/lib/supabase/server.ts` -> `src/lib/supabase/env.ts`
- `src/app/profile/page.tsx` -> `src/lib/supabase/server.ts` -> `src/lib/supabase/env.ts`

2. Auth page gate path:
- `src/app/login/page.tsx`/`register/page.tsx`/`forgot-password/page.tsx` -> `createServerSupabaseClient` -> redirect logic.

3. Client auth action path:
- Auth form components -> `createBrowserSupabaseClient` -> Supabase auth methods.

4. Global session refresh path:
- `middleware.ts` -> `src/lib/supabase/middleware.ts` -> `supabase.auth.getUser()`.

5. Global layout composition:
- `src/app/layout.tsx` -> `src/components/ui/zerocarbon-navbar.tsx` + footer + background.

### Risks / Failure Modes

- Route-page coupling is implicit and not documented in code comments; accidental refactors may break guards.
- Lack of unit/integration tests means dependency changes are regression-prone.
- SQL scripts are external execution artifacts; app assumes they were run correctly.

### Safe Modification Approach

1. Preserve directory contracts for `src/app`, `src/components`, `src/lib/supabase`, `supabase`.
2. Keep auth wrapper imports centralized (`@/lib/supabase/...`) and avoid ad-hoc client construction in components.
3. If moving files, update all imports and route links atomically.
4. Maintain SQL script idempotency semantics when adding schema changes.

---

## 4) Authentication System Deep Dive

### Intent

Provide robust email/password auth with:

- SSR route protection
- Client-side form UX and error mapping
- Password recovery support
- Live navbar auth state switching
- Single canonical logout entry in navbar menu

### Implementation

#### 4.1 Login Flow (`src/components/auth/login-form.tsx`, `src/app/login/page.tsx`)

1. Server gate:
- `src/app/login/page.tsx` checks `supabase.auth.getUser()`.
- If user exists, `redirect("/dashboard")`.
- Otherwise renders login card with `LoginForm`.

2. Client form logic:
- Email initial value pulled from query param: `/login?email=...` via `useSearchParams`.
- Form state: `email`, `password`, `isLoading`, `error`.
- Working-tree hardening: `inFlightRef` prevents duplicate submission race.
- API call: `supabase.auth.signInWithPassword({ email: email.trim(), password })`.
- Success path: `router.replace("/dashboard")` and `router.refresh()`.
- Error mapping:
  - Invalid credentials -> "Invalid email or password."
  - Unconfirmed email
  - 429 throttling/rate-limit
  - API key/JWT config issues
  - Network errors
  - generic fallback

3. UX details:
- Input/button disabled while pending.
- Inline spinner + "Signing in..." label.
- Link to register carries email: `/register?email=...`.
- Link to forgot-password carries email: `/forgot-password?email=...`.

#### 4.2 Register Flow (`src/components/auth/register-form.tsx`, `src/app/register/page.tsx`)

1. Server gate:
- `src/app/register/page.tsx` redirects authenticated user to `/dashboard`.

2. Client validation:
- Email required.
- Password min length constant `MIN_PASSWORD_LENGTH = 8`.
- Confirm password must match.
- Working-tree hardening: `inFlightRef` prevents double submit.

3. API call:
- `supabase.auth.signUp({ email, password })`.

4. Duplicate detection:
- Helper: `isDuplicateRegistrationResponse(error, data, email)` in `register-form.tsx`.
- Detection rules:
  - Direct duplicate signals: status `422` or message patterns.
  - Obfuscated duplicate heuristic:
    - `error == null`
    - `data.user` exists
    - `data.session` is null
    - response email matches input
    - identities is null or empty array
- User-facing duplicate message: "User already exists. Please log in."

5. Success branching:
- If `data.session` exists: redirect to `/dashboard`.
- If no session: show verify-email message:
  - "Check your email to verify your account, then sign in."

6. Error mapping:
- Duplicate, weak password, signup disabled, 429, invalid config, network, generic.

7. Cross-link:
- Link back to login with carried email.

#### 4.3 Forgot Password Flow (`src/components/auth/forgot-password-form.tsx`, `src/app/forgot-password/page.tsx`)

1. Server gate:
- Authenticated users redirected to `/dashboard`.

2. Client behavior:
- Email prefill from `/forgot-password?email=...`.
- Working-tree hardening: `inFlightRef` to block repeat submissions.
- `redirectTo` computed from runtime origin:
  - ``${window.location.origin}/reset-password``
- API call:
  - `supabase.auth.resetPasswordForEmail(email, { redirectTo })`

3. Messaging policy:
- Success message is generic and account-enumeration-safe:
  - "If an account exists for this email, a reset link has been sent."
- Error messages for:
  - config failures
  - network
  - 429
  - redirect/allowlist misconfiguration
  - generic fallback

4. UX details:
- Clears stale error/success on input change.
- Pending spinner text "Sending reset link...".

#### 4.4 Reset Password Flow (`src/components/auth/reset-password-form.tsx`, `src/app/reset-password/page.tsx`)

1. Page shell:
- `/reset-password` route is rendered with `Suspense` around `ResetPasswordForm`.
- No server redirect gate here; recovery links must be accessible.

2. Recovery state machine:
- `RecoveryState = "checking" | "ready" | "invalid"`.
- Initial state `checking`.

3. Token/session resolution strategy:
- Subscribe to `supabase.auth.onAuthStateChange`.
  - If event is `"PASSWORD_RECOVERY"`, mark recovery ready.
- Parse URL hash for:
  - `access_token`, `refresh_token`, `type`, `error_description`.
- If hash tokens exist and `type === "recovery"`:
  - call `supabase.auth.setSession`.
- Else if query has `token_hash` and `type=recovery`:
  - call `supabase.auth.verifyOtp`.
- Fallback check:
  - if active session exists (`supabase.auth.getSession()`), allow ready state.
- If invalid/expired signals, set invalid state and display invalid-link message.

4. URL hygiene:
- `clearRecoveryUrlState()` removes recovery tokens from URL hash/query after recovery initialization.

5. Password update:
- Client validation min length and confirm match.
- Must be in `recoveryState === "ready"` before submit.
- API call: `supabase.auth.updateUser({ password })`.
- Success:
  - show success message
  - clear form
  - `supabase.auth.signOut()`
  - delayed redirect to `/login` + refresh.

6. Working-tree hardening:
- `inFlightRef` for submit deduplication.
- `redirectTimeoutRef` cleanup to avoid stale timeout on unmount.
- 429-specific reset error mapping.

#### 4.5 Session Persistence Model (`src/lib/supabase/*`, `middleware.ts`)

1. Server-side:
- `createServerSupabaseClient()` uses Next cookies.
- `setAll` writes are wrapped in try/catch for read-only server component contexts.

2. Middleware:
- `updateSession()` creates Supabase server client with request/response cookie bridges.
- Calls `supabase.auth.getUser()` every applicable request to refresh auth.
- Returns synchronized response cookies.

3. Client-side:
- Browser client wrapper now singleton in working tree (`src/lib/supabase/client.ts`).
- Navbar fetches initial session with `getSession()` and subscribes to `onAuthStateChange`.

#### 4.6 Logout Flow (`src/components/auth/logout-button.tsx`, `src/components/ui/zerocarbon-navbar.tsx`)

1. Canonical logout entry:
- Navbar profile dropdown (desktop and mobile).
- No page-level logout buttons on dashboard/profile.

2. Behavior:
- `LogoutButton` calls `supabase.auth.signOut()`.
- On success:
  - optional callback closes menus
  - redirects to `/login`
  - refreshes router.

3. Failure handling:
- If signOut fails or throws, button exits loading state with no explicit error UI.

#### 4.7 SSR Route Protection and Auth-Page Redirects

Protected pages:

- `/dashboard` and `/profile`:
  - server `getUser()`
  - unauthenticated -> `redirect("/login")`.

Auth pages:

- `/login`, `/register`, `/forgot-password`:
  - server `getUser()`
  - authenticated -> `redirect("/dashboard")`.

#### 4.8 Known Failure Modes and Rate-Limit Triggers

1. Supabase redirect allowlist mismatch:
- Forgot-password call can fail with redirect-related errors.

2. Site URL misconfiguration:
- Signup confirmation links can target wrong domain when `emailRedirectTo` is omitted (current behavior).

3. Missing env vars:
- `src/lib/supabase/env.ts` throws on missing required env names.

4. Rate limiting:
- Repeated login/signup/reset requests can trigger 429.
- Forms now include 429-specific messaging and in-flight guards.

5. UI stale state:
- Mitigated by navbar listener + working-tree switch to session-based sync and client singleton.

### Risks / Failure Modes

- Duplicate-registration detection remains best-effort; Supabase obfuscation can still produce ambiguous cases.
- Logout failure path has no user-visible error.
- Reset recovery logic depends on provider behavior (hash vs token_hash forms); future upstream changes may require updates.
- No MFA, CAPTCHA, or additional anti-abuse controls.

### Safe Modification Approach

1. Keep auth method ownership in auth components; avoid scattering auth calls across unrelated UI.
2. Preserve route guard behavior in server pages.
3. Preserve middleware session refresh unless replaced with equivalent mechanism.
4. If adding auth features (MFA/social login), add behind isolated components and keep existing route contracts stable.
5. Add explicit telemetry around signOut and reset failures before deep refactors.

---

## 5) Database Architecture

### Intent

Attach application-level profile metadata to auth users through a `public.profiles` table keyed to `auth.users.id`, and guarantee profile row availability for new and existing users.

### Implementation

Primary schema scripts:

- `supabase/profiles_setup.sql`
- `supabase/seed_profiles.sql`

`public.profiles` contract (from both SQL scripts):

1. Table:
- `id uuid primary key references auth.users(id) on delete cascade`
- `role text`
- `created_at timestamptz not null default now()`

2. Row Level Security:
- `alter table public.profiles enable row level security;`
- No explicit policies are defined in repository SQL.

3. Automatic provisioning (in `profiles_setup.sql`):
- Trigger function:
  - `public.handle_new_auth_user_profile()`
  - `security definer`
  - `set search_path = public`
  - Inserts `(new.id, 'user')` with conflict do nothing.
- Trigger:
  - `on_auth_user_created_profile`
  - `after insert on auth.users`
  - executes function above.

4. Backfill:
- Both scripts include insert-select from `auth.users` left-joined on `public.profiles` where missing.

Runtime usage:

- `src/app/dashboard/page.tsx` and `src/app/profile/page.tsx` query:
  - `.from("profiles").select("role, created_at").eq("id", user.id).maybeSingle()`
- UI fallback if query error/missing row:
  - role -> `"Not set"`
  - created_at -> `"Unavailable"`

### Risks / Failure Modes

- RLS enabled without explicit policies may deny reads depending on project policy state, causing frequent fallback rendering.
- Scripts must be executed manually in Supabase SQL Editor; app does not auto-migrate.
- `role` is unconstrained text; invalid role values can be written outside app controls.

### Safe Modification Approach

1. Preserve `id` foreign key and cascade behavior.
2. Add explicit RLS policies before relying on broader profile reads/writes.
3. If expanding profile schema, make migrations idempotent and preserve existing column names used by dashboard/profile.
4. If role system grows, add enum/check constraints incrementally with safe migration path.

---

## 6) Role-Based Behavior

### Intent

Expose a simple account role indicator (`profiles.role`) without enforcing route-level role authorization yet.

### Implementation

Current role behavior:

1. Source of truth:
- `public.profiles.role` (SQL scripts in `supabase/*.sql`).

2. Default role assignment:
- Trigger/backfill writes `'user'` (in `supabase/profiles_setup.sql` and backfill queries).

3. UI usage:
- Dashboard and profile display role value (`src/app/dashboard/page.tsx`, `src/app/profile/page.tsx`).

4. Route authorization:
- No role checks in routes; only authentication checks are present.

5. Navbar behavior:
- Authenticated/guest switching is based on session presence, not role value.

### Risks / Failure Modes

- Any future admin-only features are currently unenforced.
- Role typos in DB will display as-is; no normalization in UI.
- Role-based UI branching can become inconsistent if introduced ad hoc.

### Safe Modification Approach

1. Introduce centralized role guard utilities before adding role-gated routes/components.
2. Add DB-level role constraints if role list becomes explicit.
3. Keep auth check and role check separate concerns to avoid accidental lockouts.

---

## 7) Navbar Architecture

### Intent

Navbar is the global auth affordance and account control surface. It handles:

- guest vs authenticated action rendering
- account identity visualization (avatar/initials)
- profile navigation
- canonical logout access (desktop and mobile)

### Implementation

Source file: `src/components/ui/zerocarbon-navbar.tsx`.

1. Component type:
- Client component (`"use client"`).

2. State model:
- `isMenuOpen` (mobile drawer)
- `isProfileMenuOpen` (desktop profile dropdown)
- `authStatus`: `"loading" | "authenticated" | "unauthenticated"`
- `userEmail`, `avatarUrl`

3. Auth synchronization:
- Initial load:
  - working-tree version calls `supabase.auth.getSession()`.
- Live updates:
  - `supabase.auth.onAuthStateChange(...)`.
- On unauth state:
  - clears user data, closes profile menu.

4. Avatar logic:
- `getAvatarUrl` reads `user.user_metadata.avatar_url`.
- fallback to initials derived from email local part.
- fallback initial `'U'` if no email data.

5. Desktop rendering logic:
- `authStatus === loading`:
  - pulse circle placeholder.
- unauthenticated:
  - guest CTAs from `actionLinks`:
    - `Register Company` -> `/register-company`
    - `Register / Login` -> `/login`
- authenticated:
  - avatar trigger + dropdown items:
    - `Profile` -> `/profile`
    - `Dashboard` -> `/dashboard`
    - `Logout` via `LogoutButton`

6. Dropdown behavior:
- Closes on outside pointer down.
- Closes on Escape.
- Closes on menu item navigation.
- ARIA attributes:
  - `aria-haspopup="menu"`
  - `aria-expanded`
  - `aria-controls`.

7. Mobile rendering logic:
- Top hamburger toggles drawer.
- Drawer always includes nav links.
- If authenticated:
  - Profile, Dashboard, Logout.
- If unauthenticated:
  - guest CTAs.
- Logout callback closes menu state.

8. Historical bug-pattern evidence and mitigations (inferred from code history):
- Commit `53959a1` removed dashboard server-action logout entry and moved toward navbar-only logout path.
- Working-tree changes switched navbar auth bootstrap from `getUser()` to `getSession()` and use singleton browser client; inference: reduce stale auth UI transitions and client sync inconsistencies.

### Risks / Failure Modes

- `LogoutButton` failure does not show error UI.
- `actionClass` includes `primary` variant not currently used, creating dead-path styling complexity.
- Avatar URL is rendered as background image style; if metadata contains invalid URL, fallback path may not trigger unless null/empty.

### Safe Modification Approach

1. Keep navbar as single logout entry unless intentionally redesigning global auth UX.
2. Preserve `authStatus` tri-state to avoid guest/action flicker.
3. Preserve menu close logic on escape/outside click to avoid stuck overlays.
4. If adding more dropdown actions, maintain keyboard and ARIA semantics.

---

## 8) Email System

### Intent

Leverage Supabase Auth email workflows for:

- signup confirmation
- password recovery

while keeping UI-side account existence leakage minimized.

### Implementation

1. Signup confirmation path:
- `src/components/auth/register-form.tsx` uses `supabase.auth.signUp({ email, password })` with no `emailRedirectTo`.
- Redirect destination for confirmation is therefore Supabase dashboard Site URL behavior.

2. Forgot-password email path:
- `src/components/auth/forgot-password-form.tsx` uses:
  - `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/reset-password })`.

3. Reset consumption:
- `src/components/auth/reset-password-form.tsx` handles both hash-token and token_hash flows.

4. Manifested UI handling for email/config issues:
- Forgot-password form has explicit error messaging for redirect allowlist issues.
- Register/login/reset forms map config/network/rate-limit errors.

External configuration dependencies (not in repo):

- Supabase Auth URL Configuration:
  - Site URL must reflect intended domain.
  - Redirect URL allowlist must include environment reset/login targets.
- Supabase email provider/template setup must be enabled externally.

### Risks / Failure Modes

- Signup links can point to wrong domain if Site URL is misconfigured.
- Forgot-password redirect can fail if origin URL not allowlisted.
- Environment/preview domains require explicit redirect allowlist entries.

### Safe Modification Approach

1. For deterministic domain behavior, add explicit environment-based redirect URLs in code for signup and reset requests.
2. Keep forgot-password success messaging generic for enumeration safety.
3. Validate dashboard auth URL settings whenever deployment domain changes.

---

## 9) Rate Limiting & Hardening Strategy

### Intent

Reduce accidental abuse and UX instability during auth operations with lightweight client-side controls and user-friendly failure messaging.

### Implementation

Working-tree hardening currently present:

1. Anti-double-submit (`useRef` guards):
- `login-form.tsx`
- `register-form.tsx`
- `forgot-password-form.tsx`
- `reset-password-form.tsx`

2. Pending-state control:
- Inputs and submit buttons disabled while loading across all auth forms.
- Inline spinner labels for all pending submit actions.

3. Rate-limit message mapping:
- 429/throttling handling in:
  - `login-form.tsx`
  - `register-form.tsx`
  - `forgot-password-form.tsx`
  - `reset-password-form.tsx`

4. Security-sensitive messaging posture:
- Forgot-password success remains account-existence-generic on successful request.
- Duplicate detection in register is best-effort and may be intentionally ambiguous under provider security settings.

### Risks / Failure Modes

- No server-side abuse defenses in app code (CAPTCHA/challenge/risk scoring absent).
- Client-side guards can be bypassed by direct API misuse outside UI.
- No exponential backoff/retry guidance in UI.

### Safe Modification Approach

1. Keep current client-side guards as baseline.
2. Add server-side anti-abuse controls in Supabase/project edge layer if abuse risk rises.
3. Introduce observability counters for auth failures and 429 rates before changing UX significantly.

---

## 10) Environment Variables

### Intent

Use minimal environment contract for Supabase anonymous auth access usable in both server and client wrappers.

### Implementation

Required env names (`.env.example`, `src/lib/supabase/env.ts`):

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Consumption locations:

- `src/lib/supabase/env.ts`:
  - `getSupabaseUrl()`
  - `getSupabaseAnonKey()`
- `src/lib/supabase/client.ts` uses both.
- `src/lib/supabase/server.ts` uses both.
- `src/lib/supabase/middleware.ts` uses both.

Exposure model:

- Both variables are `NEXT_PUBLIC_*` and therefore client-exposed by design.
- No server-only Supabase service role variable exists in this repository.

Failure behavior:

- Missing vars throw runtime errors with explicit message:
  - "Missing required environment variable: ...".
- Auth forms catch these errors and map to configuration-error UX messages.

Build evidence:

- `npm run build` output indicates environment loading from `.env.local`.

### Risks / Failure Modes

- If `.env.local` missing/misconfigured, auth flows fail at runtime.
- Public anon key is expected to be non-secret; misuse of this assumption elsewhere can create security misunderstandings.

### Safe Modification Approach

1. Keep env access centralized in `src/lib/supabase/env.ts`.
2. Do not hardcode URLs/keys in components.
3. If adding server-only behavior, introduce new non-public env names and isolate to server contexts.

---

## 11) Routing Contracts

### Intent

Provide deterministic routing behavior with clear auth gating and post-auth redirects.

### Implementation

Route matrix (based on route files and successful build output):

1. Public static routes:
- `/`
- `/cookie-policy`
- `/how-it-works`
- `/how-to-offset-emissions`
- `/privacy-policy`
- `/projects`
- `/register-company`
- `/reset-password` (page shell itself is static; recovery handling is client-side)
- `/resources/carbon-market-integrity`
- `/resources/faq`
- `/resources/how-carbon-credits-work`
- `/resources/sustainability-reports`
- `/terms-of-service`

2. Dynamic server-rendered routes:
- `/dashboard`
- `/forgot-password`
- `/login`
- `/profile`
- `/register`

3. Protected route rules:
- `/dashboard`, `/profile`:
  - no session -> redirect to `/login`.

4. Auth-entry route rules:
- `/login`, `/register`, `/forgot-password`:
  - if already authenticated -> redirect to `/dashboard`.

5. Logout redirect:
- Canonical logout sends user to `/login` (`src/components/auth/logout-button.tsx`).

6. Query-param contracts:
- `/login?email=<value>`
- `/register?email=<value>`
- `/forgot-password?email=<value>`
- These are read by corresponding form components to prefill email fields.

7. Middleware coverage:
- `middleware.ts` applies session updates to all non-static-asset requests.

Expired session behavior:

- Navbar listener should detect auth state changes client-side.
- Protected server pages deny access and redirect to `/login`.
- Middleware refresh step helps keep server cookie state synchronized.

### Risks / Failure Modes

- If middleware is disabled/misconfigured, cookie refresh consistency can degrade.
- If redirect contracts are changed without updating cross-links, auth flow UX fragments.
- `/reset-password` route accessibility depends on correct external auth redirect configuration.

### Safe Modification Approach

1. Keep existing public route paths stable unless a redirect migration plan is implemented.
2. Update cross-links atomically if changing auth route names.
3. Preserve server-side protection for `/dashboard` and `/profile` even if client guard is added.

---

## 12) Known Constraints (Architectural and Contractual Invariants)

### Intent

Codify constraints that should remain stable to avoid regressions in auth, profile data access, and UI consistency.

### Implementation

Must-not-break invariants:

1. Supabase wrapper usage:
- Use `createBrowserSupabaseClient` for client code.
- Use `createServerSupabaseClient` for server components.
- Use `updateSession` middleware for cookie sync.

2. Protected-route model:
- `/dashboard` and `/profile` server-side checks must remain.

3. Auth-entry redirect model:
- Authenticated users should not remain on login/register/forgot pages.

4. Profiles schema contract:
- `profiles.id` maps to `auth.users.id`.
- `role` and `created_at` fields are expected by dashboard/profile pages.

5. Default role contract:
- New users should resolve to role `'user'` via DB trigger/backfill.

6. Navbar logout ownership:
- Current product decision is navbar-only logout entry (desktop/mobile).

7. Asset layout contract:
- Favicon assets and manifest are served from `public/favicon/*`.
- Layout metadata references `/favicon/...` paths.

Naming/convention constraints:

- Path alias `@/*` from `tsconfig.json`.
- Route names are kebab-case directories under `src/app`.
- Component files are mostly kebab-case.
- CSS utility-first via Tailwind classes; no CSS modules present.

### Risks / Failure Modes

- Changing any invariant without coordinated updates can break auth UX or protected access behavior.
- Removing profile fallbacks can hard-fail pages under RLS/policy gaps.
- Altering favicon pathing without metadata updates can break browser icon resolution.

### Safe Modification Approach

1. Change one invariant at a time with explicit migration and regression tests.
2. Keep compatibility shims/redirects when renaming routes.
3. Document contract changes in a migration note before implementation.

---

## 13) Known Bugs Fixed Historically (Evidence-Backed)

### Intent

Capture historically fixed issues and hardening changes so future work does not reintroduce them.

### Implementation

Commit chronology with auth/nav relevance:

1. `c47e00f` - "Implement Supabase auth rebuild and new project seeding flow"
- Introduced Supabase wrappers/middleware and initial auth + dashboard foundation.
- Added `supabase/seed_profiles.sql`.

2. `2f43709` - "Harden auth UX with seamless login/register flow"
- Added register route/form.
- Updated login flow and navbar auth CTA text.
- Added `supabase/profiles_setup.sql` for trigger-driven profile creation.

3. `aea56e4` - "Add forgot-password and reset-password auth flow"
- Added forgot and reset pages/components.
- Added login-to-forgot linkage.

4. `53959a1` - "Finalize navbar-only logout and favicon pack integration"
- Added `src/components/auth/logout-button.tsx`.
- Removed `src/app/dashboard/actions.ts`.
- Removed dashboard page-level logout.
- Added `/profile` route.
- Added full favicon pack + layout metadata wiring.

Working-tree (uncommitted) hardening inferred from diffs:

1. `src/lib/supabase/client.ts`:
- Browser client switched to singleton model.

2. `src/components/ui/zerocarbon-navbar.tsx`:
- Auth bootstrap switched from `getUser()` to `getSession()`.

3. Auth forms:
- Added `inFlightRef` anti-double-submit guards.
- Added 429-specific mappings in all auth flows.
- Reset flow token/session robustness increased.

Historical bug-pattern mapping (inference from code evolution, not explicit bug tickets):

1. Duplicate logout entry conflict:
- Evidence: dashboard-level logout removed and navbar canonicalized (`53959a1`).
2. Auth state sync inconsistencies:
- Evidence: working-tree session/bootstrap changes in navbar + singleton client.
3. Double-submit/race conditions:
- Evidence: working-tree `inFlightRef` additions across auth forms.
4. Recovery token handling fragility:
- Evidence: working-tree reset-flow URL cleanup and session fallback logic.

### Risks / Failure Modes

- Historical behavior intent is inferred from code changes and commit messages, not issue tracker artifacts.
- Uncommitted hardening can be lost if not committed.

### Safe Modification Approach

1. Preserve these hardening behaviors when refactoring forms/nav.
2. If replacing auth flows, replicate safeguards first, then improve.
3. Commit current working-tree hardening as coherent units to preserve audit trail.

---

## 14) Testing Assumptions

### Intent

Define expected verification strategy for this codebase, emphasizing auth regressions and route-protection guarantees.

### Implementation

Automated checks executed on current working tree:

1. `npm run lint` -> passed.
2. `npm run build` -> passed.

Build-time route output confirms:

- Dynamic routes: `/dashboard`, `/forgot-password`, `/login`, `/profile`, `/register`
- Static routes include `/reset-password` and marketing/resource/legal pages.

Manual regression matrix expected:

1. Login:
- valid credentials -> `/dashboard`
- invalid credentials -> inline error
- 429 simulation -> throttle message

2. Register:
- new email with session returned -> `/dashboard`
- new email with no session -> verify-email message
- duplicate email -> duplicate warning (best effort)
- password mismatch/min-length validation

3. Forgot/reset:
- forgot with valid email -> generic success
- forgot with unknown email -> same generic success path when request accepted
- invalid reset link -> invalid-link state + back-link to forgot
- valid reset link -> password update and redirect to `/login`

4. Protected routes:
- no session -> `/dashboard` and `/profile` redirect to `/login`.

5. Navbar auth rendering:
- guest sees guest CTAs
- logged-in sees avatar dropdown
- logout returns user to guest state and `/login`
- mobile menu parity with desktop auth state

6. Favicon/manifest:
- requests resolve for `/favicon/favicon.ico`, `/favicon/site.webmanifest`, `apple-touch-icon`.

High-risk test areas:

- Navbar auth status transitions after login/logout.
- Reset-password token/session parsing across provider formats.
- Duplicate registration edge cases under different Supabase project settings.
- RLS behavior for `profiles` reads.

### Risks / Failure Modes

- No formal test suite files in repository; verification is manual + lint/build only.
- No mocked integration tests for Supabase auth edge responses.

### Safe Modification Approach

1. Add automated integration tests around auth routes before broad refactors.
2. Preserve and expand manual checklist until automated coverage exists.
3. Validate against both local and production-like domains for email redirects.

---

## 15) Development Guardrails for Next Agent

### Intent

Prevent common auth/session/schema regressions by defining implementation guardrails.

### Implementation

Guardrails:

1. Do not duplicate auth clients ad hoc:
- Always use `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`.

2. Do not remove middleware session refresh without replacement:
- `middleware.ts` + `src/lib/supabase/middleware.ts` is central to cookie synchronization.

3. Do not mix SSR guards into client-only components:
- Keep protected route redirects in server page components.

4. Do not reintroduce multiple logout entrypoints without explicit product decision:
- Current contract is navbar-only logout control.

5. Do not break profile query contract in dashboard/profile:
- Both routes expect `role` and `created_at`.

6. Do not assume RLS policies are complete:
- SQL enables RLS but does not define policies in repo.

7. Do not leak auth tokens/passwords in logs or UI.

8. Do not hardcode environment values.

9. Do not move favicon assets without updating layout metadata and manifest paths.

### Risks / Failure Modes

- Blind refactors in these areas can break login/session/logout and protected routing behavior.
- Cross-environment email flows are fragile if redirect configuration coupling is ignored.

### Safe Modification Approach

1. For auth changes, update server guards, client listeners, and middleware assumptions together.
2. For DB changes, update SQL scripts and runtime fallbacks together.
3. For route changes, update all hardcoded links and query-param handoff logic in one change set.

---

## 16) Future Roadmap & Extension Points (Inferred from Current Skeleton)

### Intent

Capture realistic extension points implied by existing routes, copy, and data contracts.

### Implementation

Roadmap candidates directly implied by code:

1. Company onboarding completion:
- Expand `/register-company` into actual form + persistence workflow.

2. Project marketplace expansion:
- Replace placeholder `/projects` page with list/filter/detail, inventory and purchase flows.

3. Credit purchase and retirement flow:
- Add transaction domain model and retirement certificate references.

4. Emissions and reporting expansion:
- Convert resource/report placeholders into generated account-scoped reporting.

5. Role-based authorization:
- Extend role from display-only to route/action policy.

6. Admin/ops layer:
- No admin route currently exists; would require role gates + operational data models.

7. Payment integration:
- No payment provider code exists; integration point expected around project purchase flow.

8. Auth enhancements:
- Explicit environment-driven redirect URLs for signup and reset mail.
- Account settings page for profile and avatar metadata editing.
- Optional stronger hardening (MFA, CAPTCHA, abuse controls).

### Risks / Failure Modes

- Building these features without preserving current auth and schema contracts can destabilize existing flows.
- Role-based expansion without policy-backed RLS can produce insecure access patterns.

### Safe Modification Approach

1. Prioritize domain model design and migration scripts before UI-heavy feature growth.
2. Add policy and role enforcement before exposing admin/payment controls.
3. Keep backward compatibility for existing routes and profile fields.

---

## Working Tree Delta vs HEAD (Required)

Baseline commit: `53959a1`  
Current delta: 6 modified files.

1. `src/components/auth/login-form.tsx`
- Added `inFlightRef` guard.
- Added 429/throttle error mapping.
- Spinner class indentation-only formatting change.
- Behavior impact: reduced duplicate request submission; clearer rate-limit message.

2. `src/components/auth/register-form.tsx`
- Added `inFlightRef` guard.
- Added 429/throttle error mapping.
- Spinner class indentation-only formatting change.
- Behavior impact: reduced duplicate signup submissions; clearer throttle messaging.

3. `src/components/auth/forgot-password-form.tsx`
- Added `inFlightRef` guard.
- Replaced coarse `isServiceIssue` logic with granular `getForgotPasswordErrorMessage`.
- Added explicit handling for redirect allowlist/config errors and 429.
- Clears stale message state on input change.
- Behavior impact: improved actionable errors and duplicate-submit prevention.

4. `src/components/auth/reset-password-form.tsx`
- Added `inFlightRef` and `redirectTimeoutRef`.
- Added 429/throttle reset error mapping.
- Added `clearRecoveryUrlState` utility and broader URL token cleanup.
- Added `hasActiveRecoverySession` fallback.
- Added timeout cleanup on unmount.
- Behavior impact: more robust recovery handling and fewer race conditions.

5. `src/components/ui/zerocarbon-navbar.tsx`
- Auth bootstrap changed from `getUser()` to `getSession()`.
- `updateAuthState` now session-centric.
- Behavior impact: tighter alignment with client auth event model.

6. `src/lib/supabase/client.ts`
- Added browser singleton Supabase client.
- Added guard for server execution context.
- Behavior impact: shared client state across components; fewer duplicate client instances.

Inference:

- This delta is consistent with active auth UX hardening and race-condition mitigation.

---

## Commit Timeline Snapshot (Required)

1. `8a2d04e` - Initial Next.js scaffold.
2. `5cff830` - Initial commit from Create Next App.
3. `a213d31` - Responsive ZeroCarbon UI and global glass navbar direction.
4. `d1e08bf` - Merge from `origin/main` history.
5. `c47e00f` - Supabase auth rebuild + project seeding flow foundation.
6. `e3b6310` - Remove list-project CTA/route.
7. `2f43709` - Login/register hardening + register route + profiles setup SQL.
8. `6954a53` - Navbar update sync.
9. `aea56e4` - Forgot/reset password flow introduction.
10. `53959a1` - Navbar-only logout finalization + profile page + favicon pack.

Branch context:

- Active local branch: `master`.
- Remote heads observed: `origin/master` at `53959a1`, `origin/main` at older `c47e00f`.

Risk note:

- Multi-branch history can cause accidental integration against stale `origin/main` if branch targeting is not explicit.

---

## Risk Register (Required)

| ID | Risk | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| R-001 | `profiles` RLS enabled without explicit policies in repo SQL | High | `supabase/profiles_setup.sql`, `supabase/seed_profiles.sql` | Add explicit read/write policies before expanding profile features |
| R-002 | Signup confirmation URL domain depends on external Site URL | High | `src/components/auth/register-form.tsx` (no `emailRedirectTo`) | Add env-based explicit redirect URL and verify dashboard config |
| R-003 | Forgot-password redirect can fail if allowlist missing | High | `src/components/auth/forgot-password-form.tsx` | Ensure Supabase redirect URLs include all environments |
| R-004 | Logout failure has no user-visible error | Medium | `src/components/auth/logout-button.tsx` | Add error state/toast on signOut failure |
| R-005 | No automated tests for auth edge cases | High | no test files; manual-only workflow | Add integration tests for login/register/reset/logout and route guards |
| R-006 | Working-tree hardening uncommitted | Medium | git status shows 6 modified files | Commit as cohesive auth hardening change set |
| R-007 | Role system is display-only, no authorization | Medium | `src/app/dashboard/page.tsx`, `src/app/profile/page.tsx` | Introduce role policy layer before admin features |
| R-008 | Placeholder legal and policy copy in production UI | Medium | legal page files under `src/app/*policy*` | Replace placeholder legal content before compliance-sensitive launch |
| R-009 | Domain workflows are placeholder while marketed as marketplace | Medium | `src/app/projects/page.tsx`, home/footer messaging | Add explicit roadmap/coming-soon indicators or implement core workflows |
| R-010 | Potential branch confusion (`origin/main` vs `origin/master`) | Low | git branch/remotes state | Standardize primary branch strategy and CI target |

---

## Implicit Contracts Index (Required)

| Contract ID | Producer | Consumer | Contract | Breakage Effect |
|---|---|---|---|---|
| IC-001 | `src/lib/supabase/env.ts` | all Supabase wrappers | Env names must exist and be readable | Auth runtime failures |
| IC-002 | `src/lib/supabase/client.ts` | auth forms/navbar/logout | Browser client creation strategy (singleton in working tree) | Inconsistent auth state and duplicate clients |
| IC-003 | `src/lib/supabase/server.ts` | server route pages | Cookie bridge for SSR auth checks | Broken server redirects/protection |
| IC-004 | `src/lib/supabase/middleware.ts` | global middleware | `auth.getUser()` refresh syncs cookies | Stale/expired session behavior inconsistencies |
| IC-005 | `src/app/dashboard/page.tsx` | authenticated users | Requires `profiles.role`, `profiles.created_at` | Missing data or fallback-only rendering |
| IC-006 | `supabase/profiles_setup.sql` | runtime profile pages | New auth users should get profile row with role `user` | New users may show missing profile info |
| IC-007 | `src/components/auth/register-form.tsx` | user signup UX | Duplicate detection is best-effort and security-sensitive | Wrong user messaging under obfuscation |
| IC-008 | `src/components/auth/forgot-password-form.tsx` | reset email flow | `redirectTo` must be allowlisted | Reset email request failure |
| IC-009 | `src/components/auth/reset-password-form.tsx` | reset-password route | Recovery session can come from hash, token_hash, or existing session | Invalid-link false negatives/positives |
| IC-010 | `src/components/ui/zerocarbon-navbar.tsx` | all pages via layout | Authenticated user sees profile menu, guest sees guest CTAs | Misleading navigation/auth affordance |
| IC-011 | `src/components/auth/logout-button.tsx` | navbar menus | Logout redirects to `/login` and refreshes UI | Stale authenticated UI after logout |
| IC-012 | `src/app/login/page.tsx` | auth system | Authenticated users redirected to `/dashboard` | Logged-in users can access login page unnecessarily |
| IC-013 | `src/app/register/page.tsx` | auth system | Authenticated users redirected to `/dashboard` | Duplicate account creation attempts by active users |
| IC-014 | `src/app/forgot-password/page.tsx` | auth system | Authenticated users redirected to `/dashboard` | Redundant reset requests while already logged in |
| IC-015 | `src/app/layout.tsx` + `public/favicon/site.webmanifest` | browsers/PWA | Favicon and manifest paths use `/favicon/*` | Missing tab/app icons |
| IC-016 | Query parameter conventions in form components | cross-page auth links | `email` query should prefill destination form | Reduced UX continuity |

---

## Glossary (Required)

- **Anon key**: Supabase public key intended for client-visible usage with RLS controls.
- **SSR guard**: Server-side route check (`supabase.auth.getUser()`) followed by redirect.
- **Recovery session**: Temporary auth session established from password reset link tokens for `updateUser({ password })`.
- **Token hash flow**: Reset flow variant using `token_hash` + `verifyOtp`.
- **Hash token flow**: Reset flow variant using URL hash `access_token` + `refresh_token`.
- **Profiles backfill**: SQL insert-select operation creating missing `public.profiles` rows for existing `auth.users`.
- **Best-effort duplicate detection**: UI logic that attempts to detect existing-user signup while respecting backend obfuscation behavior.
- **Navbar-only logout**: Product/UI decision where logout control exists only in navbar profile menus (desktop/mobile), not on dashboard/profile body.
- **Working tree baseline**: Documentation includes uncommitted local modifications in addition to committed code.
- **RLS**: Row Level Security in PostgreSQL/Supabase controlling row-level access.

---

## Technical Debt Ledger

1. No automated test suite for auth/session-critical flows.
2. RLS enabled without explicit policy definitions in repository SQL.
3. No typed/generated Supabase DB schema in TypeScript layer.
4. Placeholder domain pages without operational backend workflows.
5. No explicit telemetry for auth errors or logout failures.
6. No structured error boundary strategy around auth routes/components.
7. Signup confirmation redirect remains implicit (Site URL dependent) rather than explicit env-driven.
8. Active hardening exists only in working tree; not yet committed (at time of this memory generation).

---

## Conventions and Style Contracts

1. App Router pages live under `src/app/**/page.tsx`.
2. Shared UI is in `src/components/ui`.
3. Auth UI is in `src/components/auth`.
4. Infra helpers are in `src/lib/**`.
5. Imports generally use path alias `@/*`.
6. Styling is Tailwind utility-first with glassmorphism visual direction in cards/nav.
7. Minimal global CSS in `src/app/globals.css`, mostly reset/behavioral.
8. Favicon assets under `public/favicon` with metadata wiring from `src/app/layout.tsx`.

---

## Security Considerations Summary

1. No service-role key usage in codebase.
2. Auth/route protection is server-verified for protected pages.
3. Middleware performs session refresh on non-static routes.
4. Forgot-password success message avoids account existence leak when request succeeds.
5. Duplicate detection in signup is best-effort and may be intentionally ambiguous under provider security settings.
6. Recovery URL token cleanup is implemented to reduce token persistence in browser URL.
7. Remaining security gap:
- RLS policy definitions are not included in repository.

---

## Validation Checklist Outcome

1. Required sections 1-16 included with intent/implementation/risks/safe modification.
2. Additional required sections included:
- Working Tree Delta vs HEAD
- Commit Timeline Snapshot
- Risk Register
- Implicit Contracts Index
- Glossary
3. No secret values are documented.
4. Claims are anchored to repository files and local git history.
5. Working-tree changes are explicitly separated from committed baseline.
6. Runtime file modifications were not performed for app code; this documentation file is the only new file.

