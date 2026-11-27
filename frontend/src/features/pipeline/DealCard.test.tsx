import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { setTeamZone } from '../../lib/teamTime'
import { dealRow } from '../../test-utils'
import { DealCard } from './DealCard'

// At a probability of its own, not its stage's usual one.
const DEAL = dealRow({ probability: 65 })

describe('DealCard', () => {
  test('an open deal shows its contact, name, value, probability and close date', () => {
    render(<DealCard deal={DEAL} compact={false} />)
    expect(screen.getByText('Priya Raman')).toBeInTheDocument()
    expect(screen.getByText('Harbor Logistics fleet analytics')).toBeInTheDocument()
    expect(screen.getByText('$72,000')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText(/^Dec 11/)).toBeInTheDocument()
    expect(screen.queryByText('Late')).not.toBeInTheDocument()
  })

  test('a late deal says so, and one with no contact shows none', () => {
    render(<DealCard deal={{ ...DEAL, late: true, contact_id: null, contact_name: null }} compact={false} />)
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.queryByText('Priya Raman')).not.toBeInTheDocument()
  })

  test('a compact card, for Won and Lost, shows only the name, value and close date', () => {
    render(<DealCard deal={{ ...DEAL, stage: 'won', probability: 100 }} compact />)
    expect(screen.getByText('Harbor Logistics fleet analytics')).toBeInTheDocument()
    expect(screen.getByText('$72,000')).toBeInTheDocument()
    expect(screen.getByText(/^Dec 11/)).toBeInTheDocument()
    expect(screen.queryByText('Priya Raman')).not.toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
  })
})

describe('DealCard, once the team has reached the new year and this browser hasn’t', () => {
  afterEach(() => {
    setTeamZone(null)
    vi.useRealTimers()
  })

  test('a close date in the team’s new year leaves out the year', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 3:00 PM on Dec 31 in Los Angeles, where this browser is, and Jan 1 in Tokyo.
    vi.setSystemTime(new Date('2026-12-31T23:00:00Z'))
    setTeamZone('Asia/Tokyo')
    render(<DealCard deal={{ ...DEAL, close_date: '2027-01-20' }} compact={false} />)
    expect(screen.getByText('Jan 20')).toBeInTheDocument()
  })
})
