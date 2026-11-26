import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { OrganizationRow } from '../../lib/types'
import { bodyRows, mockFetch, organizationRow, renderWithApp } from '../../test-utils'
import { OrganizationsPage } from './OrganizationsPage'

/** An organization with only a name, before any contacts or deals are added to it. */
const bareOrganization = (id: number, name: string) =>
  organizationRow({
    id,
    name,
    website: null,
    industry: null,
    notes: null,
    contact_count: 0,
    deal_count: 0,
    open_deal_count: 0,
    open_value: 0,
  })

const HARBOR = organizationRow()
const ORGANIZATIONS = [
  HARBOR,
  organizationRow({
    id: 2,
    name: 'Cobalt Bank',
    website: 'http://cobalt.bank',
    industry: 'Banking',
    notes: null,
    contact_count: 1,
    deal_count: 3,
    open_deal_count: 2,
    open_value: 125_000,
  }),
  bareOrganization(3, 'Meridian Health'),
]

function renderPage(organizations: OrganizationRow[] | null = ORGANIZATIONS) {
  // Outside the router, as in the app.
  render(<Toaster />)
  return renderWithApp(<OrganizationsPage />, { data: organizations ? [[['organizations'], organizations]] : [] })
}

const table = () => screen.getByRole('table', { name: 'Organizations' })
const names = () => bodyRows('Organizations').map(([name]) => name)

describe('OrganizationsPage', () => {
  test('lists the organizations by name, with their figures', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Organizations' })).toBeInTheDocument()
    expect(screen.getByText('3 organizations')).toBeInTheDocument()
    expect(bodyRows('Organizations')).toEqual([
      ['Cobalt Bank', 'Banking', 'cobalt.bank', '1', '2', '$125,000', ''],
      ['Harbor Logistics', 'Logistics', 'harborlogistics.com', '2', '1', '$72,000', ''],
      ['Meridian Health', '', '', '0', '0', '$0', ''],
    ])
  })

  test('each name links to its organization’s page', () => {
    renderPage()
    expect(within(table()).getByRole('link', { name: 'Harbor Logistics' })).toHaveAttribute('href', '/organizations/1')
  })

  test('sorting by open value goes by the amount', async () => {
    renderPage()
    await userEvent.click(within(table()).getByRole('button', { name: 'Open value (USD)' }))
    expect(screen.getByRole('columnheader', { name: 'Open value (USD)' })).toHaveAttribute('aria-sort', 'ascending')
    expect(names()).toEqual(['Meridian Health', 'Harbor Logistics', 'Cobalt Bank'])
  })

  test('the search matches the website and open value as they’re shown', async () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Search organizations' })
    await userEvent.type(search, '$72,000')
    expect(await screen.findByText('1 of 3 organizations')).toBeInTheDocument()
    expect(names()).toEqual(['Harbor Logistics'])
    await userEvent.clear(search)
    await userEvent.type(search, 'https')
    expect(await screen.findByText('No organizations match "https".')).toBeInTheDocument()
  })

  test('with no organizations yet, it offers to add one', async () => {
    renderPage([])
    expect(screen.getByText('No organizations yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const [, emptyAdd] = screen.getAllByRole('button', { name: 'Add organization' })
    await userEvent.click(emptyAdd)
    expect(screen.getByRole('dialog', { name: 'Add organization' })).toBeInTheDocument()
  })

  test('Add organization opens an empty form, which saves a new organization', async () => {
    const calls = mockFetch(() => ({ status: 201, body: bareOrganization(4, 'Atlas Robotics') }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add organization' }))
    const dialog = screen.getByRole('dialog', { name: 'Add organization' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Atlas Robotics')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/organizations',
        body: { name: 'Atlas Robotics', website: null, industry: null, notes: null },
      },
    ])
    expect(await screen.findByText('Organization saved')).toBeInTheDocument()
  })

  test('Edit opens the form with that organization, and Cancel closes it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Harbor Logistics' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit organization' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Harbor Logistics')
    expect(within(dialog).getByLabelText(/^Website/)).toHaveValue('https://harborlogistics.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('Delete asks first, saying what’s kept', async () => {
    const calls = mockFetch()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Harbor Logistics' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })
    expect(question).toHaveAccessibleDescription('Its 2 contacts and 2 deals will be kept, with no organization.')
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('confirming deletes the organization and closes the question', async () => {
    const calls = mockFetch(() => ({ status: 204 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Cobalt Bank' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete organization' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'DELETE', path: '/organizations/2', body: undefined }])
    expect(await screen.findByText('Organization deleted')).toBeInTheDocument()
  })

  test('when the delete can’t reach the server, the question stays open and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Harbor Logistics' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete organization' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete organization' })).toBeEnabled()
  })

  test('loads the organizations from the server', async () => {
    const calls = mockFetch(() => ({ body: [HARBOR] }))
    renderPage(null)
    expect(await screen.findByRole('link', { name: 'Harbor Logistics' })).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/organizations', body: undefined }])
  })

  test('when the list can’t load, it says so and Add organization still works', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage(null)
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add organization' }))
    expect(screen.getByRole('dialog', { name: 'Add organization' })).toBeInTheDocument()
  })
})
