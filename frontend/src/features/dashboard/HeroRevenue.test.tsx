import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import type { Dashboard } from '../../lib/types'
import { chart, pointAbove, renderWithApp, stubChartSize, tableRows, tooltipLine } from '../../test-utils'
import { HeroRevenue } from './HeroRevenue'

const month = (month: string, revenue: number, count: number) => ({ month, revenue, count })

const DASHBOARD: Dashboard = {
  today: '2026-06-15',
  this_month: month('2026-06', 47_500, 1),
  last_month: month('2026-05', 138_500, 2),
  months: [
    month('2025-07', 0, 0),
    month('2025-08', 24_000, 1),
    month('2025-09', 0, 0),
    month('2025-10', 61_500, 2),
    month('2025-11', 18_000, 1),
    month('2025-12', 0, 0),
    month('2026-01', 42_000, 1),
    month('2026-02', 35_500, 1),
    month('2026-03', 0, 0),
    month('2026-04', 72_000, 2),
    month('2026-05', 138_500, 2),
    month('2026-06', 47_500, 1),
  ],
  last_12_months: { count: 11, value: 439_000 },
  open: { count: 0, value: 0, expected: 0 },
  by_stage: [],
  funnel: [],
  lost: { count: 0, value: 0 },
  follow_ups: [],
  recent: [],
}

const NOTHING_WON: Dashboard = {
  ...DASHBOARD,
  this_month: month('2026-06', 0, 0),
  last_month: month('2026-05', 0, 0),
  months: DASHBOARD.months.map((m) => ({ ...m, revenue: 0, count: 0 })),
  last_12_months: { count: 0, value: 0 },
}

beforeEach(() => stubChartSize(640, 260))

describe('HeroRevenue', () => {
  test('the main figure is this month’s revenue, with last month’s and the last 12 months’', () => {
    renderWithApp(<HeroRevenue dashboard={DASHBOARD} />)
    expect(screen.getByRole('heading', { name: 'Revenue won in June' })).toBeInTheDocument()
    // Leaving out the table for screen readers, which gives June's revenue too.
    expect(screen.getByText('$47,500', { ignore: 'table *' })).toBeInTheDocument()
    expect(screen.getByText('May:')).toHaveTextContent('May: $138,500')
    const year = screen.getByText(/^Last 12 months/)
    expect(within(year).getByText('$439,000')).toBeInTheDocument()
    expect(year).toHaveTextContent(/11 deals won · USD$/)
  })

  test('the money axis climbs in round, short steps above the peak month', () => {
    renderWithApp(<HeroRevenue dashboard={DASHBOARD} />)
    for (const tick of ['$0', '$50K', '$100K', '$150K']) {
      expect(within(chart()).getByText(tick)).toBeInTheDocument()
    }
  })

  test('only the peak month and this month are labelled with their revenue', () => {
    renderWithApp(<HeroRevenue dashboard={DASHBOARD} />)
    expect(within(chart()).getByText('$139K')).toBeInTheDocument()
    expect(within(chart()).getByText('$47.5K')).toBeInTheDocument()
    expect(within(chart()).queryByText('$72K')).not.toBeInTheDocument()
    expect(within(chart()).queryByText('$24K')).not.toBeInTheDocument()
  })

  test('with nothing won, only this month is labelled, rather than every month as the peak', () => {
    renderWithApp(<HeroRevenue dashboard={NOTHING_WON} />)
    // The axis's one tick, and this month's label.
    expect(within(chart()).getAllByText('$0')).toHaveLength(2)
  })

  test('pointing at a month shows its full revenue and its number of deals', async () => {
    renderWithApp(<HeroRevenue dashboard={DASHBOARD} />)
    await pointAbove('Oct')
    expect(await within(chart()).findByText('October 2025')).toBeInTheDocument()
    expect(tooltipLine('Won')).toHaveTextContent('Won $61,500')
    expect(tooltipLine('Deals')).toHaveTextContent('Deals 2')
    await pointAbove('May')
    expect(await within(chart()).findByText('May 2026')).toBeInTheDocument()
    expect(tooltipLine('Won')).toHaveTextContent('Won $138,500')
    expect(within(chart()).queryByText('October 2025')).not.toBeInTheDocument()
  })

  test('screen readers get the total in words and each month’s figures in a table', () => {
    renderWithApp(<HeroRevenue dashboard={DASHBOARD} />)
    expect(screen.getByText('$439,000 won in the last 12 months')).toBeInTheDocument()
    const rows = tableRows('Revenue won by month')
    expect(rows).toHaveLength(13)
    expect(rows[0]).toEqual(['Month', 'Revenue won (USD)', 'Deals won'])
    expect(rows[1]).toEqual(['July 2025', '$0', '0'])
    expect(rows[11]).toEqual(['May 2026', '$138,500', '2'])
    expect(rows[12]).toEqual(['June 2026', '$47,500', '1'])
  })
})
