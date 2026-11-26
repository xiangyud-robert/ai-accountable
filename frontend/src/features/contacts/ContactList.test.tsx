import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { contactRow, renderWithApp } from '../../test-utils'
import { ContactList } from './ContactList'

const CONTACTS = [
  contactRow(),
  contactRow({ id: 11, name: 'Daniel Okafor', email: null, phone: null, job_title: null, status: 'lead' }),
]

describe('ContactList', () => {
  test('each contact links to their page, with their job title if they have one, and their status', () => {
    renderWithApp(<ContactList contacts={CONTACTS} empty="No contacts yet." />)
    const [priya, daniel] = screen.getAllByRole('listitem')
    expect(within(priya).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/10')
    expect(within(priya).getByText('Head of Operations')).toBeInTheDocument()
    expect(within(priya).getByText('Customer')).toBeInTheDocument()
    expect(within(daniel).getByRole('link', { name: 'Daniel Okafor' })).toHaveAttribute('href', '/contacts/11')
    expect(daniel).toHaveTextContent(/^Daniel OkaforLead$/)
    expect(screen.queryByText('No contacts yet.')).not.toBeInTheDocument()
  })

  test('with no contacts, it says so instead', () => {
    renderWithApp(<ContactList contacts={[]} empty="No contacts yet." />)
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
