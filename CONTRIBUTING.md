# Contributing to ZeroCarbon

Thank you for helping improve ZeroCarbon. Changes should be focused, reviewable, and safe for verification and payment workflows.

## Development workflow

1. Create a branch from the latest `main`.
2. Install the locked dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and add only local credentials.
4. Make a focused change without committing generated output or secrets.
5. Add or update tests for changed domain behavior.
6. Run the required checks before opening a pull request:

```bash
npm run lint
npm run test:unit
npm run build
```

## Engineering expectations

- Keep TypeScript strict and avoid untyped escape hatches.
- Preserve existing URLs and API response contracts unless the change explicitly documents a migration.
- Perform authorization on the server; never trust client-supplied identity or pricing values.
- Use the user-scoped Supabase client for ordinary access and the service-role client only after explicit authorization.
- Treat verification, inventory reservation, webhooks, valuation, and satellite processing as high-risk areas.
- Add database changes as additive, documented SQL and state their required execution order.
- Do not include `.env.local`, tokens, customer data, production payloads, or private evidence files.

## Pull requests

Use a clear title and describe the problem, approach, user impact, database or environment changes, and validation performed. Keep unrelated formatting or refactors out of the same pull request.

Security vulnerabilities must not be filed as public issues. Follow [SECURITY.md](SECURITY.md) instead.
