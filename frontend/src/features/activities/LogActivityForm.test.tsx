import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { holdFetch, mockFetch, renderWithApp } from '../../test-utils'
import { LogActivityForm } from './LogActivityForm'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 10, 0))
})
afterEach(() => vi.useRealTimers())

function renderForm(on: Parameters<typeof LogActivityForm>[0]['on'] = { deal_id: 9 }) {
  render(<Toaster />)
  renderWithApp(<LogActivityForm on={on} />)
}

async function logNote(description: string) {
  await userEvent.type(screen.getByLabelText('Description'), description)
  await userEvent.click(screen.getByRole('button', { name: 'Log activity' }))
}

describe('LogActivityForm', () => {
  test('left as it is, When is the time the activity is logged, not when the form appeared', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderWithApp(<LogActivityForm on={{ deal_id: 9 }} />)
    expect(screen.getByLabelText('When')).toHaveValue('2026-11-22T10:00')
    vi.setSystemTime(new Date(2026, 10, 22, 10, 30))
    await logNote('Called about the renewal')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ deal_id: 9, occurred_at: '2026-11-22T10:30:00' })
  })

  test('a time typed into When is the one sent', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderWithApp(<LogActivityForm on={{ contact_id: 3 }} />)
    const when = screen.getByLabelText('When')
    await userEvent.clear(when)
    await userEvent.type(when, '2026-11-21T09:05')
    vi.setSystemTime(new Date(2026, 10, 22, 10, 30))
    await logNote('Met at the conference')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ contact_id: 3, occurred_at: '2026-11-21T09:05:00' })
  })

  test('a new activity is a note with no follow-up, unless changed', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderForm({ contact_id: 3 })
    expect(screen.getByLabelText('Type')).toHaveTextContent('Note')
    await logNote('  Met at the conference  ')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/activities',
      body: {
        contact_id: 3,
        type: 'note',
        description: 'Met at the conference',
        occurred_at: '2026-11-22T10:00:00',
        follow_up_date: null,
      },
    })
  })

  test('sends the type and follow-up date chosen', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderForm()
    await userEvent.click(screen.getByLabelText('Type'))
    await userEvent.click(await screen.findByRole('option', { name: 'Call' }))
    await userEvent.type(screen.getByLabelText(/^Follow-up date/), '2026-11-29')
    await logNote('Called about the renewal')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ deal_id: 9, type: 'call', follow_up_date: '2026-11-29' })
  })

  test('once logged, it says so and the form starts again from now', async () => {
    mockFetch(() => ({ status: 201, body: {} }))
    renderForm()
    await userEvent.click(screen.getByLabelText('Type'))
    await userEvent.click(await screen.findByRole('option', { name: 'Email' }))
    await userEvent.type(screen.getByLabelText(/^Follow-up date/), '2026-11-29')
    vi.setSystemTime(new Date(2026, 10, 22, 10, 30))
    await logNote('Sent the pricing')
    expect(await screen.findByText('Activity logged')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Description')).toHaveValue(''))
    expect(screen.getByLabelText('Type')).toHaveTextContent('Note')
    expect(screen.getByLabelText(/^Follow-up date/)).toHaveValue('')
    expect(screen.getByLabelText('When')).toHaveValue('2026-11-22T10:30')
  })

  test('an empty description is caught before sending, and focus moves to it', async () => {
    const calls = mockFetch()
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Log activity' }))
    const description = screen.getByLabelText('Description')
    expect(await screen.findByText('Enter a description.')).toBeInTheDocument()
    expect(description).toHaveAccessibleDescription('Enter a description.')
    expect(description).toHaveFocus()
    expect(calls).toEqual([])
  })

  test('an empty When is caught before sending', async () => {
    const calls = mockFetch()
    renderForm()
    await userEvent.clear(screen.getByLabelText('When'))
    await logNote('Called about the renewal')
    expect(await screen.findByText('Enter the date and time it happened.')).toBeInTheDocument()
    expect(screen.getByLabelText('When')).toHaveAttribute('aria-invalid', 'true')
    expect(calls).toEqual([])
  })

  test('the server’s 422 messages appear under their fields, keeping what was typed', async () => {
    mockFetch(() => ({ status: 422, body: { errors: { occurred_at: "The time can't be later than now." } } }))
    renderForm()
    const when = screen.getByLabelText('When')
    await userEvent.clear(when)
    await userEvent.type(when, '2026-11-30T09:00')
    await logNote('Called about the renewal')
    expect(await screen.findByText("The time can't be later than now.")).toBeInTheDocument()
    expect(when).toHaveAttribute('aria-invalid', 'true')
    expect(when).toHaveAccessibleDescription("The time can't be later than now.")
    expect(when).toHaveFocus()
    expect(screen.getByLabelText('Description')).toHaveValue('Called about the renewal')
  })

  test('if the server can’t be reached, it says so, keeping what was typed', async () => {
    mockFetch(() => ({ status: 500 }))
    renderForm()
    await logNote('Called about the renewal')
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Activity logged')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toHaveValue('Called about the renewal')
  })

  test('while it saves, Log activity is disabled', async () => {
    const { release } = holdFetch({ status: 201 })
    renderForm()
    await logNote('Called about the renewal')
    const button = screen.getByRole('button', { name: 'Log activity' })
    await waitFor(() => expect(button).toBeDisabled())
    release()
    await waitFor(() => expect(button).toBeEnabled())
  })
})
