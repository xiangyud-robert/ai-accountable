import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { Dashboard, FollowUp } from '../../lib/types'
import { holdFetch, mockFetch, panel, renderWithApp } from '../../test-utils'
import { FollowUps } from './FollowUps'

const onDeal = { contact_id: null, contact_name: null }
const onContact = { deal_id: null, deal_name: null }

const FOLLOW_UPS: FollowUp[] = [
  {
    ...onDeal,
    id: 11,
    type: 'call',
    description: 'Chase the signed order form',
    follow_up_date: '2026-06-06',
    days: -9,
    overdue: true,
    deal_id: 3,
    deal_name: 'Harbor Logistics fleet analytics',
  },
  {
    ...onContact,
    id: 12,
    type: 'email',
    description: 'Send the renewal quote',
    follow_up_date: '2026-06-15',
    days: 0,
    overdue: false,
    contact_id: 4,
    contact_name: 'Priya Raman',
  },
  {
    ...onContact,
    id: 13,
    type: 'note',
    description: 'Book the training day',
    follow_up_date: '2026-06-19',
    days: 4,
    overdue: false,
    contact_id: 5,
    contact_name: 'Daniel Okafor',
  },
]

function renderFollowUps(followUps = FOLLOW_UPS) {
  return renderWithApp(
    <>
      <FollowUps dashboard={{ follow_ups: followUps } as Dashboard} />
      <Toaster />
    </>,
  )
}

const item = (description: string) => screen.getByText(description).closest('li')!
const done = (description: string) => screen.getByRole('checkbox', { name: 'Done', description })

describe('FollowUps', () => {
  test('the heading counts the overdue ones and the ones due in the next 7 days', () => {
    renderFollowUps()
    expect(within(panel('Follow-ups')).getByText(/overdue,/)).toHaveTextContent('1 overdue, 2 due in the next 7 days')
  })

  test('each one shows when it’s due and links to the deal or contact it’s on', () => {
    renderFollowUps()
    const chase = item('Chase the signed order form')
    expect(within(chase).getByText('9 days overdue')).toBeInTheDocument()
    expect(within(chase).getByRole('link', { name: 'Harbor Logistics fleet analytics' })).toHaveAttribute(
      'href',
      '/deals/3',
    )
    const quote = item('Send the renewal quote')
    expect(within(quote).getByText('Due today')).toBeInTheDocument()
    expect(within(quote).getByRole('link', { name: 'Priya Raman' })).toHaveAttribute('href', '/contacts/4')
    expect(within(item('Book the training day')).getByText('Due in 4 days')).toBeInTheDocument()
  })

  test('ticking Done marks that follow-up done and confirms it', async () => {
    const calls = mockFetch(() => ({ body: {} }))
    renderFollowUps()
    await userEvent.click(done('Send the renewal quote'))
    expect(await screen.findByText('Follow-up done')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'PATCH', path: '/activities/12', body: { follow_up_done: true } }])
  })

  test('while it saves, only that follow-up’s checkbox is disabled', async () => {
    const { release } = holdFetch()
    renderFollowUps()
    await userEvent.click(done('Chase the signed order form'))
    await waitFor(() => expect(done('Chase the signed order form')).toBeDisabled())
    expect(done('Send the renewal quote')).toBeEnabled()
    release()
    await waitFor(() => expect(done('Chase the signed order form')).toBeEnabled())
  })

  test('if the server can’t be reached, it says so', async () => {
    mockFetch(() => ({ status: 500 }))
    renderFollowUps()
    await userEvent.click(done('Book the training day'))
    expect(await screen.findByText(UNREACHABLE_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText('Follow-up done')).not.toBeInTheDocument()
  })

  test('with none due, it says there’s nothing to follow up', () => {
    renderFollowUps([])
    expect(within(panel('Follow-ups')).getByText(/overdue,/)).toHaveTextContent('0 overdue, 0 due in the next 7 days')
    expect(within(panel('Follow-ups')).getByText('Nothing to follow up in the next 7 days.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Follow-ups' })).not.toBeInTheDocument()
  })
})
