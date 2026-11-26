import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { contactRow, mockFetch, organizationRow, renderWithApp } from '../../test-utils'
import { ContactForm } from './ContactForm'

const PRIYA = contactRow()

/** A new lead with only a name. */
const MEI = contactRow({
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
})

const ORGANIZATIONS = [
  organizationRow(),
  organizationRow({ id: 2, name: 'Cobalt Bank', website: 'http://cobalt.bank', industry: 'Banking', notes: null }),
]

function renderForm(props: Partial<Parameters<typeof ContactForm>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  // Outside the router, as in the app.
  render(<Toaster />)
  renderWithApp(<ContactForm open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />, {
    data: [[['organizations'], ORGANIZATIONS]],
  })
  return { onOpenChange, onSaved }
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`))
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }))

async function pick(label: string, option: string) {
  await userEvent.click(field(label))
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(`^${option}`) }))
}

describe('ContactForm', () => {
  test('a new contact starts empty, as a lead with no organization', () => {
    renderForm()
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('')
    expect(field('Email')).toHaveValue('')
    expect(field('Phone')).toHaveValue('')
    expect(field('Job title')).toHaveValue('')
    expect(field('Organization')).toHaveTextContent('Choose an organization')
    expect(field('Status')).toHaveTextContent('Lead')
  })

  test('a new contact can start at a given organization and status', () => {
    renderForm({ defaults: { organization_id: 2, status: 'qualified' } })
    expect(field('Organization')).toHaveTextContent('Cobalt Bank')
    expect(field('Status')).toHaveTextContent('Qualified')
  })

  test('editing starts from the contact’s own values', () => {
    renderForm({ contact: PRIYA })
    expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('Priya Raman')
    expect(field('Email')).toHaveValue('priya@harborlogistics.com')
    expect(field('Phone')).toHaveValue('+1 415 555 0142')
    expect(field('Job title')).toHaveValue('Head of Operations')
    expect(field('Organization')).toHaveTextContent('Harbor Logistics')
    expect(field('Status')).toHaveTextContent('Customer')
  })

  test('a new contact sends every field, trimmed, with empty ones as null', async () => {
    const saved = contactRow({
      ...MEI,
      email: 'mei@cobalt.bank',
      organization_id: 2,
      organization_name: 'Cobalt Bank',
      status: 'qualified',
    })
    const calls = mockFetch(() => ({ status: 201, body: saved }))
    const { onOpenChange, onSaved } = renderForm()
    await userEvent.type(field('Name'), '  Mei Chen  ')
    await userEvent.type(field('Email'), 'mei@cobalt.bank')
    await userEvent.type(field('Job title'), '   ')
    await pick('Organization', 'Cobalt Bank')
    await pick('Status', 'Qualified')
    await save()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/contacts',
        body: {
          name: 'Mei Chen',
          email: 'mei@cobalt.bank',
          phone: null,
          job_title: null,
          organization_id: 2,
          status: 'qualified',
        },
      },
    ])
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(await screen.findByText('Contact saved')).toBeInTheDocument()
  })

  test('only changed fields are sent, and a cleared one is sent as null', async () => {
    const calls = mockFetch(() => ({ body: PRIYA }))
    const { onOpenChange } = renderForm({ contact: PRIYA })
    await userEvent.clear(field('Phone'))
    await userEvent.type(field('Job title'), ' ')
    await pick('Organization', 'No organization')
    await pick('Status', 'Qualified')
    await save()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([
      { method: 'PATCH', path: '/contacts/10', body: { phone: null, organization_id: null, status: 'qualified' } },
    ])
  })

  test('editing a contact with empty fields shows them empty, and sends only what was filled in', async () => {
    const calls = mockFetch(() => ({ body: MEI }))
    const { onOpenChange } = renderForm({ contact: MEI })
    expect(field('Email')).toHaveValue('')
    expect(field('Phone')).toHaveValue('')
    expect(field('Job title')).toHaveValue('')
    expect(field('Organization')).toHaveTextContent('Choose an organization')
    await userEvent.type(field('Phone'), '+1 212 555 0199')
    await save()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([{ method: 'PATCH', path: '/contacts/11', body: { phone: '+1 212 555 0199' } }])
  })

  test('a name of only spaces is caught before sending, and focus moves to it', async () => {
    const calls = mockFetch()
    const { onOpenChange } = renderForm()
    await userEvent.type(field('Name'), '   ')
    await userEvent.type(field('Email'), 'mei@cobalt.bank')
    await save()
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(field('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Name')).toHaveAccessibleDescription('Enter a name.')
    expect(field('Name')).toHaveFocus()
    expect(calls).toEqual([])
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('the server’s 422 messages appear under their fields, and focus moves to the first in the form', async () => {
    mockFetch(() => ({
      status: 422,
      body: {
        errors: {
          organization_id: 'That organization no longer exists.',
          email: 'Enter an email address like name@example.com.',
        },
      },
    }))
    const { onOpenChange, onSaved } = renderForm({ defaults: { organization_id: 2 } })
    await userEvent.type(field('Name'), 'Mei Chen')
    await userEvent.type(field('Email'), 'mei at cobalt')
    await save()
    expect(await screen.findByText('Enter an email address like name@example.com.')).toBeInTheDocument()
    expect(field('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Email')).toHaveAccessibleDescription('Enter an email address like name@example.com.')
    expect(field('Email')).toHaveFocus()
    expect(field('Organization')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Organization')).toHaveAccessibleDescription('That organization no longer exists.')
    expect(field('Name')).not.toHaveAttribute('aria-invalid')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('when the server can’t save it, the form stays open and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    const { onOpenChange } = renderForm({ contact: PRIYA })
    await userEvent.type(field('Job title'), ' and Logistics')
    await save()
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument()
    expect(field('Job title')).toHaveValue('Head of Operations and Logistics')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('Cancel closes it without sending anything', async () => {
    const calls = mockFetch()
    const { onOpenChange } = renderForm({ contact: PRIYA })
    await userEvent.type(field('Name'), ' Iyer')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(calls).toEqual([])
  })

  test('shows nothing while closed', () => {
    renderForm({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
