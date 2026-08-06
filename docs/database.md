# Database setup

ZeroCarbon currently uses manually applied Supabase SQL scripts. Apply them to a development project first and record production execution separately.

## New project order

1. `profiles_setup.sql` — profiles, verification state, policies, and auth linkage.
2. `add_companies_and_projects.sql` — company and project entities.
3. `add_company_registration_fields.sql` — expanded company registration fields.
4. `add_project_types_agricultural_windmill.sql` — additional project enum values; follow its instruction to run statements separately.
5. `add_polygon_geojson_to_projects.sql` — project polygon and land-area support.
6. `add_project_photos_bucket.sql` — private project photo storage and policies.
7. `add_satellite_columns.sql` — satellite analysis and admin-review fields.
8. `add_marketplace_verified_read_policy.sql` — authenticated marketplace visibility.
9. `add_project_edit_permission.sql` — one-time edit authorization.
10. `add_company_emission_assessments.sql` — corporate emissions history.
11. `add_project_credit_orders.sql` — reservations, orders, webhook events, and inventory functions.

`seed_profiles.sql` is a one-time backfill for existing Supabase Auth users. Run it only when the Auth project predates `profiles_setup.sql`; it is not part of routine deployment.

## Operational rules

- Back up production data before applying schema changes.
- Apply scripts before deploying application code that depends on their columns or functions.
- Review Row Level Security and storage policies in the target project after each change.
- Never paste service-role keys or customer data into committed SQL files.
- Treat enum additions and payment inventory functions as release-critical changes.

The existing scripts are named by feature rather than timestamp. Until an automated migration system is introduced, this document is the canonical execution order.
