import type { QueryKey } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { ContactDetail, TimelineEntry } from '../../lib/types'
import {
  STAGES,
  contactRow,
  dealRow,
  details,
  mockFetch,
  organizationRow,
  panel,
  renderWithApp,
} from '../../test-utils'
import { ContactPage } from './ContactPage'

const DEALS = [
  dealRow(),
  dealRow({ id: 8, name: 'Warehouse sensors', stage: 'won', value: 15_000, close_date: '2026-10-02' }),
]

const CALL: TimelineEntry = {
  key: 'activity-3',
  kind: 'activity',
  id: 3,
  at: '2026-11-21T09:05:00',
  text: 'Called about the renewal',
  record: 'contact',
  type: 'call',
  follow_up_date: null,
  follow_up_done: null,
  follow_up_overdue: null,
  from_value: null,
  to_value: null,
  contact_id: 10,
  contact_name: 'Priya Raman',
  deal_id: null,
  deal_name: null,
}

const PRIYA: ContactDetail = {
  ...contactRow(),
  organization: { id: 1, name: 'Harbor Logistics' },
  deals: DEALS,
  timeline: [CALL],
}

const MEI: ContactDetail = {
  ...contactRow({
    id: 11,
    name: 'Mei Chen',
    email: null,
    phone: null,
    job_title: null,
    organization_id: null,
    organization_name: null,
    status: 'lead',
    deal_count: 0,
    activity_count: 0,
  }),
  organization: null,
  deals: [],
  timeline: [],
}

type PageOptions = { route?: string; contact?: ContactDetail | null; refetchAfterChanges?: boolean }

function renderPage({ route = '/contacts/10', contact = PRIYA, refetchAfterChanges }: PageOptions = {}) {
  const data: [QueryKey, unknown][] = [
    // What the contact and deal forms choose from.
    [['organizations'], [organizationRow()]],
    [['contacts'], [PRIYA, MEI]],
  ]
  if (contact) data.push([['contacts', contact.id], contact])
  // Outside the router, as in the app, so its messages outlast the page.
  render(<Toaster />)
  return renderWithApp(<ContactPage />, { path: '/contacts/:id', route, data, refetchAfterChanges })
}

describe('ContactPage', () => {
  test('shows the contact’s name, status and details', () => {
    renderPage()
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('heading', { level: 1, name: 'Priya Raman' })).toBeInTheDocument()
    expect(header).toHaveTextContent('Customer')
    expect(details()).toEqual({
      'Job title': 'Head of Operations',
      Organization: 'Harbor Logistics',
      Email: 'priya@harborlogistics.com',
      Phone: '+1 415 555 0142',
    })
    const detailsPanel = panel('Details')
    expect(within(detailsPanel).getByRole('link', { name: 'Harbor Logistics' })).toHaveAttribute(
      'href',
      '/organizations/1',
    )
    expect(within(detailsPanel).getByRole('link', { name: 'priya@harborlogistics.com' })).toHaveAttribute(
      'href',
      'mailto:priya@harborlogistics.com',
    )
  })

  test('lists the deals where they’re the main contact, and their timeline', () => {
    renderPage()
    const deals = panel('Deals')
    expect(within(deals).getByRole('link', { name: 'Harbor Logistics fleet analytics' })).toHaveAttribute(
      'href',
      '/deals/7',
    )
    expect(within(deals).getByRole('link', { name: 'Warehouse sensors' })).toHaveAttribute('href', '/deals/8')
    const timeline = within(panel('Timeline')).getByRole('list', { name: 'Timeline' })
    expect(timeline).toHaveTextContent('Called about the renewal')
  })

  test('empty details show a dash, and empty lists say so', () => {
    renderPage({ route: '/contacts/11', contact: MEI })
    expect(screen.getByRole('banner')).toHaveTextContent('Lead')
    expect(details()).toEqual({ 'Job title': '-', Organization: '-', Email: '-', Phone: '-' })
    expect(within(panel('Details')).queryByRole('link')).not.toBeInTheDocument()
    expect(within(panel('Deals')).getByText('No deals yet.')).toBeInTheDocument()
    expect(within(panel('Timeline')).getByText('Nothing has happened here yet.')).toBeInTheDocument()
  })

  test('loads the contact named in the address', async () => {
    const calls = mockFetch(() => ({ body: PRIYA }))
    renderPage({ contact: null })
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Raman' })).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/contacts/10', body: undefined }])
  })

  test('a contact who no longer exists says so, with a link back to the list', async () => {
    mockFetch(() => ({ status: 404, body: { detail: 'Not found' } }))
    renderPage({ route: '/contacts/99', contact: null })
    expect(await screen.findByRole('heading', { level: 1, name: 'This contact no longer exists' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to contacts' })).toHaveAttribute('href', '/contacts')
  })

  test('an address with no number in it is not found, without asking the server', () => {
    const calls = mockFetch()
    renderPage({ route: '/contacts/priya', contact: null })
    expect(screen.getByRole('heading', { level: 1, name: 'This contact no longer exists' })).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('when the server can’t be reached, that’s the page’s heading', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage({ contact: null })
    expect(await screen.findByRole('heading', { level: 1, name: UNREACHABLE_MESSAGE })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('Edit opens the form with the contact, and sends what changed', async () => {
    const calls = mockFetch(() => ({ body: PRIYA }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit contact' })
    const jobTitle = within(dialog).getByLabelText(/^Job title/)
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Priya Raman')
    expect(jobTitle).toHaveValue('Head of Operations')
    await userEvent.clear(jobTitle)
    await userEvent.type(jobTitle, 'VP Operations')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'PATCH', path: '/contacts/10', body: { job_title: 'VP Operations' } }])
  })

  test('Add deal fills in the contact and their organization', async () => {
    const calls = mockFetch(() => ({ status: 201, body: DEALS[0] }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    const dialog = screen.getByRole('dialog', { name: 'Add deal' })
    expect(within(dialog).getByLabelText(/^Main contact/)).toHaveTextContent('Priya Raman')
    expect(within(dialog).getByLabelText(/^Organization/)).toHaveTextContent('Harbor Logistics')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Route planning')
    await userEvent.type(within(dialog).getByLabelText('Value (USD)'), '20000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/deals',
      body: { name: 'Route planning', contact_id: 10, organization_id: 1, value: 20000 },
    })
  })

  test('an activity logged from the timeline is logged on this contact', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderPage()
    const form = screen.getByRole('form', { name: 'Log activity' })
    await userEvent.type(within(form).getByLabelText('Description'), 'Sent the renewal quote')
    await userEvent.click(within(form).getByRole('button', { name: 'Log activity' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/activities',
      body: { contact_id: 10, description: 'Sent the renewal quote' },
    })
    expect(calls[0].body).not.toHaveProperty('deal_id')
  })

  test('Delete asks first, saying what’s kept and what’s deleted, and Cancel keeps them', async () => {
    const calls = mockFetch()
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Priya Raman?' })
    expect(question).toHaveAccessibleDescription(
      'Their 2 deals will be kept, with no main contact. The 5 activities logged on this contact will be deleted.',
    )
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
    expect(router.state.location.pathname).toBe('/contacts/10')
  })

  test('confirming deletes them and goes back to the list, without asking for them again', async () => {
    const calls = mockFetch((method) => (method === 'DELETE' ? { status: 204 } : { body: STAGES }))
    const { router } = renderPage({ refetchAfterChanges: true })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete contact' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/contacts'))
    expect(await screen.findByText('Contact deleted')).toBeInTheDocument()
    expect(calls).toContainEqual({ method: 'DELETE', path: '/contacts/10', body: undefined })
    expect(calls).not.toContainEqual({ method: 'GET', path: '/contacts/10', body: undefined })
  })

  test('when the delete can’t reach the server, it stays on the page and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete contact' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/contacts/10')
    expect(screen.getByRole('alertdialog', { name: 'Delete Priya Raman?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete contact' })).toBeEnabled()
  })
})
