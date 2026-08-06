# Deployment

ZeroCarbon is designed for Vercel, but any Node.js platform capable of running Next.js 16 can host it.

## Release checklist

1. Confirm the target commit passes lint, unit tests, and a production build.
2. Review `npm audit --omit=dev` and the documented accepted findings.
3. Apply required Supabase scripts in the order documented in `database.md`.
4. Configure production environment variables from `.env.example` in encrypted hosting settings.
5. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin.
6. Restrict public Google Maps credentials to production domains.
7. Deploy and verify authentication, dashboards, maps, signed evidence, and provider health.
8. Register or verify the Razorpay webhook URL and test signature handling.
9. Exercise a test-mode purchase and confirm reservation, capture, and order history.

## Rollback

Use the hosting provider's previous known-good deployment for application rollback. Database scripts are additive and are not automatically reversed; prepare and review a separate corrective migration rather than deleting columns or data during an incident.

## Observability

Runtime handlers use structured console events for provider and persistence failures. Monitor Vercel runtime logs, Razorpay webhook delivery, Supabase database health, and external-provider quotas after each release.
