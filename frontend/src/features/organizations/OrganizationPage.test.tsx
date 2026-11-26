import type { QueryKey } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { OrganizationDetail } from '../../lib/types'
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
import { OrganizationPage } from './OrganizationPage'

const CONTACTS = [
  contactRow(),
  contactRow({ id: 11, name: 'Daniel Okafor', email: null, phone: null, job_title: null, status: 'lead' }),
]

const DEALS = [
  dealRow(),
  dealRow({ id: 8, name: 'Warehouse sensors', stage: 'won', value: 15_000, close_date: '2026-10-02' }),
]

const HARBOR: OrganizationDetail = {
  ...organizationRow({ notes: 'Fleet of 400 trucks.\nGate code 4411.' }),
  won_value: 15_000,
  contacts: CONTACTS,
  deals: DEALS,
}

const EMPTY: OrganizationDetail = {
  ...organizationRow({
    id: 2,
    name: 'Meridian Health',
    website: null,
    industry: null,
    notes: null,
    contact_count: 0,
    deal_count: 0,
    open_deal_count: 0,
    open_value: 0,
  }),
  won_value: 0,
  contacts: [],
  deals: [],
}

type PageOptions = { route?: string; organization?: OrganizationDetail | null; refetchAfterChanges?: boolean }

function renderPage({ route = '/organizations/1', organization = HARBOR, refetchAfterChanges }: PageOptions = {}) {
  const data: [QueryKey, unknown][] = [
    // What the contact and deal forms choose from.
    [['organizations'], [HARBOR, EMPTY]],
    [['contacts'], CONTACTS],
  ]
  if (organization) data.push([['organizations', organization.id], organization])
  // Outside the router, as in the app, so its messages outlast the page.
  render(<Toaster />)
  return renderWithApp(<OrganizationPage />, { path: '/organizations/:id', route, data, refetchAfterChanges })
}

describe('OrganizationPage', () => {
  test('shows the organization’s details', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Harbor Logistics' })).toBeInTheDocument()
    expect(details()).toEqual({
      Industry: 'Logistics',
      Website: 'harborlogistics.com',
      Notes: 'Fleet of 400 trucks.\nGate code 4411.',
    })
    const website = within(panel('Details')).getByRole('link', { name: 'harborlogistics.com' })
    expect(website).toHaveAttribute('href', 'https://harborlogistics.com')
    expect(website).toHaveAttribute('target', '_blank')
  })

  test('lists its contacts and deals, with what its deals are worth', () => {
    renderPage()
    const contacts = panel('Contacts')
    expect(contacts).toHaveTextContent('2 contacts')
    expect(within(contacts).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/10')
    expect(within(contacts).getByRole('link', { name: 'Daniel Okafor' })).toHaveAttribute('href', '/contacts/11')
    const deals = panel('Deals')
    expect(deals).toHaveTextContent('$72,000 open, $15,000 won')
    expect(within(deals).getByRole('link', { name: 'Harbor Logistics fleet analytics' })).toHaveAttribute(
      'href',
      '/deals/7',
    )
    expect(within(deals).getByRole('link', { name: 'Warehouse sensors' })).toHaveAttribute('href', '/deals/8')
  })

  test('empty details show a dash, and empty lists say so', () => {
    renderPage({ route: '/organizations/2', organization: EMPTY })
    expect(details()).toEqual({ Industry: '-', Website: '-', Notes: '-' })
    expect(panel('Contacts')).toHaveTextContent('0 contacts')
    expect(within(panel('Contacts')).getByText('No contacts yet.')).toBeInTheDocument()
    expect(panel('Deals')).toHaveTextContent('$0 open, $0 won')
    expect(within(panel('Deals')).getByText('No deals yet.')).toBeInTheDocument()
  })

  test('loads the organization named in the address', async () => {
    const calls = mockFetch(() => ({ body: HARBOR }))
    renderPage({ organization: null })
    expect(await screen.findByRole('heading', { level: 1, name: 'Harbor Logistics' })).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/organizations/1', body: undefined }])
  })

  test('an organization that no longer exists says so, with a link back to the list', async () => {
    mockFetch(() => ({ status: 404, body: { detail: 'Not found' } }))
    renderPage({ route: '/organizations/99', organization: null })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This organization no longer exists' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to organizations' })).toHaveAttribute('href', '/organizations')
  })

  test('an address with no number in it is not found, without asking the server', () => {
    const calls = mockFetch()
    renderPage({ route: '/organizations/harbor', organization: null })
    expect(screen.getByRole('heading', { level: 1, name: 'This organization no longer exists' })).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('when the server can’t be reached, that’s the page’s heading', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage({ organization: null })
    expect(await screen.findByRole('heading', { level: 1, name: UNREACHABLE_MESSAGE })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('Edit opens the form with the organization, and sends what changed', async () => {
    const calls = mockFetch(() => ({ body: HARBOR }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit organization' })
    const name = within(dialog).getByLabelText('Name')
    expect(name).toHaveValue('Harbor Logistics')
    await userEvent.type(name, ' Group')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'PATCH', path: '/organizations/1', body: { name: 'Harbor Logistics Group' } }])
  })

  test('Add contact adds one at this organization', async () => {
    const calls = mockFetch(() => ({ status: 201, body: CONTACTS[0] }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }))
    const dialog = screen.getByRole('dialog', { name: 'Add contact' })
    expect(within(dialog).getByLabelText(/^Organization/)).toHaveTextContent('Harbor Logistics')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Mei Chen')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/contacts',
      body: { name: 'Mei Chen', organization_id: 1 },
    })
  })

  test('Add deal adds one at this organization', async () => {
    const calls = mockFetch(() => ({ status: 201, body: DEALS[0] }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add deal' }))
    const dialog = screen.getByRole('dialog', { name: 'Add deal' })
    expect(within(dialog).getByLabelText(/^Organization/)).toHaveTextContent('Harbor Logistics')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Warehouse sensors')
    await userEvent.type(within(dialog).getByLabelText('Value (USD)'), '15000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/deals',
      body: { name: 'Warehouse sensors', organization_id: 1, value: 15000 },
    })
  })

  test('Delete asks first, saying what’s kept, and Cancel keeps it', async () => {
    const calls = mockFetch()
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })
    expect(question).toHaveAccessibleDescription('Its 2 contacts and 2 deals will be kept, with no organization.')
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
    expect(router.state.location.pathname).toBe('/organizations/1')
  })

  test('confirming deletes it and goes back to the list, without asking for it again', async () => {
    const calls = mockFetch((method) => (method === 'DELETE' ? { status: 204 } : { body: STAGES }))
    const { router } = renderPage({ refetchAfterChanges: true })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete organization' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/organizations'))
    expect(await screen.findByText('Organization deleted')).toBeInTheDocument()
    expect(calls).toContainEqual({ method: 'DELETE', path: '/organizations/1', body: undefined })
    expect(calls).not.toContainEqual({ method: 'GET', path: '/organizations/1', body: undefined })
  })

  test('when the delete can’t reach the server, it stays on the page and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    const { router } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete organization' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/organizations/1')
    expect(screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete organization' })).toBeEnabled()
  })
})
