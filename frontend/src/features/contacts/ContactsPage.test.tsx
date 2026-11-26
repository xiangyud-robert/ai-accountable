import type { QueryKey } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { ContactRow, Status } from '../../lib/types'
import { bodyRows, contactRow, mockFetch, organizationRow, renderWithApp } from '../../test-utils'
import { ContactsPage } from './ContactsPage'

/** A contact with only a name and a status. */
const bareContact = (id: number, name: string, status: Status) =>
  contactRow({
    id,
    name,
    status,
    email: null,
    phone: null,
    job_title: null,
    organization_id: null,
    organization_name: null,
    deal_count: 0,
    activity_count: 0,
  })

const PRIYA = contactRow()

const CONTACTS = [
  PRIYA,
  bareContact(11, 'Daniel Okafor', 'customer'),
  bareContact(12, 'Jonas Weber', 'qualified'),
  bareContact(13, 'Tom Becker', 'lead'),
  bareContact(14, 'Olivia Grant', 'lead'),
  bareContact(15, 'Ethan Brooks', 'lead'),
]

function renderPage(route = '/contacts', contacts: ContactRow[] | null = CONTACTS) {
  // Outside the router, as in the app.
  render(<Toaster />)
  const data: [QueryKey, unknown][] = [[['organizations'], [organizationRow()]]]
  if (contacts) data.push([['contacts'], contacts])
  return renderWithApp(<ContactsPage />, { path: '/contacts', route, data })
}

const table = () => screen.getByRole('table', { name: 'Contacts' })
const rows = () => bodyRows('Contacts')
const names = () => rows().map(([name]) => name)

const filter = (name: RegExp) => within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name })

describe('ContactsPage', () => {
  test('the status filter shows each status with its count', () => {
    renderPage()
    expect(filter(/^All/)).toHaveTextContent('All6')
    expect(filter(/^Leads/)).toHaveTextContent('Leads3')
    expect(filter(/^Qualified/)).toHaveTextContent('Qualified1')
    expect(filter(/^Customers/)).toHaveTextContent('Customers2')
    expect(filter(/^All/)).toHaveAttribute('aria-pressed', 'true')
    expect(names()).toHaveLength(6)
  })

  test('the filter reads from ?status=', () => {
    renderPage('/contacts?status=customer')
    expect(filter(/^Customers/)).toHaveAttribute('aria-pressed', 'true')
    expect(names()).toEqual(['Daniel Okafor', 'Priya Raman'])
  })

  test('the filter writes to ?status=', async () => {
    const { router } = renderPage()
    await userEvent.click(filter(/^Leads/))
    expect(router.state.location.search).toBe('?status=lead')
    expect(names()).toEqual(['Ethan Brooks', 'Olivia Grant', 'Tom Becker'])
    await userEvent.click(filter(/^All/))
    expect(router.state.location.search).toBe('')
    expect(names()).toHaveLength(6)
  })

  test('the filter works together with the search', async () => {
    renderPage('/contacts?status=lead')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search contacts' }), 'an')
    expect(await screen.findByText('2 of 3 contacts')).toBeInTheDocument()
    expect(names()).toEqual(['Ethan Brooks', 'Olivia Grant'])
  })

  test('an unknown status shows everyone', () => {
    renderPage('/contacts?status=vip')
    expect(filter(/^All/)).toHaveAttribute('aria-pressed', 'true')
    expect(names()).toHaveLength(6)
  })

  test('lists each contact’s organization, job title, email, phone and status', () => {
    renderPage()
    const row = (name: string) => rows().find(([cell]) => cell === name)
    expect(row('Priya Raman')).toEqual([
      'Priya Raman',
      'Harbor Logistics',
      'Head of Operations',
      'priya@harborlogistics.com',
      '+1 415 555 0142',
      'Customer',
      '',
    ])
    expect(row('Daniel Okafor')).toEqual(['Daniel Okafor', '', '', '', '', 'Customer', ''])
    expect(within(table()).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/10')
    expect(within(table()).getByRole('link', { name: 'Harbor Logistics' })).toHaveAttribute('href', '/organizations/1')
  })

  test('sorting by status goes from lead to customer, rather than by the alphabet', async () => {
    renderPage()
    await userEvent.click(within(table()).getByRole('button', { name: 'Status' }))
    expect(screen.getByRole('columnheader', { name: 'Status' })).toHaveAttribute('aria-sort', 'ascending')
    expect(rows().map((cells) => cells[5])).toEqual(['Lead', 'Lead', 'Lead', 'Qualified', 'Customer', 'Customer'])
  })

  test('Add contact starts at the status being shown, and saves a new contact', async () => {
    const calls = mockFetch(() => ({ status: 201, body: bareContact(16, 'Mei Chen', 'qualified') }))
    renderPage('/contacts?status=qualified')
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }))
    const dialog = screen.getByRole('dialog', { name: 'Add contact' })
    expect(within(dialog).getByLabelText('Status')).toHaveTextContent('Qualified')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Mei Chen')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/contacts',
        body: {
          name: 'Mei Chen',
          email: null,
          phone: null,
          job_title: null,
          organization_id: null,
          status: 'qualified',
        },
      },
    ])
    expect(await screen.findByText('Contact saved')).toBeInTheDocument()
  })

  test('with every status shown, a new contact starts as a lead', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }))
    const dialog = screen.getByRole('dialog', { name: 'Add contact' })
    expect(within(dialog).getByLabelText('Status')).toHaveTextContent('Lead')
  })

  test('Edit opens the form with that contact, and Cancel closes it', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Priya Raman' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit contact' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Priya Raman')
    expect(within(dialog).getByLabelText(/^Email/)).toHaveValue('priya@harborlogistics.com')
    expect(within(dialog).getByLabelText(/^Organization/)).toHaveTextContent('Harbor Logistics')
    expect(within(dialog).getByLabelText('Status')).toHaveTextContent('Customer')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('Delete asks first, saying what’s kept and what’s deleted, and Cancel keeps them', async () => {
    const calls = mockFetch()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Raman' }))
    const question = screen.getByRole('alertdialog', { name: 'Delete Priya Raman?' })
    expect(question).toHaveAccessibleDescription(
      'Their 2 deals will be kept, with no main contact. The 5 activities logged on this contact will be deleted.',
    )
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('confirming deletes the contact and closes the question', async () => {
    const calls = mockFetch(() => ({ status: 204 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Daniel Okafor' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete contact' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls).toEqual([{ method: 'DELETE', path: '/contacts/11', body: undefined }])
    expect(await screen.findByText('Contact deleted')).toBeInTheDocument()
  })

  test('when the delete can’t reach the server, the question stays open and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Priya Raman' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete contact' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Delete Priya Raman?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete contact' })).toBeEnabled()
  })

  test('loads the contacts from the server', async () => {
    const calls = mockFetch(() => ({ body: [PRIYA] }))
    renderPage('/contacts', null)
    expect(await screen.findByRole('link', { name: 'Priya Raman' })).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/contacts', body: undefined }])
  })

  test('when the list can’t load, it says so and Add contact still works', async () => {
    mockFetch(() => ({ status: 500 }))
    renderPage('/contacts', null)
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add contact' }))
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toBeInTheDocument()
  })

  test('with no contacts yet, it offers to add one', async () => {
    renderPage('/contacts', [])
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(filter(/^All/)).toHaveTextContent('All0')
    const [, emptyAdd] = screen.getAllByRole('button', { name: 'Add contact' })
    await userEvent.click(emptyAdd)
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toBeInTheDocument()
  })
})
