# Known issues

## Dependency audit baseline

As of 2026-08-07, `npm audit --omit=dev` reports five high-severity vulnerable dependency groups:

- `next` 16.1.6 and transitive framework advisories.
- `postcss` through the current Next.js dependency tree.
- `sharp` through the current Next.js dependency tree.
- `ws` through an installed runtime dependency.
- `brace-expansion` through an installed runtime dependency.

The audit recommends a combination of `npm audit fix` and upgrading Next.js beyond the current exact pin. Dependency versions are intentionally unchanged in the repository-professionalization release so security upgrades can be isolated, tested, and reviewed as a dedicated change.

Recommended follow-up:

1. Create a dedicated dependency-upgrade branch.
2. Upgrade Next.js, React, Supabase, and affected transitive packages using their official migration guidance.
3. Re-run the complete unit, lint, build, authentication, payment, and project-verification checks.
4. Confirm `npm audit --omit=dev` is clear or document any remaining accepted risk with package and advisory identifiers.

## Testing coverage

The repository has unit coverage for deterministic domain helpers but no automated browser or provider-integration suite. Authentication, verification emails, Twilio OTP, Google APIs, Supabase policies, and Razorpay lifecycle behavior still require environment-backed end-to-end validation.

## Database migrations

Supabase scripts are feature-named and manually applied rather than managed by a timestamped migration tool. `docs/database.md` is the canonical order until migration automation is introduced.
