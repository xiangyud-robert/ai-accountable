import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { testEnv } from './playwright.config'
import { expect, test } from './fixtures'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('criterion 2: npm run seed brings back the sample data', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('button', { name: 'Delete Harbor Logistics' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete organization' }).click()
  await expect(page.getByText('14 organizations')).toBeVisible()
  await page.getByRole('button', { name: 'Add organization' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Made before the reset')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('15 organizations')).toBeVisible()

  // The documented command, against the tests' own database.
  const result = spawnSync('npm', ['run', 'seed'], {
    cwd: root,
    env: { ...process.env, ...testEnv },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toContain('15 organizations, 40 contacts, 45 deals and 100 activities')

  await page.reload()
  await expect(page.getByText('15 organizations')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Harbor Logistics' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Made before the reset' })).toHaveCount(0)
})
