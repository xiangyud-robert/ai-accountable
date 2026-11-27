import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setTeamZone, teamNow } from '../../lib/teamTime'
import { dealRow, renderWithApp } from '../../test-utils'
import { DealList } from './DealList'

const thisYear = teamNow().getFullYear()

const DEALS = [
  dealRow({ name: 'Fleet analytics', value: 48_000, close_date: `${thisYear}-12-11` }),
  dealRow({
    id: 8,
    name: 'Warehouse sensors',
    stage: 'new',
    value: 15_500,
    close_date: '2020-02-12',
    late: true,
  }),
]

describe('DealList', () => {
  test('with no deals, it shows the message it was given', () => {
    renderWithApp(<DealList deals={[]} empty="No deals yet." />)
    expect(screen.getByText('No deals yet.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  test('each deal links to its page, with its stage, value and close date, whose year shows only if it isn’t this one', () => {
    renderWithApp(<DealList deals={DEALS} empty="No deals yet." />)
    const [fleet, sensors] = screen.getAllByRole('listitem').map((item) => within(item))
    expect(fleet.getByRole('link', { name: 'Fleet analytics' })).toHaveAttribute('href', '/deals/7')
    expect(fleet.getByText('Proposal')).toBeInTheDocument()
    expect(fleet.getByText('$48,000')).toBeInTheDocument()
    expect(fleet.getByText('Dec 11')).toBeInTheDocument()
    expect(sensors.getByRole('link', { name: 'Warehouse sensors' })).toHaveAttribute('href', '/deals/8')
    expect(sensors.getByText('New')).toBeInTheDocument()
    expect(sensors.getByText('$15,500')).toBeInTheDocument()
    expect(sensors.getByText('Feb 12, 2020')).toBeInTheDocument()
  })

  test('only a late deal has a Late badge', () => {
    renderWithApp(<DealList deals={DEALS} empty="No deals yet." />)
    const [fleet, sensors] = screen.getAllByRole('listitem').map((item) => within(item))
    expect(fleet.queryByText('Late')).not.toBeInTheDocument()
    expect(sensors.getByText('Late')).toBeInTheDocument()
  })
})

describe('DealList, once the team has reached the new year and this browser hasn’t', () => {
  afterEach(() => {
    setTeamZone(null)
    vi.useRealTimers()
  })

  test('a close date in the team’s new year leaves out the year', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 3:00 PM on Dec 31 in Los Angeles, where this browser is, and Jan 1 in Tokyo.
    vi.setSystemTime(new Date('2026-12-31T23:00:00Z'))
    setTeamZone('Asia/Tokyo')
    renderWithApp(<DealList deals={[dealRow({ close_date: '2027-01-20' })]} empty="No deals yet." />)
    expect(screen.getByText('Jan 20')).toBeInTheDocument()
  })
})
