import type { QueryKey } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { DealDetail, TimelineEntry } from '../../lib/types'
import { STAGES, dealRow, details, mockFetch, panel, person, renderWithApp } from '../../test-utils'
import { DealPage } from './DealPage'

const entry = {
  record: 'deal',
  type: null,
  follow_up_date: null,
  follow_up_done: null,
  follow_up_overdue: null,
  from_value: null,
  to_value: null,
  contact_id: null,
  contact_name: null,
  deal_id: 7,
  deal_name: 'Harbor Logistics fleet analytics',
  created_by: null,
} as const

const TIMELINE: TimelineEntry[] = [
  {
    ...entry,
    key: 'activity-3',
    kind: 'activity',
    id: 3,
    at: '2026-11-20T10:15:00',
    text: 'Sent the revised proposal',
    type: 'email',
    created_by: person('Joel Abara'),
  },
  {
    ...entry,
    key: 'stage-2',
    kind: 'stage_change',
    id: 2,
    at: '2026-11-12T09:00:00',
    text: 'Moved from Qualified to Proposal',
    from_value: 'qualified',
    to_value: 'proposal',
  },
]

// At a probability of its own, not its stage's usual one.
const HARBOR: DealDetail = { ...dealRow({ probability: 65 }), timeline: TIMELINE }

type PageOptions = { route?: string; deal?: DealDetail | null; refetchAfterChanges?: boolean }

function renderPage({ route = '/deals/7', deal = HARBOR, refetchAfterChanges }: PageOptions = {}) {
  const data: [QueryKey, unknown][] = [
    // What the deal form chooses from.
    [['organizations'], []],
    [['contacts'], []],
  ]
  if (deal) data.push([['deals', deal.id], deal])
  // Outside the router, as in the app, so its messages outlast the page.
  render(<Toaster />)
  return renderWithApp(<DealPage />, { path: '/deals/:id', route, data, refetchAfterChanges })
}

describe('DealPage', () => {
  test('shows the deal’s name, stage and details, with its organization and main contact as links', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeInTheDocument()
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Proposal')).toBeInTheDocument()
    expect(within(header).queryByText('Late')).not.toBeInTheDocument()
    expect(details()).toEqual({
      'Value (USD)': '$72,000',
      Probability: '65%',
      'Expected revenue (USD)': '$46,800',
      'Expected close': 'Dec 11, 2026',
      Organization: 'Harbor Logistics',
      'Main contact': 'Priya Raman',
    })
    expect(within(panel('Details')).getByRole('link', { name: 'Harbor Logistics' })).toHaveAttribute(
      'href',
      '/organizations/1',
    )
    expect(within(panel('Details')).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/10')
  })

  test('the details end with who added the deal and who last changed it', () => {
    renderPage()
    expect(panel('Details').textContent).toMatch(
      /Added by Dana Holt on Oct 5, 2026Last changed by Joel Abara on Nov 20, 2026$/,
    )
  })

  test('a late deal has the Late badge', () => {
    renderPage({ deal: { ...HARBOR, close_date: '2026-11-01', late: true } })
    expect(within(screen.getByRole('banner')).getByText('Late')).toBeInTheDocument()
  })

  test('a won deal shows when it closed, with no expected revenue', () => {
    renderPage({ deal: { ...HARBOR, stage: 'won', probability: 100, expected: 72000, close_date: '2026-11-18' } })
    expect(within(screen.getByRole('banner')).getByText('Won')).toBeInTheDocument()
    expect(details()).toMatchObject({
      Probability: '100%',
      'Expected revenue (USD)': '-',
      Closed: 'Nov 18, 2026',
    })
    expect(details()).not.toHaveProperty('Expected close')
  })

  test('with no organization or main contact, those show a dash', () => {
    renderPage({
      deal: { ...HARBOR, organization_id: null, organization_name: null, contact_id: null, contact_name: null },
    })
    expect(details()).toMatchObject({ Organization: '-', 'Main contact': '-' })
    expect(within(panel('Details')).queryByRole('link')).not.toBeInTheDocument()
  })

  test('its timeline shows its activities and stage changes', () => {
    renderPage()
    const timeline = within(panel('Timeline')).getByRole('list', { name: 'Timeline' })
    const entries = within(timeline).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('Sent the revised proposal')
    expect(entries[1]).toHaveTextContent('Moved from Qualified to Proposal')
  })

  test('an activity logged from its timeline is logged on this deal', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderPage()
    const form = screen.getByRole('form', { name: 'Log activity' })
    await userEvent.type(within(form).getByLabelText('Description'), 'Called about the pilot')
    await userEvent.click(within(form).getByRole('button', { name: 'Log activity' }))
    expect(await screen.findByText('Activity logged')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/activities',
      body: { deal_id: 7, type: 'note', description: 'Called about the pilot' },
    })
    expect(calls[0].body).not.toHaveProperty('contact_id')
  })

  test('loads the deal named in the address', async () => {
    const calls = mockFetch(() => ({ body: HARBOR }))
    renderPage({ deal: null })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' }),
    ).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/deals/7', body: undefined }])
  })

  test('a deal that no longer exists says so, with a link back to the list', async () => {
    mockFetch(() => ({ status: 404, body: { detail: 'Not found' } }))
    renderPage({ route: '/deals/99', deal: null })
    expect(await screen.findByRole('heading', { level: 1, name: 'This deal no longer exists' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to deals' })).toHaveAttribute('href', '/deals')
  })

  test('an address with no number in it is not found, without asking the server', () => {
    const calls = mockFetch()
    renderPage({ route: '/deals/harbor', deal: null })
    expect(screen.getByRole('heading', { level: 1, name: 'This deal no longer exists' })).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('when the server can’t be reached, that’s the page’s heading', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage({ deal: null })
    expect(await screen.findByRole('heading', { level: 1, name: UNREACHABLE_MESSAGE })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('Edit opens the form with the deal, and sends what changed', async () => {
    const calls = mockFetch(() => ({ body: HARBOR }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit deal' })
    const value = within(dialog).getByLabelText('Value (USD)')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Harbor Logistics fleet analytics')
    expect(value).toHaveValue('72000')
    await userEvent.clear(value)
    await userEvent.type(value, '80000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'PATCH', path: '/deals/7', body: { value: 80000 } }])
    expect(await screen.findByText('Deal saved')).toBeInTheDocument()
  })

  test('Delete asks first, saying what goes with it, and Cancel keeps it', async () => {
    const calls = mockFetch()
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics fleet analytics?' })
    expect(question).toHaveAccessibleDescription(
      'The 4 activities logged on this deal and its stage history will be deleted.',
    )
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
    expect(router.state.location.pathname).toBe('/deals/7')
  })

  test('confirming deletes it and goes back to the list, without asking for it again', async () => {
    const calls = mockFetch((method, path) =>
      method === 'DELETE' ? { status: 204 } : { body: path === '/stages' ? STAGES : [] },
    )
    // As in the app, so the delete refetches every query still in use.
    const { router } = renderPage({ refetchAfterChanges: true })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete deal' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/deals'))
    expect(await screen.findByText('Deal deleted')).toBeInTheDocument()
    expect(calls).toContainEqual({ method: 'DELETE', path: '/deals/7', body: undefined })
    // The stages were refetched, so the rule ran, and it didn't ask for the deal.
    expect(calls).toContainEqual({ method: 'GET', path: '/stages', body: undefined })
    expect(calls).not.toContainEqual({ method: 'GET', path: '/deals/7', body: undefined })
  })

  test('when the delete can’t reach the server, it stays on the page and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete deal' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/deals/7')
    expect(screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics fleet analytics?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete deal' })).toBeEnabled()
  })
})
