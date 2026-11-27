import { defineConfig } from '@playwright/test'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const API_PORT = 8100
export const WEB_PORT = 5273
export const TODAY = '2026-06-15'
/** The team's time zone (concern 16), and Chrome's, unless a test sets another. */
export const TEAM_ZONE = 'America/Los_Angeles'

// The tests' own database, so running them never changes the app's data, the stand-in sign-in
// (concern 18), and the team's zone, so the results don't depend on this computer's.
export const testEnv = {
  DATABASE_URL: 'sqlite:///e2e/.data/test.db',
  ACCOUNTABLE_TODAY: TODAY,
  ACCOUNTABLE_STAND_IN: '1',
  ACCOUNTABLE_TIMEZONE: TEAM_ZONE,
}

// Supabase's settings are taken out of this run's own environment, even when the shell has them,
// so nothing it starts (the servers, the test workers, the seed command) can sign in with Supabase
// or reach it (risk 13). Leaving them out of a server's `env` isn't enough, since Playwright adds
// its own environment to it.
for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) delete process.env[name]

/** Files that hold stand-in tokens, kept outside the repo, since gitleaks scans git-ignored files
 *  too and would take a token for a leaked secret. A token is worthless once this run's backend
 *  stops, as the stand-in's key is only in its memory (risk 10). The folder is this repo's own,
 *  so two copies of it on one computer never share one. */
export const OUTSIDE_REPO = join(
  tmpdir(),
  `accountable-e2e-${createHash('sha256').update(root).digest('hex').slice(0, 8)}`,
)

/** Dana's session, saved by the setup project for the tests to start with. */
export const DANAS_SESSION = join(OUTSIDE_REPO, 'dana.json')

/** Signs in once, through the sign-in screen, before any test runs. */
export const signInSetup = { name: 'sign in', testMatch: 'sign-in.setup.ts' }

/** The tests in `testMatch`, each starting signed in as Dana. */
export function signedInAsDana(name: string, testMatch: string) {
  return { name, testMatch, dependencies: [signInSetup.name], use: { storageState: DANAS_SESSION } }
}

export default defineConfig({
  testDir: '.',
  projects: [signInSetup, signedInAsDana('chrome', '*.spec.ts')],
  // The tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  // A test left with .only would make the run skip every other test, so it fails instead.
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // The list as the tests run, and an HTML report in playwright-report/, for a closer look at a failure.
  reporter: [['list'], ['html', { outputFolder: join(root, 'playwright-report'), open: 'never' }]],
  // Traces of failed tests and the files they're made from, which hold stand-in tokens, outside
  // the repo (see OUTSIDE_REPO). The HTML report keeps its traces zipped, which gitleaks doesn't open.
  outputDir: join(OUTSIDE_REPO, 'test-results'),
  use: {
    channel: 'chrome',
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    timezoneId: TEAM_ZONE,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `uv run uvicorn backend.main:app --host 127.0.0.1 --port ${API_PORT} --log-level warning`,
      cwd: root,
      // Signed out, this answers 401 (R15), which Playwright counts as started (risk 7).
      url: `http://127.0.0.1:${API_PORT}/api/stages`,
      env: testEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace frontend -- --logLevel warn',
      cwd: root,
      url: `http://127.0.0.1:${WEB_PORT}/`,
      env: { ACCOUNTABLE_WEB_PORT: String(WEB_PORT), ACCOUNTABLE_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
