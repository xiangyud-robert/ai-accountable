import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TimelineEntry } from '../../lib/types'
import { renderWithApp } from '../../test-utils'
import { Timeline } from './Timeline'

const base = {
  type: null,
  follow_up_date: null,
  follow_up_done: null,
  from_value: null,
  to_value: null,
  contact_id: 3,
  contact_name: 'Priya Raman',
  deal_id: null,
  deal_name: null,
}

const ENTRIES: TimelineEntry[] = [
  { ...base, key: 'status-1', kind: 'status_change', id: 1, at: '2026-11-22T14:30:00', text: 'Became a customer when Northwind analytics rollout was won', record: 'contact', from_value: 'qualified', to_value: 'customer', deal_id: 9, deal_name: 'Northwind analytics rollout' },
  { ...base, key: 'stage-4', kind: 'stage_change', id: 4, at: '2026-11-22T14:30:00', text: 'Moved from Negotiation to Won', record: 'deal', from_value: 'negotiation', to_value: 'won', deal_id: 9, deal_name: 'Northwind analytics rollout' },
  { ...base, key: 'activity-8', kind: 'activity', id: 8, at: '2026-11-21T09:05:00', text: 'Called about the renewal', record: 'deal', type: 'call', follow_up_date: '2026-11-25', follow_up_done: false, deal_id: 9, deal_name: 'Northwind analytics rollout' },
  { ...base, key: 'activity-7', kind: 'activity', id: 7, at: '2026-11-12T14:30:00', text: 'Sent the pricing', record: 'contact', type: 'email', follow_up_date: '2026-11-18', follow_up_done: false },
  { ...base, key: 'activity-6', kind: 'activity', id: 6, at: '2026-11-10T10:00:00', text: 'Met at the conference', record: 'contact', type: 'note', follow_up_date: '2026-11-11', follow_up_done: true },
  { ...base, key: 'stage-2', kind: 'stage_change', id: 2, at: '2026-10-01T10:00:00', text: 'Added at Proposal', record: 'deal', to_value: 'proposal', deal_id: 9, deal_name: 'Northwind analytics rollout' },
]

const item = (text: string) => screen.getByText(text).closest('li')!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 15, 0))
})
afterEach(() => vi.useRealTimers())

describe('Timeline', () => {
  test('each kind of entry shows its text and when it happened', () => {
    renderWithApp(<Timeline entries={ENTRIES} on="contact" />)
    expect(within(item('Became a customer when Northwind analytics rollout was won')).getByText('Today, 2:30 PM')).toBeInTheDocument()
    expect(within(item('Moved from Negotiation to Won')).getByText('Today, 2:30 PM')).toBeInTheDocument()
    expect(within(item('Called about the renewal')).getByText('Yesterday, 9:05 AM')).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByText('Nov 12, 2:30 PM')).toBeInTheDocument()
    expect(item('Added at Proposal')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent)).toEqual(ENTRIES.map((e) => e.text))
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
    expect(within(item('Called about the renewal')).getByRole('button', { name: 'Actions for this call' })).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByRole('button', { name: 'Actions for this email' })).toBeInTheDocument()
    for (const text of ['Moved from Negotiation to Won', 'Added at Proposal', 'Became a customer when Northwind analytics rollout was won']) {
      expect(within(item(text)).queryByRole('button')).toBeNull()
      expect(within(item(text)).queryByRole('checkbox')).toBeNull()
    }
  })
})
