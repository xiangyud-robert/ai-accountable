import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { STAGES, mockFetch } from '../test-utils'
import { createQueryClient } from './api'
import { STATUSES, statusName, useStages } from './stages'
import type { Status } from './types'

function StageNames() {
  const { data: stages } = useStages()
  return <p>{stages ? stages.map((s) => s.name).join(', ') : 'Loading'}</p>
}

describe('useStages', () => {
  test('asks the server for the stages once, and keeps them', async () => {
    const calls = mockFetch(() => ({ body: STAGES }))
    const page = (
      <QueryClientProvider client={createQueryClient()}>
        <StageNames />
      </QueryClientProvider>
    )
    const { unmount } = render(page)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(await screen.findByText('New, Qualified, Proposal, Negotiation, Won, Lost')).toBeInTheDocument()
    unmount()

    // Another page that needs them doesn't ask again.
    render(page)
    expect(screen.getByText('New, Qualified, Proposal, Negotiation, Won, Lost')).toBeInTheDocument()
    expect(calls).toEqual([{ method: 'GET', path: '/stages', body: undefined }])
  })
})

describe('statuses', () => {
  test('each has a name, and a plural for the filter', () => {
    expect(STATUSES.map((s) => [statusName(s.key), s.plural])).toEqual([
      ['Lead', 'Leads'],
      ['Qualified', 'Qualified'],
      ['Customer', 'Customers'],
    ])
  })

  test('a status the app doesn’t know yet shows as the server sent it', () => {
    expect(statusName('partner' as Status)).toBe('partner')
  })
})
