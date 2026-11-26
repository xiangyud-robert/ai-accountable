import { defineConfig } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import config from './playwright.config'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Runs only screenshots.ts, by hand: `npx playwright test -c e2e/screenshots.config.ts`. Its
// pictures depend on this computer's Chrome and fonts, so npm test and CI never run it. It uses
// the main config's servers, and the fixtures give it the same data and clock.
export default defineConfig({
  ...config,
  testMatch: 'screenshots.ts',
  // The light-mode pictures from before the change, kept out of git.
  snapshotPathTemplate: join(root, 'tmp', 'light-baseline', '{arg}{ext}'),
  outputDir: join(root, 'tmp', 'screenshot-results'),
  reporter: 'list',
})
