import { type Page } from '@playwright/test'
import { API_PORT } from './playwright.config'
import { drag, expect, test } from './fixtures'

const API = `http://127.0.0.1:${API_PORT}/api`
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const card = (page: Page, name: string) => page.locator('[data-deal-id]').filter({ hasText: name })
const cardsIn = (page: Page, stage: string) =>
  page.getByRole('region', { name: stage, exact: true }).locator('[data-deal-id]')
const DEAL = 'Ridgeway Manufacturing support plan renewal'

test('criteria 4, 5 and 6: drag a deal to Won', async ({ page, api }) => {
  const before = await (await api.get(`${API}/dashboard`)).json()
  const deals = await (await api.get(`${API}/deals`)).json()
  const deal = deals.find((d: { name: string; stage: string }) => d.name === DEAL && d.stage === 'negotiation')
  expect(deal.contact_name).toBe('Arjun Mehta')

  // The main contact starts out qualified.
  await page.goto(`/contacts/${deal.contact_id}`)
  await expect(page.getByText('Qualified', { exact: true }).first()).toBeVisible()

  await page.goto('/pipeline')
  await drag(page, card(page, DEAL), cardsIn(page, 'Won').first(), 'top')
  await expect(cardsIn(page, 'Won').first()).toContainText(DEAL)
  // Its close date becomes today.
  await expect(cardsIn(page, 'Won').first()).toContainText('Jun 15')
  await page.waitForLoadState('networkidle')

  await page.goto('/deals')
  const row = page.getByRole('row', { name: new RegExp(DEAL) })
  await expect(row).toContainText('Won')
  await expect(row).toContainText('100%')
  await expect(row).toContainText('Jun 15, 2026')

  // The main contact becomes a customer, and their timeline says so.
  await page.goto(`/contacts/${deal.contact_id}`)
  await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible()
  const timeline = page.getByRole('list', { name: 'Timeline' })
  await expect(timeline.getByRole('listitem').first()).toContainText(`Became a customer when ${DEAL} was won`)
  await expect(timeline.getByRole('listitem').nth(1)).toContainText('Moved from Negotiation to Won')

  // The dashboard's revenue and deals won this month go up by its value and by one.
  await page.goto('/')
  await expect(page.getByText(usd(before.this_month.revenue + deal.value), { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /^Deals won in June/ })).toContainText(
    `Deals won in June${before.this_month.count + 1}`,
  )
  const recent = page.getByRole('region', { name: 'Recent activity' })
  await expect(recent.getByRole('listitem').first()).toContainText(`Became a customer when ${DEAL} was won`)

  // Moving it back to Negotiation keeps the contact a customer (concern 8).
  await page.goto('/pipeline')
  await drag(page, card(page, DEAL), cardsIn(page, 'Negotiation').first(), 'top')
  await expect(cardsIn(page, 'Negotiation').first()).toContainText(DEAL)
  await expect(cardsIn(page, 'Negotiation').first()).toContainText('75%')
  await page.waitForLoadState('networkidle')
  await page.goto(`/contacts/${deal.contact_id}`)
  await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible()
})
