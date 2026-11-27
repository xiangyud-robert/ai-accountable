import { type APIRequestContext, type Page } from '@playwright/test'
import { API_PORT, TODAY } from './playwright.config'
import { expect, test } from './fixtures'

const API = `http://127.0.0.1:${API_PORT}/api`
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const short = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`
  return `$${n}`
}

type Deal = { id: number; stage: string; value: number; probability: number; close_date: string }
const OPEN = ['new', 'qualified', 'proposal', 'negotiation']
const ORDER = ['new', 'qualified', 'proposal', 'negotiation', 'won']

/** Every figure on the dashboard, worked out from the deals and their histories, not from
 *  the dashboard's own endpoint. */
async function workedOut(request: APIRequestContext) {
  const deals: Deal[] = await (await request.get(`${API}/deals`)).json()
  const month = TODAY.slice(0, 7)
  const won = deals.filter((d) => d.stage === 'won')
  const open = deals.filter((d) => OPEN.includes(d.stage))
  const thisMonth = won.filter((d) => d.close_date.startsWith(month))
  const lastMonth = won.filter((d) => d.close_date.startsWith('2026-05'))
  const yearWon = won.filter((d) => d.close_date >= '2025-07-01')

  // Concern 7: each deal counts up to the furthest stage it reached.
  const funnel = ORDER.map(() => ({ count: 0, value: 0 }))
  for (const deal of deals) {
    const detail = await (await request.get(`${API}/deals/${deal.id}`)).json()
    const reached = detail.timeline
      .filter((e: { kind: string; to_value: string }) => e.kind === 'stage_change' && OPEN.includes(e.to_value))
      .map((e: { to_value: string }) => ORDER.indexOf(e.to_value))
    let furthest = Math.max(-1, ...reached)
    if (deal.stage === 'won') furthest = 4
    else if (OPEN.includes(deal.stage)) furthest = Math.max(furthest, ORDER.indexOf(deal.stage))
    for (let i = 0; i <= furthest; i++) {
      funnel[i].count += 1
      funnel[i].value += deal.value
    }
  }

  const sum = (list: Deal[]) => list.reduce((s, d) => s + d.value, 0)
  return {
    thisMonth: { revenue: sum(thisMonth), count: thisMonth.length },
    lastMonth: { revenue: sum(lastMonth), count: lastMonth.length },
    year: { revenue: sum(yearWon), count: yearWon.length },
    open: {
      count: open.length,
      value: sum(open),
      expected: open.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
    },
    byStage: OPEN.map((stage) => {
      const list = open.filter((d) => d.stage === stage)
      return { value: sum(list), expected: list.reduce((s, d) => s + (d.value * d.probability) / 100, 0) }
    }),
    funnel,
    lost: deals.filter((d) => d.stage === 'lost'),
  }
}

const panel = (page: Page, name: string) => page.getByRole('region', { name, exact: true })

test('criterion 6: the tiles, each chart’s summary and the funnel match the sample data', async ({ page, api }) => {
  const figures = await workedOut(api)
  await page.goto('/')
  await expect(page.getByText('Monday, June 15')).toBeVisible()

  await expect(page.getByText('Revenue won in June')).toBeVisible()
  await expect(page.getByText(usd(figures.thisMonth.revenue), { exact: true }).first()).toBeVisible()
  await expect(page.getByText(`May: ${usd(figures.lastMonth.revenue)}`)).toBeVisible()
  await expect(page.getByText(usd(figures.year.revenue), { exact: true }).first()).toBeVisible()
  await expect(page.getByText(`${figures.year.count} deals won · USD`)).toBeVisible()

  const tiles = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 2 }) })
  await expect(tiles.filter({ hasText: /^Deals won in June/ })).toContainText(
    `Deals won in June${figures.thisMonth.count}May: ${figures.lastMonth.count}`,
  )
  await expect(tiles.filter({ hasText: /^Open pipeline/ })).toContainText(
    `${usd(figures.open.value)}${figures.open.count} open deals`,
  )
  const share = Math.round((figures.open.expected / figures.open.value) * 100)
  await expect(tiles.filter({ hasText: /^Expected revenue/ })).toContainText(
    `${usd(figures.open.expected)}${share}% of the open pipeline`,
  )

  // The summaries in words.
  await expect(page.getByText(`${usd(figures.year.revenue)} won in the last 12 months`)).toBeAttached()
  await expect(panel(page, 'Deals won by month')).toContainText(`${figures.year.count} in the last 12 months`)
  await expect(page.getByText(`${usd(figures.open.value)} open, ${usd(figures.open.expected)} expected`)).toBeAttached()

  // The funnel's labels: count, short value and share of New's value, then the lost line.
  const funnel = panel(page, 'Sales funnel')
  const names = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won']
  for (const [i, step] of figures.funnel.entries()) {
    const share = Math.round((step.value / figures.funnel[0].value) * 100)
    await expect(funnel.getByRole('listitem').nth(i)).toHaveText(
      `${names[i]} · ${step.count}${short(step.value)} · ${share}%`,
    )
  }
  const lostValue = figures.lost.reduce((s, d) => s + d.value, 0)
  await expect(funnel).toContainText(`Lost: ${figures.lost.length} deals, ${usd(lostValue)}`)

  // Open pipeline by stage, in its table for screen readers.
  const stageTable = page.getByRole('table', { name: 'Open pipeline by stage' })
  for (const [i, stage] of figures.byStage.entries()) {
    await expect(stageTable.getByRole('row').nth(i + 1)).toContainText(`${usd(stage.value)}${usd(stage.expected)}`)
  }
})

test('the follow-ups: overdue first, oldest first, then the rest soonest first', async ({ page }) => {
  await page.goto('/')
  const followUps = panel(page, 'Follow-ups')
  await expect(followUps).toContainText('5 overdue, 6 due in the next 7 days')
  const badges = await followUps
    .getByRole('listitem')
    .evaluateAll((items) => items.map((li) => li.lastElementChild!.textContent))
  expect(badges).toEqual([
    '9 days overdue',
    '6 days overdue',
    '4 days overdue',
    '2 days overdue',
    '1 day overdue',
    'Due today',
    'Due tomorrow',
    'Due in 2 days',
    'Due in 4 days',
    'Due in 5 days',
    'Due in 7 days',
  ])
  await expect(followUps.getByRole('link', { name: 'Sable Hotels booking engine rollout' })).toHaveAttribute(
    'href',
    /\/deals\/\d+$/,
  )
})

test('each chart has its table for screen readers', async ({ page }) => {
  await page.goto('/')
  for (const [caption, rows] of [
    ['Revenue won by month', 12],
    ['Deals won by month', 12],
    ['Sales funnel', 5],
    ['Open pipeline by stage', 4],
  ] as const) {
    const table = page.getByRole('table', { name: caption })
    await expect(table).toBeAttached()
    await expect(table.locator('tbody tr')).toHaveCount(rows)
  }
  await expect(page.getByRole('table', { name: 'Revenue won by month' }).locator('tbody tr').last()).toContainText(
    'June 2026',
  )
})

test('the tiles and the pipeline visual link to the Pipeline', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /^Open pipeline/ }).click()
  await expect(page).toHaveURL('/pipeline')
  await page.goBack()
  await panel(page, 'Open pipeline by stage').getByRole('link', { name: 'Pipeline' }).click()
  await expect(page).toHaveURL('/pipeline')
})

test('recent activity is grouped under Today, Yesterday and Earlier, each linking to its record', async ({ page }) => {
  await page.goto('/')
  const recent = panel(page, 'Recent activity')
  await expect(recent.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(recent.getByRole('listitem')).toHaveCount(10)
  const first = recent.getByRole('region', { name: 'Today' }).getByRole('listitem').first()
  await expect(first).toContainText('Walked through the fleet analytics proposal.')
  await expect(first).toContainText('9:40 AM')
  await first.getByRole('link', { name: 'Harbor Logistics fleet analytics' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
})
