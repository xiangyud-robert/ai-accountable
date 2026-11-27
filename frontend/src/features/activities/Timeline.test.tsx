import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { setTeamZone } from '../../lib/teamTime'
import type { TimelineEntry } from '../../lib/types'
import { mockFetch, person, renderWithApp } from '../../test-utils'
import { Timeline } from './Timeline'

const base = {
  type: null,
  follow_up_date: null,
  follow_up_done: null,
  follow_up_overdue: null,
  from_value: null,
  to_value: null,
  contact_id: 3,
  contact_name: 'Priya Raman',
  deal_id: null,
  deal_name: null,
  created_by: null,
}

const ENTRIES: TimelineEntry[] = [
  {
    ...base,
    key: 'status-1',
    kind: 'status_change',
    id: 1,
    at: '2026-11-22T14:30:00',
    text: 'Became a customer when Northwind analytics rollout was won',
    record: 'contact',
    from_value: 'qualified',
    to_value: 'customer',
    deal_id: 9,
    deal_name: 'Northwind analytics rollout',
  },
  {
    ...base,
    key: 'stage-4',
    kind: 'stage_change',
    id: 4,
    at: '2026-11-22T14:30:00',
    text: 'Moved from Negotiation to Won',
    record: 'deal',
    from_value: 'negotiation',
    to_value: 'won',
    deal_id: 9,
    deal_name: 'Northwind analytics rollout',
  },
  {
    ...base,
    key: 'activity-8',
    kind: 'activity',
    id: 8,
    at: '2026-11-21T09:05:00',
    text: 'Called about the renewal',
    record: 'deal',
    type: 'call',
    created_by: person('Dana Holt'),
    follow_up_date: '2026-11-25',
    follow_up_done: false,
    follow_up_overdue: false,
    deal_id: 9,
    deal_name: 'Northwind analytics rollout',
  },
  {
    ...base,
    key: 'activity-7',
    kind: 'activity',
    id: 7,
    at: '2026-11-12T14:30:00',
    text: 'Sent the pricing',
    record: 'contact',
    type: 'email',
    created_by: person('Joel Abara'),
    follow_up_date: '2026-11-18',
    follow_up_done: false,
    follow_up_overdue: true,
  },
  {
    ...base,
    key: 'activity-6',
    kind: 'activity',
    id: 6,
    at: '2026-11-10T10:00:00',
    text: 'Met at the conference',
    record: 'contact',
    type: 'note',
    follow_up_date: '2026-11-11',
    follow_up_done: true,
    follow_up_overdue: false,
  },
  {
    ...base,
    key: 'stage-2',
    kind: 'stage_change',
    id: 2,
    at: '2026-10-01T10:00:00',
    text: 'Added at Proposal',
    record: 'deal',
    to_value: 'proposal',
    deal_id: 9,
    deal_name: 'Northwind analytics rollout',
  },
]

const item = (text: string) => screen.getByText(text).closest('li')!

/** A contact's timeline, with the app's toasts. */
function renderTimeline() {
  render(<Toaster />)
  return renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
}

const done = (text: string) => within(item(text)).getByRole('checkbox', { name: 'Done' })

async function chooseAction(text: string, type: string, action: 'Edit' | 'Delete') {
  await userEvent.click(within(item(text)).getByRole('button', { name: `Actions for this ${type}` }))
  await userEvent.click(await screen.findByRole('menuitem', { name: action }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 15, 0))
})
afterEach(() => {
  setTeamZone(null)
  vi.useRealTimers()
})

describe('Timeline', () => {
  test('each kind of entry shows its text and when it happened', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(
      within(item('Became a customer when Northwind analytics rollout was won')).getByText('Today, 2:30 PM'),
    ).toBeInTheDocument()
    expect(within(item('Moved from Negotiation to Won')).getByText('Today, 2:30 PM')).toBeInTheDocument()
    expect(within(item('Called about the renewal')).getByText('Yesterday, 9:05 AM')).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByText('Nov 12, 2:30 PM')).toBeInTheDocument()
    expect(item('Added at Proposal')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent)).toEqual(
      ENTRIES.map((e) => e.text),
    )
  })

  test('activities say who logged them after when they happened, and stage and status changes name no one', () => {
    renderWithApp(
      <Timeline
        entries={[
          { ...ENTRIES[2], key: 'activity-9', id: 9, at: '2026-11-22T14:30:00', text: 'Sent the contract' },
          ...ENTRIES,
        ]}
        on="contact"
      />,
    )
    expect(item('Sent the contract')).toHaveTextContent('Today, 2:30 PM, by Dana Holt')
    expect(item('Called about the renewal')).toHaveTextContent('Yesterday, 9:05 AM, by Dana Holt')
    expect(item('Sent the pricing')).toHaveTextContent('Nov 12, 2:30 PM, by Joel Abara')
    // Logged before sign-in, so no one is recorded.
    expect(item('Met at the conference')).not.toHaveTextContent(/, by /)
    for (const text of [
      'Became a customer when Northwind analytics rollout was won',
      'Moved from Negotiation to Won',
      'Added at Proposal',
    ]) {
      expect(item(text)).not.toHaveTextContent(/, by /)
    }
  })

  test('Today and Yesterday follow the team’s clock, not this browser’s', () => {
    // 3:00 PM on Nov 22 here in Los Angeles is already 8:00 AM on Nov 23 in Tokyo.
    setTeamZone('Asia/Tokyo')
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(within(item('Moved from Negotiation to Won')).getByText('Yesterday, 2:30 PM')).toBeInTheDocument()
    expect(within(item('Called about the renewal')).getByText('Nov 21, 9:05 AM')).toBeInTheDocument()
  })

  test('on a contact’s timeline, entries from a deal say which deal, with a link', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    const call = within(item('Called about the renewal'))
    expect(call.getByText(/^On/)).toHaveTextContent('On Northwind analytics rollout')
    expect(call.getByRole('link', { name: 'Northwind analytics rollout' })).toHaveAttribute('href', '/deals/9')
    expect(within(item('Moved from Negotiation to Won')).getByText(/^On/)).toBeInTheDocument()
    // The contact's own entries, and their status change, aren't "on" a deal.
    expect(within(item('Sent the pricing')).queryByText(/^On/)).toBeNull()
    expect(within(item('Became a customer when Northwind analytics rollout was won')).queryByText(/^On/)).toBeNull()
  })

  test('on a deal’s timeline, nothing says which deal', () => {
    renderWithApp(<Timeline entries={ENTRIES.filter((e) => e.record === 'deal')} on="deal" />)
    expect(screen.queryByText(/^On /)).toBeNull()
  })

  test('follow-up labels', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(within(item('Called about the renewal')).getByText('Follow up Nov 25')).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByText('Overdue since Nov 18')).toBeInTheDocument()
    expect(within(item('Met at the conference')).getByText('Done')).toBeInTheDocument()
    expect(within(item('Met at the conference')).getByRole('checkbox', { name: 'Done' })).toBeChecked()
    expect(within(item('Called about the renewal')).getByRole('checkbox', { name: 'Done' })).not.toBeChecked()
  })

  test('edit and delete only on activities', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(
      within(item('Called about the renewal')).getByRole('button', { name: 'Actions for this call' }),
    ).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByRole('button', { name: 'Actions for this email' })).toBeInTheDocument()
    for (const text of [
      'Moved from Negotiation to Won',
      'Added at Proposal',
      'Became a customer when Northwind analytics rollout was won',
    ]) {
      expect(within(item(text)).queryByRole('button')).toBeNull()
      expect(within(item(text)).queryByRole('checkbox')).toBeNull()
    }
  })

  test('with nothing in it, it says so', () => {
    renderWithApp(<Timeline entries={[]} on="deal" />)
    expect(screen.getByText('Nothing has happened here yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Timeline' })).not.toBeInTheDocument()
  })

  test('the Done checkbox is described by its follow-up', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(done('Sent the pricing')).toHaveAccessibleDescription('Overdue since Nov 18')
  })

  test('ticking Done marks the follow-up done and confirms it', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    renderTimeline()
    await userEvent.click(done('Called about the renewal'))
    expect(await screen.findByText('Follow-up done')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'PATCH', path: '/activities/8', body: { follow_up_done: true } }])
  })

  test('unticking Done marks a follow-up not done again', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    renderTimeline()
    await userEvent.click(done('Met at the conference'))
    expect(await screen.findByText('Follow-up not done')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'PATCH', path: '/activities/6', body: { follow_up_done: false } }])
  })

  test('if marking it done can’t reach the server, it says so', async () => {
    mockFetch(() => ({ status: 500 }))
    renderTimeline()
    await userEvent.click(done('Sent the pricing'))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Follow-up done')).not.toBeInTheDocument()
  })

  test('Edit opens the activity in a dialog, and saving sends what changed', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    renderTimeline()
    await chooseAction('Sent the pricing', 'email', 'Edit')
    const dialog = within(screen.getByRole('dialog', { name: 'Edit email' }))
    expect(dialog.getByLabelText('Type')).toHaveTextContent('Email')
    expect(dialog.getByLabelText('When')).toHaveValue('2026-11-12T14:30')
    expect(dialog.getByLabelText(/^Follow-up date/)).toHaveValue('2026-11-18')
    const description = dialog.getByLabelText('Description')
    expect(description).toHaveValue('Sent the pricing')
    await userEvent.type(description, ' and the contract')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toEqual([
      { method: 'PATCH', path: '/activities/7', body: { description: 'Sent the pricing and the contract' } },
    ])
  })

  test('Edit starts afresh each time, leaving out what was cancelled', async () => {
    const calls = mockFetch()
    renderTimeline()
    await chooseAction('Called about the renewal', 'call', 'Edit')
    await userEvent.type(screen.getByLabelText('Description'), ' twice')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await chooseAction('Called about the renewal', 'call', 'Edit')
    expect(screen.getByLabelText('Description')).toHaveValue('Called about the renewal')
    expect(calls).toEqual([])
  })

  test('Delete asks first, and Cancel keeps it', async () => {
    const calls = mockFetch()
    renderTimeline()
    await chooseAction('Called about the renewal', 'call', 'Delete')
    const question = screen.getByRole('alertdialog', { name: 'Delete this call?' })
    await userEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(calls).toEqual([])
  })

  test('confirming deletes only that activity, and says so', async () => {
    const calls = mockFetch(() => ({ status: 204 }))
    renderTimeline()
    await chooseAction('Sent the pricing', 'email', 'Delete')
    await userEvent.click(screen.getByRole('button', { name: 'Delete email' }))
    expect(await screen.findByText('Activity deleted')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'DELETE', path: '/activities/7', body: undefined }])
  })

  test('when the delete can’t reach the server, it says so and keeps asking', async () => {
    mockFetch(() => ({ status: 500 }))
    renderTimeline()
    await chooseAction('Sent the pricing', 'email', 'Delete')
    await userEvent.click(screen.getByRole('button', { name: 'Delete email' }))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Activity deleted')).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog', { name: 'Delete this email?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete email' })).toBeEnabled()
  })
})
