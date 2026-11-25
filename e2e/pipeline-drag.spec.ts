import { type Page } from '@playwright/test'
import { API_PORT } from './playwright.config'
import { drag, expect, test } from './fixtures'

const API = `http://127.0.0.1:${API_PORT}/api`
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

const column = (page: Page, stage: string) => page.getByRole('region', { name: stage, exact: true })
const card = (page: Page, name: string) => page.locator('[data-deal-id]').filter({ hasText: name })
const cardsIn = (page: Page, stage: string) => column(page, stage).locator('[data-deal-id]')
const headerFigure = (page: Page, label: string) => page.getByRole('definition').filter({ has: page.locator(`xpath=preceding-sibling::dt[.="${label}"]`) })

/** Waits for a column's cards to finish sliding into place after a drop, so their boxes
 *  are where they'll stay, as someone would before grabbing the next one. */
async function settled(page: Page, stage: string) {
  for (const each of await cardsIn(page, stage).all()) await expect(each).toHaveCSS('transform', 'none')
}

async function namesIn(page: Page, stage: string) {
  await page.locator('[data-deal-id]').first().waitFor()
  return cardsIn(page, stage).evaluateAll((cards) => cards.map((c) => c.querySelector('p.font-semibold')!.textContent))
}

test('criterion 4: drag a card to another column; the figures change before the server answers', async ({ page }) => {
  const deals: { name: string; stage: string; value: number; probability: number }[] = await (await page.request.get(`${API}/deals`)).json()
  const moving = deals.find((d) => d.name === 'Cobalt Bank fraud analytics pilot')!
  const sum = (stage: string) => deals.filter((d) => d.stage === stage).reduce((s, d) => s + d.value, 0)
  const open = deals.filter((d) => ['new', 'qualified', 'proposal', 'negotiation'].includes(d.stage))
  const expected = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0)

  await page.goto('/pipeline')
  await expect(column(page, 'New')).toContainText(usd(sum('new')))
  await expect(headerFigure(page, 'Expected revenue')).toHaveText(usd(expected))

  // Hold the save back, to see the board change before the server has answered.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/deals/*/move', async (route) => {
    await held
    await route.continue()
  })

  await drag(page, card(page, moving.name), cardsIn(page, 'Proposal').first(), 'top')
  await expect(cardsIn(page, 'Proposal').first()).toContainText(moving.name)
  await expect(column(page, 'New')).toContainText(usd(sum('new') - moving.value))
  await expect(column(page, 'Proposal')).toContainText(usd(sum('proposal') + moving.value))
  await expect(headerFigure(page, 'Open value')).toHaveText(usd(open.reduce((s, d) => s + d.value, 0)))
  await expect(headerFigure(page, 'Expected revenue')).toHaveText(usd(expected + (moving.value * (50 - moving.probability)) / 100))
  await expect(card(page, moving.name)).toContainText('50%')

  const saved = page.waitForResponse('**/api/deals/*/move')
  release()
  expect((await saved).status()).toBe(200)
  await expect(page.getByText('Deal moved')).toBeVisible()

  await page.goto('/deals')
  const row = page.getByRole('row', { name: new RegExp(moving.name) })
  await expect(row).toContainText('Proposal')
  await expect(row).toContainText('50%')
})

test('drag a card within its column, reload, and it stays where it was dropped', async ({ page }) => {
  await page.goto('/pipeline')
  const before = await namesIn(page, 'Qualified')
  await drag(page, card(page, before[2]), cardsIn(page, 'Qualified').first(), 'top')
  await expect(cardsIn(page, 'Qualified').first()).toContainText(before[2])
  await page.waitForLoadState('networkidle')
  await page.reload()
  expect(await namesIn(page, 'Qualified')).toEqual([before[2], before[0], before[1], before[3], before[4]])
})

test('drop a card in the gap between two cards, moving up or down, and it lands between them', async ({ page }) => {
  await page.goto('/pipeline')
  const before = await namesIn(page, 'Qualified')
  // Up: the fourth card (the fifth runs off the bottom of the window) into the gap between the first and second.
  await drag(page, card(page, before[3]), cardsIn(page, 'Qualified').nth(1), 'gap above')
  await expect(cardsIn(page, 'Qualified').nth(1)).toContainText(before[3])
  await page.waitForLoadState('networkidle')
  const up = [before[0], before[3], before[1], before[2], before[4]]
  expect(await namesIn(page, 'Qualified')).toEqual(up)

  // Down: the first card into the gap between the third and fourth.
  await settled(page, 'Qualified')
  await drag(page, card(page, up[0]), cardsIn(page, 'Qualified').nth(3), 'gap above')
  await expect(cardsIn(page, 'Qualified').nth(2)).toContainText(up[0])
  await page.waitForLoadState('networkidle')
  await page.reload()
  expect(await namesIn(page, 'Qualified')).toEqual([up[1], up[2], up[0], up[3], up[4]])
})

test('a second move while the board is refetching keeps the board, and both moves stay', async ({ page }) => {
  await page.goto('/pipeline')
  const before = await namesIn(page, 'Qualified')
  // Every refetch of the deals is held back, so the second move lands while one is on its way.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/deals', async (route) => {
    if (route.request().method() === 'GET') await held
    await route.continue()
  })

  const refetching = page.waitForRequest((r) => r.method() === 'GET' && r.url().endsWith('/api/deals'))
  await drag(page, card(page, before[2]), cardsIn(page, 'Qualified').first(), 'top')
  await refetching
  await settled(page, 'Qualified')
  const second = page.waitForResponse('**/api/deals/*/move')
  await drag(page, card(page, before[3]), cardsIn(page, 'Qualified').first(), 'top')
  expect((await second).status()).toBe(200)

  await expect(page.getByText("Can't reach Accountable's server")).toHaveCount(0)
  await expect(cardsIn(page, 'Qualified').first()).toContainText(before[3])
  release()
  await page.waitForLoadState('networkidle')
  await page.unroute('**/api/deals')
  await page.reload()
  expect(await namesIn(page, 'Qualified')).toEqual([before[3], before[2], before[0], before[1], before[4]])
})

test('drop a card below the last one, and into an empty column', async ({ page }) => {
  // Empty the Lost column first.
  const deals: { id: number; stage: string }[] = await (await page.request.get(`${API}/deals`)).json()
  for (const deal of deals.filter((d) => d.stage === 'lost')) await page.request.delete(`${API}/deals/${deal.id}`)

  await page.goto('/pipeline')
  await expect(cardsIn(page, 'Lost')).toHaveCount(0)
  const fresh = (await namesIn(page, 'New'))[0]!
  // The column scrolls on its own. Below its last card is the space at the bottom.
  const qualified = page.locator('[data-cards="qualified"]')
  await qualified.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await drag(page, card(page, fresh), qualified, 'bottom')
  await expect(cardsIn(page, 'Qualified').last()).toContainText(fresh)

  const other = (await namesIn(page, 'New'))[0]!
  await drag(page, card(page, other), page.locator('[data-cards="lost"]'), 'middle')
  await expect(cardsIn(page, 'Lost')).toHaveCount(1)
  await expect(cardsIn(page, 'Lost').first()).toContainText(other)
  await page.waitForLoadState('networkidle')

  await page.reload()
  await expect(cardsIn(page, 'Qualified').last()).toContainText(fresh)
  await expect(cardsIn(page, 'Lost').first()).toContainText(other)
  await expect(column(page, 'Lost')).toContainText('Lost, all time')
})

test('criterion 4: a deal added from a column starts at that stage, at the top', async ({ page }) => {
  await page.goto('/pipeline')
  await page.getByRole('button', { name: 'Add deal in Negotiation' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add deal' })
  await expect(dialog.getByLabel('Stage')).toHaveText('Negotiation')
  await expect(dialog.getByLabel('Probability (%)')).toHaveValue('75')
  await dialog.getByLabel('Name').fill('Kestrel Media archive search')
  await dialog.getByLabel('Value (USD)').fill('18000')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(cardsIn(page, 'Negotiation').first()).toContainText('Kestrel Media archive search')
  await expect(column(page, 'Negotiation')).toContainText(/^Negotiation\s*5/)
})

test.describe(() => {
  test.use({ expectedConsole: [/Failed to load resource: the server responded with a status of 500/] })

  test('a failed save puts the card back, with a message', async ({ page }) => {
    await page.route('**/api/deals/*/move', (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }))
    await page.goto('/pipeline')
    const name = (await namesIn(page, 'New'))[1]!
    await drag(page, card(page, name), cardsIn(page, 'Won').first(), 'top')
    await expect(page.getByText("Couldn't save the move, so the card is back where it was.")).toBeVisible()
    expect((await namesIn(page, 'New'))[1]).toBe(name)
    await expect(cardsIn(page, 'Won').first()).not.toContainText(name)
  })
})

test('clicking a card opens the deal', async ({ page }) => {
  await page.goto('/pipeline')
  await card(page, 'Harbor Logistics fleet analytics').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
})
