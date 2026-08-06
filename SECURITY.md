# Security Policy

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities or exposed credentials. Use GitHub's private vulnerability reporting for this repository:

1. Open the repository's **Security** tab.
2. Select **Advisories** and **Report a vulnerability**.
3. Include the affected route or component, reproduction steps, impact, and any suggested mitigation.

Please avoid accessing, modifying, or retaining data that does not belong to you while investigating. Maintainers will assess the report, coordinate a fix, and disclose it after affected deployments are protected.

## Supported version

Security fixes are applied to the current `main` branch. Older commits, forks, and unofficial deployments are not supported.

## Credential handling

Secrets belong in local `.env.local` files or encrypted deployment settings. Only variables prefixed with `NEXT_PUBLIC_` may be exposed to browser bundles, and those values must be intentionally public.

Known dependency findings that have not yet been remediated are documented in [docs/known-issues.md](docs/known-issues.md).
