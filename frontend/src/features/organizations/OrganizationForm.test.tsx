import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { mockFetch, organizationRow, renderWithApp } from '../../test-utils'
import { OrganizationForm } from './OrganizationForm'

const HARBOR = organizationRow()

const ORGANIZATIONS = [
  HARBOR,
  organizationRow({ id: 2, name: 'Cobalt Bank', website: 'http://cobalt.bank', industry: 'Banking', notes: null }),
  organizationRow({ id: 3, name: 'Northwind Freight', website: null, industry: 'Logistics', notes: null }),
  organizationRow({ id: 4, name: 'Meridian Health', website: null, industry: null, notes: null }),
]

function renderForm(props: Partial<Parameters<typeof OrganizationForm>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  // Outside the router, as in the app.
  render(<Toaster />)
  renderWithApp(<OrganizationForm open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />, {
    data: [[['organizations'], ORGANIZATIONS]],
  })
  return { onOpenChange, onSaved }
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`))
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('OrganizationForm', () => {
  test('a new organization starts empty', () => {
    renderForm()
    expect(screen.getByRole('dialog', { name: 'Add organization' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('')
    expect(field('Website')).toHaveValue('')
    expect(field('Industry')).toHaveValue('')
    expect(field('Notes')).toHaveValue('')
  })

  test('editing starts from the organization’s own values', () => {
    renderForm({ organization: HARBOR })
    expect(screen.getByRole('dialog', { name: 'Edit organization' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('Harbor Logistics')
    expect(field('Website')).toHaveValue('https://harborlogistics.com')
    expect(field('Industry')).toHaveValue('Logistics')
    expect(field('Notes')).toHaveValue('Fleet of 400 trucks.')
  })

  test('Industry suggests each industry already in use, once and in order', () => {
    renderForm()
    const suggestions = (field('Industry') as HTMLInputElement).list!
    const values = within(suggestions)
      .getAllByRole('option', { hidden: true })
      .map((option) => (option as HTMLOptionElement).value)
    expect(values).toEqual(['Banking', 'Logistics'])
  })

  test('a new organization sends every field, trimmed, with empty ones as null', async () => {
    const saved = organizationRow({
      id: 5,
      name: 'Atlas Robotics',
      website: null,
      industry: 'Manufacturing',
      notes: null,
      contact_count: 0,
      deal_count: 0,
      open_deal_count: 0,
      open_value: 0,
    })
    const calls = mockFetch(() => ({ status: 201, body: saved }))
    const { onOpenChange, onSaved } = renderForm()
    await userEvent.type(field('Name'), '  Atlas Robotics  ')
    await userEvent.type(field('Industry'), 'Manufacturing ')
    await userEvent.type(field('Notes'), '   ')
    await save()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/organizations',
        body: { name: 'Atlas Robotics', website: null, industry: 'Manufacturing', notes: null },
      },
    ])
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(await screen.findByText('Organization saved')).toBeInTheDocument()
  })

  test('only changed fields are sent, and a cleared one is sent as null', async () => {
    const calls = mockFetch(() => ({ body: HARBOR }))
    const { onOpenChange } = renderForm({ organization: HARBOR })
    await userEvent.clear(field('Website'))
    await userEvent.type(field('Industry'), ' and shipping')
    await save()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([
      { method: 'PATCH', path: '/organizations/1', body: { website: null, industry: 'Logistics and shipping' } },
    ])
  })

  test('a name of only spaces is caught before sending, and focus moves to it', async () => {
    const calls = mockFetch()
    const { onOpenChange } = renderForm()
    await userEvent.type(field('Name'), '   ')
    await userEvent.type(field('Website'), 'example.com')
    await save()
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(field('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Name')).toHaveAccessibleDescription('Enter a name.')
    expect(field('Name')).toHaveFocus()
    expect(calls).toEqual([])
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('the server’s 422 messages appear under their fields, and any others in a message', async () => {
    mockFetch(() => ({
      status: 422,
      body: { errors: { website: 'Enter a website such as example.com.', other: 'Try again later.' } },
    }))
    const { onOpenChange, onSaved } = renderForm()
    await userEvent.type(field('Name'), 'Atlas Robotics')
    await userEvent.type(field('Website'), 'not a website')
    await save()
    expect(await screen.findByText('Enter a website such as example.com.')).toBeInTheDocument()
    expect(field('Website')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Website')).toHaveAccessibleDescription('Enter a website such as example.com.')
    expect(field('Website')).toHaveFocus()
    expect(await screen.findByText('Try again later.')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('when the server can’t save it, the form stays open and says so', async () => {
    mockFetch(() => ({ status: 500 }))
    const { onOpenChange } = renderForm({ organization: HARBOR })
    await userEvent.type(field('Name'), ' Group')
    await save()
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit organization' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('Harbor Logistics Group')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('Cancel closes it without sending anything', async () => {
    const calls = mockFetch()
    const { onOpenChange } = renderForm({ organization: HARBOR })
    await userEvent.type(field('Name'), ' Group')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(calls).toEqual([])
  })

  test('shows nothing while closed', () => {
    renderForm({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
