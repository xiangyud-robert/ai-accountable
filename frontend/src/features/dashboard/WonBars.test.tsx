import { within } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import type { Dashboard } from '../../lib/types'
import { chart, panel, pointAbove, renderWithApp, stubChartSize, tableRows, tooltipLine } from '../../test-utils'
import { WonBars } from './WonBars'

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
    month('2026-04', 102_000, 3),
    month('2026-05', 138_500, 2),
    month('2026-06', 47_500, 1),
  ],
  last_12_months: { count: 12, value: 469_000 },
  open: { count: 0, value: 0, expected: 0 },
  by_stage: [],
  funnel: [],
  lost: { count: 0, value: 0 },
  follow_ups: [],
  recent: [],
}

beforeEach(() => stubChartSize())

describe('WonBars', () => {
  test('the heading gives the number won in the last 12 months', () => {
    renderWithApp(<WonBars dashboard={DASHBOARD} />)
    expect(within(panel('Deals won by month')).getByText(/in the last 12 months$/)).toHaveTextContent(
      '12 in the last 12 months',
    )
  })

  test('the 12 months run oldest first, with the count on each month’s bar', () => {
    renderWithApp(<WonBars dashboard={DASHBOARD} />)
    const months = within(chart()).getAllByText(/^[A-Z][a-z]{2}$/)
    expect(months.map((m) => m.textContent)).toEqual('Jul Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun'.split(' '))
    // Months with nothing won have no bar to label.
    const counts = within(chart()).getAllByText(/^\d+$/)
    expect(counts.map((c) => c.textContent)).toEqual(['1', '2', '1', '1', '1', '3', '2', '1'])
  })

  test('pointing at a month shows its count and its full revenue', async () => {
    renderWithApp(<WonBars dashboard={DASHBOARD} />)
    await pointAbove('Apr')
    expect(await within(chart()).findByText('April 2026')).toBeInTheDocument()
    expect(tooltipLine('Deals won')).toHaveTextContent('Deals won 3')
    expect(tooltipLine('Revenue')).toHaveTextContent('Revenue $102,000')
  })

  test('screen readers get each month’s figures in a table', () => {
    renderWithApp(<WonBars dashboard={DASHBOARD} />)
    const rows = tableRows('Deals won by month')
    expect(rows).toHaveLength(13)
    expect(rows[0]).toEqual(['Month', 'Deals won', 'Revenue won (USD)'])
    expect(rows[1]).toEqual(['July 2025', '0', '$0'])
    expect(rows[10]).toEqual(['April 2026', '3', '$102,000'])
  })
})
