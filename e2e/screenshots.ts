// Pictures of the app, run by screenshots.config.ts rather than npm test.

import { type Page, type PageAssertionsToHaveScreenshotOptions } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, PAGES, test, turnOnDarkMode } from './fixtures'

const here = dirname(fileURLToPath(import.meta.url))
const DOCS = join(here, '..', 'docs', 'changes', 'dark-mode')

// Pixel for pixel, with the Dark mode switch hidden, since it's the one thing allowed to differ.
const EXACTLY: PageAssertionsToHaveScreenshotOptions = {
  threshold: 0,
  maxDiffPixels: 0,
  stylePath: join(here, 'hide-dark-mode-switch.css'),
}
// Each section is pictured whole. Things that open over the page are pictured in the window, since
// a full-page picture resizes the window, and that closes a select.
const WHOLE_PAGE: PageAssertionsToHaveScreenshotOptions = { ...EXACTLY, fullPage: true }

/** Opens a page and waits until nothing more will change: its heading, the sidebar's counts,
 *  every request and the fonts. */
async function open(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  await settle(page)
}

async function settle(page: Page) {
  await expect(page.getByRole('link', { name: /^Deals\s*\d+$/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

async function openDealForm(page: Page) {
  await open(page, '/deals', 'Deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add deal' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('light mode is unchanged', () => {
  for (const [name, path, heading] of PAGES) {
    test(name, async ({ page }) => {
      await open(page, path, heading)
      await expect(page).toHaveScreenshot(`${name.replaceAll(' ', '-')}.png`, WHOLE_PAGE)
    })
  }

  test('the deal form', async ({ page }) => {
    await openDealForm(page)
    await expect(page).toHaveScreenshot('deal-form.png', EXACTLY)
  })

  test('the Stage select, open', async ({ page }) => {
    const dialog = await openDealForm(page)
    await dialog.getByLabel('Stage', { exact: true }).click()
    await expect(page.getByRole('option', { name: 'Qualified' })).toBeVisible()
    await expect(page).toHaveScreenshot('stage-select.png', EXACTLY)
  })

  test('a picker, open', async ({ page }) => {
    const dialog = await openDealForm(page)
    await dialog.getByRole('combobox', { name: /^Organization/ }).click()
    await expect(page.locator('[cmdk-input]')).toBeFocused()
    await expect(page).toHaveScreenshot('picker.png', EXACTLY)
  })

  test('an activity’s menu, open', async ({ page }) => {
    await open(page, '/deals/16', 'Brightline Retail POS integration')
    await page
      .getByRole('button', { name: /^Actions for this/ })
      .first()
      .click()
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(page).toHaveScreenshot('activity-menu.png', EXACTLY)
  })

  test('a secondary button, hovered', async ({ page }) => {
    await open(page, '/deals/12', 'Harbor Logistics fleet analytics')
    await page.getByRole('button', { name: 'Edit', exact: true }).hover()
    await expect(page).toHaveScreenshot('secondary-hover.png', EXACTLY)
  })

  test('a chart tooltip', async ({ page }) => {
    await open(page, '/', 'Dashboard')
    const chart = page.getByRole('region', { name: 'Deals won by month' }).locator('.recharts-surface')
    await chart.hover({ position: { x: 120, y: 150 } })
    await expect(page.locator('.recharts-tooltip-wrapper').filter({ hasText: 'Deals won' })).toBeVisible()
    await expect(page).toHaveScreenshot('chart-tooltip.png', EXACTLY)
  })

  test('the message after a save', async ({ page }) => {
    await open(page, '/organizations', 'Organizations')
    await page.getByRole('button', { name: 'Add organization' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add organization' })
    await dialog.getByLabel('Name').fill('Tidewater Energy')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Organization saved')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('message.png', EXACTLY)
  })
})

// Success criterion 3 in docs/changes/dark-mode/intent.md, with the switch showing.
test.describe('screenshots for the docs', () => {
  for (const [name, path, heading] of [
    ['dashboard', '/', 'Dashboard'],
    ['pipeline', '/pipeline', 'Pipeline'],
  ] as const) {
    test(name, async ({ page }) => {
      await open(page, path, heading)
      await page.screenshot({ path: join(DOCS, `${name}-light.png`), fullPage: true, animations: 'disabled' })
      await turnOnDarkMode(page)
      await open(page, path, heading)
      await page.screenshot({ path: join(DOCS, `${name}-dark.png`), fullPage: true, animations: 'disabled' })
    })
  }
})
