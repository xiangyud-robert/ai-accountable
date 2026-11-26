import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { Dashboard } from '../../lib/types'
import { chart, panel, renderWithApp, STAGES, tableRows, tooltipLine } from '../../test-utils'
import { Funnel } from './Funnel'

const DASHBOARD: Dashboard = {
  today: '2026-06-15',
  this_month: { month: '2026-06', revenue: 0, count: 0 },
  last_month: { month: '2026-05', revenue: 0, count: 0 },
  months: [],
  last_12_months: { count: 0, value: 0 },
  open: { count: 0, value: 0, expected: 0 },
  by_stage: [],
  funnel: [
    { stage: 'new', count: 35, value: 1_600_000 },
    { stage: 'qualified', count: 29, value: 1_456_000 },
    { stage: 'proposal', count: 23, value: 1_280_000 },
    { stage: 'negotiation', count: 16, value: 864_000 },
    { stage: 'won', count: 11, value: 544_000 },
  ],
  lost: { count: 5, value: 268_000 },
  follow_ups: [],
  recent: [],
}

const renderFunnel = () => renderWithApp(<Funnel dashboard={DASHBOARD} stages={STAGES} />)

describe('Funnel', () => {
  test('each stage from New to Won gives its deals, its value and its share of New’s value', () => {
    renderFunnel()
    // Each step is two lines: the stage with its count, then its value with its share.
    const lines = [
      ['New · 35', '$1.6M · 100%'],
      ['Qualified · 29', '$1.5M · 91%'],
      ['Proposal · 23', '$1.3M · 80%'],
      ['Negotiation · 16', '$864K · 54%'],
      ['Won · 11', '$544K · 34%'],
    ]
    // A line's parts are styled apart, so it's found by its whole text.
    const isLine = (_: string, element: Element | null) => lines.flat().includes(element?.textContent ?? '')
    const steps = within(panel('Sales funnel')).getAllByRole('listitem')
    expect(
      steps.map((step) =>
        within(step)
          .getAllByText(isLine)
          .map((line) => line.textContent),
      ),
    ).toEqual(lines)
  })

  test('a shortened value gives the full amount on hover', () => {
    renderFunnel()
    expect(within(panel('Sales funnel')).getByTitle('$1,456,000')).toHaveTextContent('$1.5M · 91%')
  })

  test('the lost deals are totalled underneath', () => {
    renderFunnel()
    expect(within(panel('Sales funnel')).getByText(/^Lost:/)).toHaveTextContent('Lost: 5 deals, $268,000')
  })

  test('pointing at a stage in the funnel shows its deals and its full value', async () => {
    renderFunnel()
    await userEvent.hover(chart().querySelector('path[name="Proposal"]')!)
    expect(await within(chart()).findByText('Proposal')).toBeInTheDocument()
    expect(tooltipLine('Deals')).toHaveTextContent('Deals 23')
    expect(tooltipLine('Value')).toHaveTextContent('Value $1,280,000')
  })

  test('screen readers get the funnel in words and in a table', () => {
    renderFunnel()
    expect(within(panel('Sales funnel')).getByText('$544,000 of $1,600,000 reached Won')).toBeInTheDocument()
    expect(tableRows('Sales funnel')).toEqual([
      ['Stage', 'Deals reaching it', 'Value reaching it (USD)', 'Share of New’s value'],
      ['New', '35', '$1,600,000', '100%'],
      ['Qualified', '29', '$1,456,000', '91%'],
      ['Proposal', '23', '$1,280,000', '80%'],
      ['Negotiation', '16', '$864,000', '54%'],
      ['Won', '11', '$544,000', '34%'],
    ])
  })
})
