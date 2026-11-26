import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { createQueryClient } from '../lib/api'
import { STAGES, mockFetch, renderWithApp } from '../test-utils'
import { DueBadge, LateBadge, StageBadge, StatusBadge } from './Badge'

/** A badge's tint, the color role behind its text. */
const tint = (text: string) => screen.getByText(text).style.background

describe('StageBadge', () => {
  test('shows the stage’s name in its tint', () => {
    renderWithApp(<StageBadge stage="proposal" />)
    expect(tint('Proposal')).toBe('var(--color-stage-proposal-tint)')
  })

  test('the name is the one the server gives', () => {
    const renamed = STAGES.map((s) => (s.key === 'won' ? { ...s, name: 'Closed won' } : s))
    renderWithApp(<StageBadge stage="won" />, { data: [[['stages'], renamed]] })
    expect(screen.getByText('Closed won')).toBeInTheDocument()
  })

  test('loads the stages if no page has yet', async () => {
    const calls = mockFetch(() => ({ body: STAGES }))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <StageBadge stage="negotiation" />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Negotiation')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/stages', body: undefined }])
  })
})

describe('StatusBadge', () => {
  test('shows each status in words, in its own tint', () => {
    render(
      <>
        <StatusBadge status="lead" />
        <StatusBadge status="qualified" />
        <StatusBadge status="customer" />
      </>,
    )
    expect(tint('Lead')).toBe('var(--color-status-lead-tint)')
    expect(tint('Qualified')).toBe('var(--color-status-qualified-tint)')
    expect(tint('Customer')).toBe('var(--color-status-customer-tint)')
  })
})

describe('LateBadge', () => {
  test('says Late, in the alert tint', () => {
    render(<LateBadge />)
    expect(tint('Late')).toBe('var(--color-alert-tint)')
  })
})

describe('DueBadge', () => {
  test('overdue is in the alert tint, today in the caution tint, and later is neutral', () => {
    render(
      <>
        <DueBadge days={-3} />
        <DueBadge days={0} />
        <DueBadge days={1} />
        <DueBadge days={4} />
      </>,
    )
    expect(tint('3 days overdue')).toBe('var(--color-alert-tint)')
    expect(tint('Due today')).toBe('var(--color-caution-tint)')
    expect(tint('Due tomorrow')).toBe('var(--color-neutral-tint)')
    expect(tint('Due in 4 days')).toBe('var(--color-neutral-tint)')
  })
})
