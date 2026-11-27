import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { Dashboard, TimelineEntry } from '../../lib/types'
import { panel, person, renderWithApp } from '../../test-utils'
import { RecentActivity } from './RecentActivity'

const base = {
  type: null,
  follow_up_date: null,
  follow_up_done: null,
  follow_up_overdue: null,
  from_value: null,
  to_value: null,
  contact_id: null,
  contact_name: null,
  deal_id: null,
  deal_name: null,
  created_by: null,
}
const onDeal = { record: 'deal', deal_id: 9, deal_name: 'Northwind analytics rollout' } as const
const onContact = { record: 'contact', contact_id: 3, contact_name: 'Priya Raman' } as const

const RECENT: TimelineEntry[] = [
  {
    ...base,
    ...onDeal,
    key: 'stage-4',
    kind: 'stage_change',
    id: 4,
    at: '2026-06-15T09:40:00',
    text: 'Moved from Proposal to Negotiation',
    from_value: 'proposal',
    to_value: 'negotiation',
  },
  {
    ...base,
    ...onContact,
    key: 'activity-8',
    kind: 'activity',
    id: 8,
    at: '2026-06-15T08:05:00',
    text: 'Called about the renewal',
    type: 'call',
    created_by: person('Dana Holt'),
  },
  {
    ...base,
    ...onContact,
    key: 'status-1',
    kind: 'status_change',
    id: 1,
    at: '2026-06-14T16:30:00',
    text: 'Became a customer when Northwind analytics rollout was won',
    from_value: 'qualified',
    to_value: 'customer',
  },
  {
    ...base,
    ...onDeal,
    key: 'activity-7',
    kind: 'activity',
    id: 7,
    at: '2026-06-10T14:30:00',
    text: 'Sent the pricing',
    type: 'email',
    created_by: person('Joel Abara'),
  },
  {
    ...base,
    ...onContact,
    key: 'activity-2',
    kind: 'activity',
    id: 2,
    at: '2025-12-01T10:00:00',
    text: 'Met at the conference',
    type: 'note',
  },
]

const renderRecent = (recent: TimelineEntry[]) =>
  renderWithApp(<RecentActivity dashboard={{ today: '2026-06-15', recent } as Dashboard} />)

/** The entries under Today, Yesterday or Earlier. */
const group = (title: string) => within(panel('Recent activity')).getByRole('region', { name: title })
const item = (text: string) => screen.getByText(text).closest('li')!

/** What each entry under a title says, top to bottom. */
const entriesUnder = (title: string) =>
  within(group(title))
    .getAllByRole('listitem')
    .map((entry) => RECENT.find(({ text }) => within(entry).queryByText(text))?.text)

describe('RecentActivity', () => {
  test('entries are grouped under Today, Yesterday and Earlier, newest first', () => {
    renderRecent(RECENT)
    const titles = within(panel('Recent activity')).getAllByRole('heading', { level: 3 })
    expect(titles.map((title) => title.textContent)).toEqual(['Today', 'Yesterday', 'Earlier'])
    expect(entriesUnder('Today')).toEqual(['Moved from Proposal to Negotiation', 'Called about the renewal'])
    expect(entriesUnder('Yesterday')).toEqual(['Became a customer when Northwind analytics rollout was won'])
    expect(entriesUnder('Earlier')).toEqual(['Sent the pricing', 'Met at the conference'])
  })

  test('each entry links to the deal or contact it’s on', () => {
    renderRecent(RECENT)
    expect(within(item('Moved from Proposal to Negotiation')).getByRole('link')).toHaveAccessibleName(
      'Northwind analytics rollout',
    )
    expect(within(item('Moved from Proposal to Negotiation')).getByRole('link')).toHaveAttribute('href', '/deals/9')
    expect(within(item('Called about the renewal')).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute(
      'href',
      '/contacts/3',
    )
  })

  test('today’s and yesterday’s entries give the time, and earlier ones the date as well', () => {
    renderRecent(RECENT)
    expect(within(item('Moved from Proposal to Negotiation')).getByText('9:40 AM')).toBeInTheDocument()
    expect(
      within(item('Became a customer when Northwind analytics rollout was won')).getByText('4:30 PM'),
    ).toBeInTheDocument()
    expect(within(item('Sent the pricing')).getByText('Jun 10, 2:30 PM')).toBeInTheDocument()
    expect(within(item('Met at the conference')).getByText('Dec 1, 2025, 10:00 AM')).toBeInTheDocument()
  })

  test('activities say who logged them after the time, and stage and status changes name no one', () => {
    renderRecent(RECENT)
    expect(item('Called about the renewal')).toHaveTextContent('8:05 AM, by Dana Holt')
    expect(item('Sent the pricing')).toHaveTextContent('Jun 10, 2:30 PM, by Joel Abara')
    // Logged before sign-in, so no one is recorded.
    expect(item('Met at the conference')).not.toHaveTextContent(/, by /)
    expect(item('Moved from Proposal to Negotiation')).not.toHaveTextContent(/, by /)
    expect(item('Became a customer when Northwind analytics rollout was won')).not.toHaveTextContent(/, by /)
  })

  test('with nothing yet, it says so', () => {
    renderRecent([])
    expect(within(panel('Recent activity')).getByText('Nothing has happened yet.')).toBeInTheDocument()
    expect(within(panel('Recent activity')).queryByRole('listitem')).not.toBeInTheDocument()
  })
})
