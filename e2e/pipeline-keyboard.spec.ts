import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

const cardsIn = (page: Page, stage: string) => page.getByRole('region', { name: stage, exact: true }).locator('[data-deal-id]')
const live = (page: Page) => page.getByTestId('pipeline-announcements')

async function namesIn(page: Page, stage: string) {
  await page.locator('[data-deal-id]').first().waitFor()
  return cardsIn(page, stage).evaluateAll((cards) => cards.map((c) => c.querySelector('p.font-semibold')!.textContent))
}

test('criterion 8: move a card to another column and position with the keyboard only, and it stays there', async ({ page }) => {
  await page.goto('/pipeline')
  const qualified = await namesIn(page, 'Qualified')
  const proposal = await namesIn(page, 'Proposal')
  const moving = qualified[0]!

  // Tab from the column's Add button reaches its first card.
  await page.getByRole('button', { name: 'Add deal in Qualified' }).focus()
  await page.keyboard.press('Tab')
  await expect(cardsIn(page, 'Qualified').first()).toBeFocused()

  await page.keyboard.press('Space')
  await expect(live(page)).toHaveText(`Picked up ${moving}, in Qualified, position 1 of 5`)
  await page.keyboard.press('ArrowRight')
  await expect(live(page)).toHaveText('Moved to Proposal, position 1 of 6')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(live(page)).toHaveText('Moved to Proposal, position 3 of 6')
  await expect(page.locator(`[data-deal-id]`).filter({ hasText: moving })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(live(page)).toHaveText('Dropped in Proposal, position 3 of 6')
  await expect(cardsIn(page, 'Proposal').nth(2)).toContainText(moving)
  await expect(cardsIn(page, 'Proposal').nth(2)).toContainText('50%')
  await page.waitForLoadState('networkidle')

  await page.reload()
  expect(await namesIn(page, 'Proposal')).toEqual([proposal[0], proposal[1], moving, ...proposal.slice(2)])
  expect(await namesIn(page, 'Qualified')).toEqual(qualified.slice(1))
})

test('Escape cancels a move', async ({ page }) => {
  await page.goto('/pipeline')
  const before = await namesIn(page, 'Negotiation')
  const moving = before[1]!
  await cardsIn(page, 'Negotiation').nth(1).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await expect(cardsIn(page, 'Won').nth(1)).toContainText(moving)
  await page.keyboard.press('Escape')
  await expect(live(page)).toHaveText(`Move cancelled. ${moving} is back in Negotiation, position 2 of 4`)
  expect(await namesIn(page, 'Negotiation')).toEqual(before)
  await page.reload()
  expect(await namesIn(page, 'Negotiation')).toEqual(before)
})

test('Enter opens the deal', async ({ page }) => {
  await page.goto('/pipeline')
  const name = (await namesIn(page, 'New'))[0]!
  await cardsIn(page, 'New').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
})

test('every card can be reached with Tab', async ({ page }) => {
  await page.goto('/pipeline')
  const first = cardsIn(page, 'Won').first()
  await expect(first).toHaveAttribute('tabindex', '0')
  await expect(first).toHaveAttribute('aria-roledescription', 'sortable')
  const total = await page.locator('[data-deal-id]').count()
  const focusable = await page.locator('[data-deal-id][tabindex="0"]').count()
  expect(focusable).toBe(total)
})
