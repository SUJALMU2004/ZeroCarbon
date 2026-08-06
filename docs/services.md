# External services

## Supabase

Provides authentication, Postgres, Row Level Security, and private evidence storage. Browser and user-scoped server clients use the anon key; administrative operations use the service-role key only after authorization.

## Google Maps and Earth Engine

Google Maps renders project locations, drawing tools, and marketplace maps. Restrict the public Maps key by domain and API. Earth Engine uses a server-side service account for NDVI, location, solar, and methane analysis; store the private key with escaped newlines supported by the hosting platform.

## Twilio Verify

Sends and validates phone OTP challenges. Configure the account SID, auth token, and Verify service SID. Keep all three server-only.

## Resend

Sends verification, review, and edit-permission emails. Configure a verified sending domain, `RESEND_API_KEY`, `ADMIN_EMAIL`, and the canonical application URL.

## Razorpay

Creates payment orders and validates checkout and webhook signatures. Configure test credentials locally, register `/api/payments/webhooks/razorpay` as the webhook endpoint, and use a distinct webhook secret. Never reuse live credentials in development or CI.

## Emissions and valuation providers

Climatiq and Electricity Maps supply emissions factors. Gemini may assist emissions and carbon valuation flows. Renewables.ninja and Open-Meteo support wind resource estimation. Provider failures should remain visible in diagnostics while deterministic validation and authorization continue locally.
