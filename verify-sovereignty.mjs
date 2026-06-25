#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// verify-sovereignty.mjs
//
// Quarterly verification script for a UK/EU SaaS keeping
// itself on EEA/UK-sovereign infrastructure.
//
// Methodology: see README.md and CHECKLIST.md in this repo.
//
// Drop into your project as `scripts/verify-sovereignty.mjs`,
// adjust the SOVEREIGNTY_CONFIG block to match your stack,
// and run quarterly. Paste the output into your access
// review record.
//
// Usage:
//   node scripts/verify-sovereignty.mjs
//   CI=1 node scripts/verify-sovereignty.mjs   # CI mode: skips .env.local checks
//
// Exit code 0 if all checks pass; non-zero if any check fails.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Repo root: the script lives in `scripts/` so the project root
// is one level up. If you place the script elsewhere, adjust.
const root = join(__dirname, '..')

// ─── CONFIG ────────────────────────────────────────────────
// Edit these to match your stack. Anything you set to `null`
// (or remove from the array) is skipped.
const SOVEREIGNTY_CONFIG = {
  // Vercel deployment region. London = lhr1, Frankfurt = fra1,
  // Dublin = dub1, Paris = cdg1, Stockholm = arn1.
  vercelRegion: 'lhr1',

  // Sentry EU host marker. EU orgs use *.de.sentry.io DSNs and
  // ingest at ingest.de.sentry.io. If you use a self-hosted
  // Sentry in the EU, replace with your ingest host.
  sentryEuHost: 'de.sentry.io',
  sentryIngestEuHost: 'ingest.de.sentry.io',

  // Sentry config files to scan for the EU guard.
  sentryConfigFiles: [
    'sentry.client.config.js',
    'sentry.server.config.js',
    'sentry.edge.config.js',
  ],

  // Supabase env var name + expected region for the dashboard
  // verification reminder. Region is a hint only — Supabase
  // project URLs do not encode region, so the operator must
  // confirm in the dashboard. Set to null to skip.
  supabaseEnvVar: 'NEXT_PUBLIC_SUPABASE_URL',
  supabaseExpectedRegion: 'eu-west-2',

  // Path to the public sub-processor disclosure page. The
  // script checks the page mentions "EEA" or "Sovereignty"
  // so you remember to publish the posture.
  subProcessorPage: 'app/data-processors/page.js',

  // Path to the public privacy policy. The script checks
  // for an absence of stale references (e.g. a vendor you
  // have migrated away from). Adjust the markers below.
  privacyPage: 'app/privacy/page.js',
  privacyMustMention: 'Supabase Auth',
  privacyMustNotMention: 'Clerk',

  // Endpoints for GDPR Article 15 (access / portability)
  // and Article 17 (erasure). These prove the right to
  // erasure and the right to data portability are wired.
  exportEndpoint: 'app/api/account/export/route.js',
  deleteEndpoint: 'app/api/account/delete/route.js',

  // Path to the middleware where CSP is set. The script
  // confirms the CSP `connect-src` does not leak telemetry
  // to a non-EU host.
  middlewareFile: 'lib/supabase/middleware.js',

  // Path to next.config.mjs for X-Frame-Options check.
  nextConfigFile: 'next.config.mjs',

  // Path to SECURITY.md (vulnerability disclosure policy).
  securityFile: 'SECURITY.md',
}
// ───────────────────────────────────────────────────────────

const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name} — ${detail}`)
}

// Skip a check without recording pass/fail. Use when a check is
// genuinely not applicable in the current environment (e.g. .env.local
// is absent on a CI runner — that's expected, not a regression).
function skip(name, detail) {
  console.log(`[SKIP] ${name} — skipped (${detail})`)
}

// 1) Vercel region pinned in vercel.json
try {
  const vc = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  const expected = SOVEREIGNTY_CONFIG.vercelRegion
  const ok = Array.isArray(vc.regions) && vc.regions.includes(expected)
  record(
    `Vercel region pinned to ${expected}`,
    ok,
    ok
      ? `regions = ${JSON.stringify(vc.regions)}`
      : `regions = ${JSON.stringify(vc.regions ?? 'not set')} — should include "${expected}"`,
  )
} catch (e) {
  record(`Vercel region pinned to ${SOVEREIGNTY_CONFIG.vercelRegion}`, false, `vercel.json read failed: ${e.message}`)
}

// 2) Sentry EU guard present in every config file
for (const f of SOVEREIGNTY_CONFIG.sentryConfigFiles) {
  try {
    const src = readFileSync(join(root, f), 'utf8')
    const ok = src.includes(SOVEREIGNTY_CONFIG.sentryEuHost)
    record(
      `Sentry config (${f}) carries EU guard`,
      ok,
      ok ? `contains ${SOVEREIGNTY_CONFIG.sentryEuHost} check` : `missing ${SOVEREIGNTY_CONFIG.sentryEuHost} check`,
    )
  } catch (e) {
    record(`Sentry config (${f}) carries EU guard`, false, `read failed: ${e.message}`)
  }
}

// 3) Supabase URL present (region must be confirmed in dashboard)
if (SOVEREIGNTY_CONFIG.supabaseEnvVar) {
  try {
    const env = readFileSync(join(root, '.env.local'), 'utf8')
    const pattern = new RegExp(`${SOVEREIGNTY_CONFIG.supabaseEnvVar}=https?:\\/\\/([^.]+)\\.supabase\\.co`)
    const match = env.match(pattern)
    if (match) {
      record(
        'Supabase project URL present in .env.local',
        true,
        `project ref = ${match[1]} (verify region in Supabase dashboard — must be ${SOVEREIGNTY_CONFIG.supabaseExpectedRegion})`,
      )
    } else {
      record(
        'Supabase project URL present in .env.local',
        false,
        `${SOVEREIGNTY_CONFIG.supabaseEnvVar} not found in .env.local`,
      )
    }
  } catch (e) {
    if (e.code === 'ENOENT' && process.env.CI) {
      skip('Supabase project URL present in .env.local', '.env.local absent on CI runner')
    } else {
      record('Supabase project URL present in .env.local', false, `.env.local read failed: ${e.message}`)
    }
  }
}

// 4) Public sub-processor disclosure page exists + mentions sovereignty
try {
  const page = readFileSync(join(root, SOVEREIGNTY_CONFIG.subProcessorPage), 'utf8')
  const ok = page.includes('EEA/UK-sovereign') || page.includes('Data Sovereignty') || page.includes('sovereignty')
  record(
    `${SOVEREIGNTY_CONFIG.subProcessorPage} mentions sovereignty posture`,
    ok,
    ok ? 'sovereignty section present' : 'sovereignty section missing',
  )
} catch (e) {
  record(`${SOVEREIGNTY_CONFIG.subProcessorPage} mentions sovereignty posture`, false, `read failed: ${e.message}`)
}

// 5) Privacy page is current (correct auth provider named, no stale residue)
try {
  const page = readFileSync(join(root, SOVEREIGNTY_CONFIG.privacyPage), 'utf8')
  const must = SOVEREIGNTY_CONFIG.privacyMustMention
  const mustNot = SOVEREIGNTY_CONFIG.privacyMustNotMention
  const hasMust = must ? page.includes(must) : true
  const residue = mustNot
    ? new RegExp(mustNot).test(page) && !page.includes(`${mustNot} (legacy`)
    : false
  const ok = hasMust && !residue
  record(
    `${SOVEREIGNTY_CONFIG.privacyPage} is current`,
    ok,
    ok
      ? `names "${must}" and contains no "${mustNot}" residue`
      : `must-mention "${must}": ${hasMust}; stale-residue "${mustNot}": ${residue}`,
  )
} catch (e) {
  record(`${SOVEREIGNTY_CONFIG.privacyPage} is current`, false, `read failed: ${e.message}`)
}

// 6) SECURITY.md present
try {
  readFileSync(join(root, SOVEREIGNTY_CONFIG.securityFile), 'utf8')
  record('SECURITY.md present', true, 'vulnerability disclosure policy in place')
} catch {
  record('SECURITY.md present', false, 'SECURITY.md missing')
}

// 7) GDPR Article 20 — data portability endpoint exists
try {
  readFileSync(join(root, SOVEREIGNTY_CONFIG.exportEndpoint), 'utf8')
  record('Data portability endpoint exists', true, `${SOVEREIGNTY_CONFIG.exportEndpoint} present`)
} catch {
  record('Data portability endpoint exists', false, `${SOVEREIGNTY_CONFIG.exportEndpoint} missing`)
}

// 8) GDPR Article 17 — account deletion endpoint exists
try {
  readFileSync(join(root, SOVEREIGNTY_CONFIG.deleteEndpoint), 'utf8')
  record('Account deletion endpoint exists', true, `${SOVEREIGNTY_CONFIG.deleteEndpoint} present`)
} catch {
  record('Account deletion endpoint exists', false, `${SOVEREIGNTY_CONFIG.deleteEndpoint} missing`)
}

// 9) CSP connect-src does not leak telemetry to non-EU host
try {
  const mw = readFileSync(join(root, SOVEREIGNTY_CONFIG.middlewareFile), 'utf8')
  const hasEu = mw.includes(SOVEREIGNTY_CONFIG.sentryIngestEuHost)
  const hasUs = /\bingest\.sentry\.io\b/.test(mw) && !mw.includes(SOVEREIGNTY_CONFIG.sentryIngestEuHost)
  record(
    'CSP connect-src targets Sentry EU host only',
    hasEu && !hasUs,
    hasEu && !hasUs
      ? 'EU host in CSP; US default absent'
      : `EU host: ${hasEu}; US-default residue: ${hasUs}`,
  )
} catch (e) {
  record('CSP connect-src targets Sentry EU host only', false, `read failed: ${e.message}`)
}

// 10) X-Frame-Options is DENY (matches CSP frame-ancestors 'none')
try {
  const cfg = readFileSync(join(root, SOVEREIGNTY_CONFIG.nextConfigFile), 'utf8')
  const denyMatch = /X-Frame-Options.*['"`]DENY['"`]/.test(cfg)
  record(
    'X-Frame-Options is DENY',
    denyMatch,
    denyMatch ? 'set to DENY' : `not DENY — check ${SOVEREIGNTY_CONFIG.nextConfigFile}`,
  )
} catch (e) {
  record('X-Frame-Options is DENY', false, `read failed: ${e.message}`)
}

// ─── Summary ───────────────────────────────────────────────
console.log('')
const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(
  `Summary: ${passed} passed, ${failed} failed (${results.length} checks recorded${process.env.CI ? '; some env-local checks skipped on CI' : ''})`,
)
console.log(`Run date: ${new Date().toISOString()}`)
console.log('')
console.log('Per the methodology (see README.md), append the outcome of')
console.log('this check to your quarterly access review record.')

// Machine-readable output for CI: write results JSON to stdout
// when SOVEREIGNTY_JSON=1 is set.
if (process.env.SOVEREIGNTY_JSON) {
  console.log('')
  console.log('---JSON---')
  console.log(JSON.stringify({ passed, failed, total: results.length, results, runDate: new Date().toISOString() }, null, 2))
}

process.exit(failed === 0 ? 0 : 1)
