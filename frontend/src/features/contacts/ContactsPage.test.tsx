import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { ContactRow, Status } from '../../lib/types'
import { renderWithApp } from '../../test-utils'
import { ContactsPage } from './ContactsPage'

const contact = (id: number, name: string, status: Status) =>
  ({ id, name, status, email: null, phone: null, job_title: null, organization_id: null, organization_name: null, deal_count: 0, activity_count: 0 }) as ContactRow

const CONTACTS = [
  contact(1, 'Priya Raman', 'customer'),
  contact(2, 'Daniel Okafor', 'customer'),
  contact(3, 'Jonas Weber', 'qualified'),
  contact(4, 'Tom Becker', 'lead'),
  contact(5, 'Olivia Grant', 'lead'),
  contact(6, 'Ethan Brooks', 'lead'),
]

function renderPage(route = '/contacts') {
  return renderWithApp(<ContactsPage />, { path: '/contacts', route, data: [[['contacts'], CONTACTS], [['organizations'], []]] })
}

const names = () =>
  within(screen.getByRole('table', { name: 'Contacts' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

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
})
