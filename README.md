# EU/UK Sovereignty Checklist

A practical, opinionated checklist plus a verification script for keeping a
UK/EU SaaS on **EEA/UK-sovereign infrastructure**. This is the exact
methodology and script I run quarterly on production stacks.

Published under **CC BY 4.0** so you can lift it, edit it, and use it
without asking. Attribution is welcome but not required.

---

## Why this exists

If you run a UK or EU SaaS that processes personal data, three forces push
you toward keeping that data in the EEA or the UK by default:

1. **UK GDPR compliance.** An EEA/UK-only sub-processor mix removes the
   complexity of cross-border transfer mechanisms (UK IDTA, SCCs, adequacy
   decisions) and reduces the surface for compliance failures.
2. **Procurement.** UK public-sector buyers — schools, councils, MATs,
   universities, NHS trusts, charities — increasingly require named
   EEA/UK-only data flows in supplier questionnaires. A sovereign posture
   wins more procurement responses.
3. **Optionality and resilience.** US CLOUD Act, FISA 702, and evolving
   transfer-mechanism case law (Schrems II/III) create periodic regulatory
   surprises for US-hosted dependencies. Avoiding them is operationally
   simpler than managing them.

This repo is what I codify around those three forces.

---

## The five principles

Each is a rule, not an aspiration. The script in this repo verifies most
of them mechanically; the rest are checklist items you confirm in
admin dashboards.

### Principle 1 — EEA/UK-sovereign by default

Every sub-processor that processes identifying personal data must, by
default, host that processing in the EEA or the UK. Any exception is
justified in writing, listed on the public sub-processor disclosure
page, and reviewed quarterly.

### Principle 2 — Region pinning is explicit

It is not enough that a vendor *"supports"* EU regions. Every vendor's
specific region is **explicitly configured**, **documented**, and
**verifiable** — via response trace headers, account settings
screenshots, vendor admin console confirmations, or both. The script
in this repo checks the configuration files; you check the admin
consoles.

Examples of explicit region pinning the script verifies:

- `vercel.json` includes `"regions": ["lhr1"]` (London) — pin the
  function execution region rather than relying on Vercel's default
  region selection.
- Sentry config files reference `*.de.sentry.io` (Frankfurt) — using
  the EU SaaS host, not the US default at `sentry.io`.
- Supabase project URL is present (the project region you confirm in
  the Supabase dashboard — the URL itself does not encode region).
- CSP `connect-src` includes `ingest.de.sentry.io` and does not include
  the US default `ingest.sentry.io`.

### Principle 3 — Sub-processor disclosure

A live sub-processor list is published at a stable URL (e.g.
`/sub-processors` or `/data-processors`). The list is updated within
**7 days** of any change. Material changes — new sub-processor
processing identifying data, region change, regulator change — are
notified to subscribers and posted on the public page **30 days before
they take effect**.

### Principle 4 — Quarterly verification

Every quarter, the operator runs `node verify-sovereignty.mjs` and
pastes the output into the quarterly access review record. Drift is
identified and a remediation timeline is set. The annual review (every
January) verifies each active sub-processor against the previous
year's attestation freshness, region pinning, and continued mission
alignment.

### Principle 5 — Documented exceptions

Two areas are typically acceptable exceptions in practice:

- **Edge/CDN providers** (e.g. Cloudflare). Personal data is not
  persisted at the edge — only TLS metadata and WAF challenge events
  transit. Region-agnostic by nature; documented under the principle
  rather than replaced.
- **Payment processors with EU entities** (e.g. Stripe Payments Europe
  Ltd, Adyen). Operational data may transit to a US parent under SCCs
  for fraud-prevention, customer-support, and platform-engineering
  purposes. The data exposed is transactional metadata, not learner
  or customer content at scale. SOC 2 Type II attestation satisfies
  the exception threshold.

Document the exceptions in writing. Show them to institutional buyers
who ask. Do **not** weaponise sovereignty as a marketing wedge — it is
shown, not sold.

---

## Using the script

```bash
# Drop the script into your project
cp verify-sovereignty.mjs /path/to/your-project/scripts/

# Edit the SOVEREIGNTY_CONFIG block at the top of the script to match
# your stack (file paths, expected region, env var names)

# Run it
node scripts/verify-sovereignty.mjs
```

Exit code is `0` if every check passes and non-zero otherwise, so you
can wire it into CI:

```yaml
# .github/workflows/sovereignty.yml
name: Sovereignty
on:
  pull_request:
  schedule:
    - cron: '0 9 1 */3 *'   # quarterly: 09:00 on the 1st of every 3rd month
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: CI=1 node scripts/verify-sovereignty.mjs
```

CI mode (`CI=1`) skips checks that read `.env.local`, since that file is
expected to be absent on CI runners.

For machine-readable output (e.g. piping to a dashboard), set
`SOVEREIGNTY_JSON=1`:

```bash
SOVEREIGNTY_JSON=1 node verify-sovereignty.mjs
```

See [`examples/`](examples/) for sample JSON output showing what a
fully-passing run looks like.

---

## What the script checks

| # | Check | Principle |
|---|-------|-----------|
| 1 | Vercel `vercel.json` pins `regions: ["lhr1"]` (or your chosen EU region) | 2 |
| 2 | All Sentry config files reference `*.de.sentry.io` | 2 |
| 3 | Supabase project URL is set (reminder to confirm region in dashboard) | 2 |
| 4 | Public sub-processor disclosure page mentions sovereignty posture | 3 |
| 5 | Privacy page is current — names current auth provider, no stale residue | 3 |
| 6 | `SECURITY.md` (vulnerability disclosure policy) present | 3 |
| 7 | GDPR Article 20 — data portability endpoint exists | — |
| 8 | GDPR Article 17 — account deletion endpoint exists | — |
| 9 | CSP `connect-src` targets Sentry EU host only | 2 |
| 10 | `X-Frame-Options: DENY` is set | — |

The script is intentionally focused on **infrastructure configuration**
that affects sovereignty — not the broader compliance posture (DPIAs,
DSAR logging, etc.). For the wider checklist see [`CHECKLIST.md`](CHECKLIST.md).

---

## Tailoring the script

The script's `SOVEREIGNTY_CONFIG` block at the top is intended to be
edited. Common adjustments:

- Change `vercelRegion` to your EU region (`lhr1` London, `fra1`
  Frankfurt, `dub1` Dublin, `cdg1` Paris, `arn1` Stockholm).
- Change `sentryEuHost` if you self-host Sentry in the EU.
- Change `supabaseExpectedRegion` to your project's region
  (`eu-west-2` London, `eu-central-1` Frankfurt, `eu-west-1` Ireland).
- Change `privacyMustMention` / `privacyMustNotMention` to flag any
  vendor you have migrated away from (e.g. ensure the privacy page no
  longer mentions a deprecated auth provider).
- Add new checks following the same pattern — each is a `try`/`catch`
  around a file read with a `record(...)` call.

---

## What this is not

- **Not legal advice.** Use this as engineering hygiene that supports
  legal compliance. Run material changes past counsel.
- **Not a competitive wedge.** Sovereignty is shown, not weaponised in
  marketing copy.
- **Not a perpetual escalation.** The principles set a default; new
  gaps are evaluated against the principles, not ratcheted further
  than the principles require.

---

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE).

You may copy, adapt, and use commercially. Attribution to this repo is
appreciated but not required.
