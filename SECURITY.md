# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in this repository — in the
verification script, the checklist, or the example output — please report
it privately rather than opening a public issue.

**Contact:** [security@sansware.tech](mailto:security@sansware.tech)

When reporting, please include:

- A description of the issue and the impact you believe it has.
- Steps to reproduce, or a minimal proof-of-concept where relevant.
- Any environment details that matter (Node.js version, OS, etc.).
- Whether you have disclosed the issue elsewhere.

## Response cadence

We aim to:

- **Acknowledge** your report within **3 working days**.
- **Triage** and provide an initial assessment within **10 working days**.
- **Coordinate disclosure** on a **90-day** cadence from the date of the
  initial report. If a fix lands sooner, we will disclose sooner; if the
  issue is complex and a fix is genuinely not feasible within 90 days, we
  will agree an extended timeline with the reporter in writing.

We follow a **coordinated disclosure** model: the reporter and the
maintainer agree the public-disclosure date together. We will credit
reporters in the changelog by default, unless they ask to remain
anonymous.

## Scope

This repository contains:

- `verify-sovereignty.mjs` — a Node.js script that reads files from the
  caller's project directory and reports infrastructure-configuration
  findings.
- `CHECKLIST.md`, `README.md`, and example output files — documentation.

In-scope issues include, for example:

- Path-traversal or arbitrary file-read bugs in the verification script.
- Inaccurate or misleading guidance that could lead an operator to a
  materially less secure or less compliant posture.
- Dependency or supply-chain issues in the script's runtime.

Out of scope:

- Issues in third-party tools or platforms the checklist references
  (Vercel, Supabase, Sentry, Cloudflare, Stripe, etc.). Report those
  directly to the vendor.
- Configuration choices in a consumer's own project. The script is a
  diagnostic tool; the operator is responsible for their stack.

## Safe harbour

We will not pursue legal action against security researchers who:

- Report issues in good faith through the contact above.
- Avoid privacy violations, data destruction, or service degradation.
- Give us a reasonable opportunity to remediate before public disclosure.

Thank you for helping keep this project trustworthy.
