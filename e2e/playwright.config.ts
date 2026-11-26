import { defineConfig } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const API_PORT = 8100
export const WEB_PORT = 5273
export const TODAY = '2026-06-15'

// The tests' own database, so running them never changes the app's data.
export const testEnv = {
  DATABASE_URL: 'sqlite:///e2e/.data/test.db',
  ACCOUNTABLE_TODAY: TODAY,
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
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
  outputDir: join(root, 'test-results'),
  use: {
    channel: 'chrome',
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    timezoneId: 'America/Los_Angeles',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `uv run uvicorn backend.main:app --host 127.0.0.1 --port ${API_PORT} --log-level warning`,
      cwd: root,
      url: `http://127.0.0.1:${API_PORT}/api/stages`,
      env: { ...process.env, ...testEnv } as Record<string, string>,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --workspace frontend -- --logLevel warn',
      cwd: root,
      url: `http://127.0.0.1:${WEB_PORT}/`,
      env: {
        ...process.env,
        ACCOUNTABLE_WEB_PORT: String(WEB_PORT),
        ACCOUNTABLE_API_PORT: String(API_PORT),
      } as Record<string, string>,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
