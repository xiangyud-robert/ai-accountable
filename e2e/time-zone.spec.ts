// Concern 16: the browser follows the team's time zone, Los Angeles, from GET /api/me, whatever
// its own zone is.

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Chrome's clock is fixed at 11:00 on June 15 in Los Angeles (see the fixtures), which in Tokyo
// is already 03:00 on June 16.
test.use({ timezoneId: 'Asia/Tokyo' })

async function open(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

test('Chrome is in Tokyo, where it is already June 16, and the dashboard’s date is the team’s June 15', async ({
  page,
}) => {
  await open(page, '/', 'Dashboard')
  expect(await page.evaluate(() => new Date().toDateString())).toBe('Tue Jun 16 2026')
  await expect(page.getByText('Monday, June 15', { exact: true })).toBeVisible()
})

test('“Today” in a timeline is the team’s today', async ({ page }) => {
  await open(page, '/deals/12', 'Harbor Logistics fleet analytics')
  const entry = page
    .getByRole('list', { name: 'Timeline' })
    .getByRole('listitem')
    .filter({ hasText: 'Walked through the fleet analytics proposal' })
  await expect(entry).toContainText('Today, 9:40 AM')
})

test('the activity form’s default date and time are the team’s now', async ({ page }) => {
  await open(page, '/contacts/6', 'Grace Whitfield')
  await expect(page.getByRole('form', { name: 'Log activity' }).getByLabel('When')).toHaveValue('2026-06-15T11:00')
})

test('R1: a card the browser moves is late only if its close date is before the team’s today', async ({ page }) => {
  // A deal that closes on the team's today, so it isn't late there, though it would be in Tokyo.
  await open(page, '/deals/1', 'Cobalt Bank fraud analytics pilot')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit deal' })
  await dialog.getByLabel('Close date').fill('2026-06-15')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  // Moving it with the keyboard, the browser works out whether it's late (R1) until it's dropped.
  await page.goto('/pipeline')
  const card = page.locator('[data-deal-id]').filter({ hasText: 'Cobalt Bank fraud analytics pilot' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Late', { exact: true })).toHaveCount(0)
  await card.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  const moved = page
    .getByRole('region', { name: 'Qualified', exact: true })
    .locator('[data-deal-id]')
    .filter({ hasText: 'Cobalt Bank fraud analytics pilot' })
  await expect(moved).toBeVisible()
  await expect(moved.getByText('Late', { exact: true })).toHaveCount(0)

  // A card closing the day before the team's today is late, moved the same way.
  await page.keyboard.press('Escape')
  const quarry = page.locator('[data-deal-id]').filter({ hasText: 'Quarry & Co finance reporting setup' })
  await quarry.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await expect(
    page
      .getByRole('region', { name: 'Proposal', exact: true })
      .locator('[data-deal-id]')
      .filter({ hasText: 'Quarry & Co finance reporting setup' })
      .getByText('Late', { exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
})
