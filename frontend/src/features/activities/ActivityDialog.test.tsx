import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { holdFetch, mockFetch, renderWithApp } from '../../test-utils'
import { ActivityDialog, type EditableActivity } from './ActivityDialog'

const CALL: EditableActivity = {
  id: 8,
  type: 'call',
  description: 'Called about the renewal',
  occurred_at: '2026-11-21T09:05:00',
  follow_up_date: '2026-11-25',
  follow_up_done: false,
}

const NOTE: EditableActivity = {
  id: 6,
  type: 'note',
  description: 'Met at the conference',
  occurred_at: '2026-11-10T10:00:00',
  follow_up_date: null,
  follow_up_done: false,
}

function renderDialog(activity: EditableActivity = CALL) {
  const onOpenChange = vi.fn()
  render(<Toaster />)
  renderWithApp(<ActivityDialog open onOpenChange={onOpenChange} activity={activity} />)
  const dialog = screen.getByRole('dialog', { name: `Edit ${activity.type}` })
  return { onOpenChange, dialog: within(dialog) }
}

async function save(dialog: ReturnType<typeof within>) {
  await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
}

describe('ActivityDialog', () => {
  test('shows the activity as it is, with Done for its follow-up', () => {
    const { dialog } = renderDialog()
    expect(dialog.getByLabelText('Type')).toHaveTextContent('Call')
    expect(dialog.getByLabelText('When')).toHaveValue('2026-11-21T09:05')
    expect(dialog.getByLabelText('Description')).toHaveValue('Called about the renewal')
    expect(dialog.getByLabelText(/^Follow-up date/)).toHaveValue('2026-11-25')
    expect(dialog.getByRole('checkbox', { name: 'Done' })).not.toBeChecked()
  })

  test('closed, it shows nothing', () => {
    renderWithApp(<ActivityDialog open={false} onOpenChange={() => {}} activity={CALL} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('only changed fields are sent, and saving closes it with a message', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    const { dialog, onOpenChange } = renderDialog()
    await userEvent.type(dialog.getByLabelText('Description'), ' and the price  ')
    await save(dialog)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(await screen.findByText('Activity saved')).toBeInTheDocument()
    expect(calls).toEqual([
      { method: 'PATCH', path: '/activities/8', body: { description: 'Called about the renewal and the price' } },
    ])
  })

  test('a new type and time are sent, the time to the second', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    const { dialog } = renderDialog()
    await userEvent.click(dialog.getByLabelText('Type'))
    await userEvent.click(await screen.findByRole('option', { name: 'Email' }))
    expect(dialog.getByLabelText('Type')).toHaveTextContent('Email')
    const when = dialog.getByLabelText('When')
    await userEvent.clear(when)
    await userEvent.type(when, '2026-11-20T16:45')
    await save(dialog)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ type: 'email', occurred_at: '2026-11-20T16:45:00' })
  })

  test('ticking Done marks the follow-up done', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    const { dialog } = renderDialog()
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Done' }))
    expect(dialog.getByRole('checkbox', { name: 'Done' })).toBeChecked()
    await save(dialog)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ follow_up_done: true })
  })

  test('with no follow-up date there’s no Done, until one is entered', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    const { dialog } = renderDialog(NOTE)
    expect(dialog.queryByRole('checkbox', { name: 'Done' })).not.toBeInTheDocument()
    await userEvent.type(dialog.getByLabelText(/^Follow-up date/), '2026-12-01')
    const done = dialog.getByRole('checkbox', { name: 'Done' })
    expect(done).not.toBeChecked()
    await userEvent.click(done)
    await save(dialog)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({
      method: 'PATCH',
      path: '/activities/6',
      body: { follow_up_date: '2026-12-01', follow_up_done: true },
    })
  })

  test('clearing the follow-up date hides Done, and a done follow-up is sent as not done', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    const { dialog } = renderDialog({ ...CALL, follow_up_done: true })
    expect(dialog.getByRole('checkbox', { name: 'Done' })).toBeChecked()
    await userEvent.clear(dialog.getByLabelText(/^Follow-up date/))
    expect(dialog.queryByRole('checkbox', { name: 'Done' })).not.toBeInTheDocument()
    await save(dialog)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ follow_up_date: null, follow_up_done: false })
  })

  test('empty required fields are caught before sending, and focus moves to the first', async () => {
    const calls = mockFetch()
    const { dialog, onOpenChange } = renderDialog()
    const description = dialog.getByLabelText('Description')
    await userEvent.clear(description)
    // Only spaces counts as empty.
    await userEvent.type(description, '   ')
    await userEvent.clear(dialog.getByLabelText('When'))
    await save(dialog)
    expect(await dialog.findByText('Enter a description.')).toBeInTheDocument()
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(description).toHaveAccessibleDescription('Enter a description.')
    expect(dialog.getByLabelText('When')).toHaveAccessibleDescription('Enter the date and time it happened.')
    expect(dialog.getByLabelText('When')).toHaveFocus()
    expect(calls).toEqual([])
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('the server’s 422 messages appear under their fields, and it stays open', async () => {
    mockFetch(() => ({ status: 422, body: { errors: { occurred_at: "The time can't be later than now." } } }))
    const { dialog, onOpenChange } = renderDialog()
    const when = dialog.getByLabelText('When')
    await userEvent.clear(when)
    await userEvent.type(when, '2026-11-30T09:00')
    await save(dialog)
    expect(await dialog.findByText("The time can't be later than now.")).toBeInTheDocument()
    expect(when).toHaveAttribute('aria-invalid', 'true')
    expect(when).toHaveAccessibleDescription("The time can't be later than now.")
    expect(when).toHaveFocus()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('if the server can’t be reached, it says so and stays open', async () => {
    mockFetch(() => ({ status: 500 }))
    const { dialog, onOpenChange } = renderDialog()
    await userEvent.type(dialog.getByLabelText('Description'), ' again')
    await save(dialog)
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Activity saved')).not.toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(dialog.getByLabelText('Description')).toHaveValue('Called about the renewal again')
  })

  test('while it saves, Save is disabled', async () => {
    const { release } = holdFetch()
    const { dialog, onOpenChange } = renderDialog()
    await userEvent.type(dialog.getByLabelText('Description'), ' again')
    await save(dialog)
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled())
    release()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('Cancel closes it without sending anything', async () => {
    const calls = mockFetch()
    const { dialog, onOpenChange } = renderDialog()
    await userEvent.type(dialog.getByLabelText('Description'), ' again')
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(calls).toEqual([])
  })
})
