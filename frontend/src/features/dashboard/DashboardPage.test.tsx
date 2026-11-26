import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { Dashboard } from '../../lib/types'
import { mockFetch, renderWithApp } from '../../test-utils'
import { DashboardPage } from './DashboardPage'

const DASHBOARD: Dashboard = {
  today: '2026-06-15',
  this_month: { month: '2026-06', revenue: 47_500, count: 1 },
  last_month: { month: '2026-05', revenue: 138_500, count: 2 },
  months: [
    { month: '2025-07', revenue: 0, count: 0 },
    ...['08', '09', '10', '11', '12'].map((m) => ({ month: `2025-${m}`, revenue: 10_000, count: 1 })),
    ...['01', '02', '03', '04'].map((m) => ({ month: `2026-${m}`, revenue: 20_000, count: 1 })),
    { month: '2026-05', revenue: 138_500, count: 2 },
    { month: '2026-06', revenue: 47_500, count: 1 },
  ],
  last_12_months: { count: 12, value: 316_000 },
  open: { count: 19, value: 804_500, expected: 384_775 },
  by_stage: [
    { stage: 'new', count: 5, value: 131_000, expected: 13_100 },
    { stage: 'qualified', count: 5, value: 169_000, expected: 42_250 },
    { stage: 'proposal', count: 5, value: 245_500, expected: 132_250 },
    { stage: 'negotiation', count: 4, value: 259_000, expected: 197_175 },
  ],
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

/** Answers the dashboard, and the lists the deal form picks from. */
function renderPage(dashboard: Dashboard = DASHBOARD) {
  const replies: Record<string, unknown> = { '/dashboard': dashboard, '/organizations': [], '/contacts': [] }
  const calls = mockFetch((_method, path) => ({ body: replies[path] }))
  return { ...renderWithApp(<DashboardPage />), calls }
}

const tile = (name: RegExp) => screen.getByRole('link', { name })

describe('DashboardPage', () => {
  test('shows each panel once the figures have loaded, under today’s date', async () => {
    const { calls } = renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Open pipeline/ })).not.toBeInTheDocument()

    expect(await screen.findByText('Monday, June 15')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/dashboard', body: undefined }])
    for (const name of [
      'Revenue won in June',
      'Deals won by month',
      'Sales funnel',
      'Open pipeline by stage',
      'Follow-ups',
      'Recent activity',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  test('the three tiles give this month’s deals, the open pipeline and the expected revenue', async () => {
    renderPage()
    const won = await screen.findByRole('link', { name: /^Deals won in June/ })
    expect(within(won).getByText('1')).toBeInTheDocument()
    expect(within(won).getByText(/^May:/)).toHaveTextContent('May: 2')

    const open = tile(/^Open pipeline/)
    expect(within(open).getByText('$804,500')).toBeInTheDocument()
    expect(within(open).getByText(/open deals$/)).toHaveTextContent('19 open deals')

    // $384,775 of $804,500 is 47.8%.
    const expected = tile(/^Expected revenue/)
    expect(within(expected).getByText('$384,775')).toBeInTheDocument()
    expect(within(expected).getByText(/of the open pipeline$/)).toHaveTextContent('48% of the open pipeline')
  })

  test('each tile links to the pipeline', async () => {
    const { router } = renderPage()
    for (const name of [/^Deals won in June/, /^Open pipeline/, /^Expected revenue/]) {
      expect(await screen.findByRole('link', { name })).toHaveAttribute('href', '/pipeline')
    }
    await userEvent.click(tile(/^Expected revenue/))
    expect(router.state.location.pathname).toBe('/pipeline')
  })

  test('with no open deals, the expected revenue is 0% of the open pipeline', async () => {
    renderPage({ ...DASHBOARD, open: { count: 0, value: 0, expected: 0 }, by_stage: [] })
    const expected = await screen.findByRole('link', { name: /^Expected revenue/ })
    expect(within(expected).getByText(/of the open pipeline$/)).toHaveTextContent('0% of the open pipeline')
  })

  test('Add deal opens the deal form, and closing it goes back to the dashboard', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    expect(await screen.findByRole('dialog', { name: 'Add deal' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('if the server can’t be reached, the page says so under its header', async () => {
    mockFetch(() => ({ status: 500 }))
    renderWithApp(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add deal' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Open pipeline/ })).not.toBeInTheDocument()
  })
})
