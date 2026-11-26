import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'
import { Toaster } from '../../components/Toaster'
import type { DealRow, StageKey } from '../../lib/types'
import { STAGES, dealRow, mockFetch } from '../../test-utils'
import { DEALS_KEY, useDeals, useMoveDeal } from './queries'

const HARBOR = dealRow({ id: 1 })
const COBALT = dealRow({ id: 2, name: 'Cobalt Bank pilot', value: 10_000, position: 1 })
const ATLAS = dealRow({ id: 3, name: 'Atlas Robotics training', stage: 'new', value: 10_000 })
const DEALS = [ATLAS, HARBOR, COBALT]

/** Moves deals the way the pipeline board does, with the deals on screen, so they're refetched after. */
function renderMove(deals: DealRow[] | null = DEALS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['stages'], STAGES)
  if (deals) client.setQueryData(DEALS_KEY, deals)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  render(<Toaster />)
  const { result } = renderHook(
    () => {
      useDeals()
      return useMoveDeal()
    },
    { wrapper },
  )
  return { client, move: (to: Parameters<typeof result.current>[0]) => result.current(to) }
}

const cached = (client: QueryClient) => client.getQueryData<DealRow[]>(DEALS_KEY)
const found = (client: QueryClient, id: number) => cached(client)?.find((d) => d.id === id)
/** The names in one stage's column, top to bottom. */
const column = (client: QueryClient, stage: StageKey) =>
  (cached(client) ?? [])
    .filter((d) => d.stage === stage)
    .sort((a, b) => a.position - b.position)
    .map((d) => d.name)

describe('useMoveDeal', () => {
  test('the card moves at once, then is saved, and the server’s deals replace the guess', async () => {
    const fromServer = [
      ATLAS,
      { ...HARBOR, stage: 'negotiation' as const, probability: 75 },
      { ...COBALT, position: 0 },
    ]
    const calls = mockFetch((method) => ({ body: method === 'POST' ? fromServer[1] : fromServer }))
    const { client, move } = renderMove()
    act(() => move({ id: 1, stage: 'negotiation', index: 0 }))
    // Before the server has answered, every figure already shows the move (R3, R5).
    expect(found(client, 1)).toMatchObject({ stage: 'negotiation', probability: 75, expected: 54000, position: 0 })
    expect(column(client, 'proposal')).toEqual(['Cobalt Bank pilot'])
    expect(found(client, 2)).toMatchObject({ position: 0 })
    expect(await screen.findByText('Deal moved')).toBeInTheDocument()
    await waitFor(() => expect(cached(client)).toEqual(fromServer))
    expect(calls).toEqual([
      { method: 'POST', path: '/deals/1/move', body: { stage: 'negotiation', index: 0 } },
      { method: 'GET', path: '/deals', body: undefined },
    ])
  })

  test('when the save fails, the card goes back as it was and a message says so', async () => {
    // The server is down, so the refetch after fails too, and what's left is what the move put back.
    mockFetch(() => ({ status: 500 }))
    const { client, move } = renderMove()
    act(() => move({ id: 1, stage: 'won', index: 0 }))
    expect(column(client, 'won')).toEqual(['Harbor Logistics fleet analytics'])
    expect(await screen.findByText("Couldn't save the move, so the card is back where it was.")).toBeInTheDocument()
    expect(column(client, 'proposal')).toEqual(['Harbor Logistics fleet analytics', 'Cobalt Bank pilot'])
    expect(column(client, 'won')).toEqual([])
    expect(found(client, 1)).toEqual(HARBOR)
  })

  test('only the card whose save failed goes back, so one moved since stays where it was dropped', async () => {
    // The refetch after fails, so what's left is what the two moves did.
    mockFetch((_method, path) => (path === '/deals/3/move' ? { body: {} } : { status: 500 }))
    const { client, move } = renderMove()
    act(() => {
      move({ id: 1, stage: 'won', index: 0 })
      move({ id: 3, stage: 'proposal', index: 0 })
    })
    expect(column(client, 'proposal')).toEqual(['Atlas Robotics training', 'Cobalt Bank pilot'])
    expect(await screen.findByText("Couldn't save the move, so the card is back where it was.")).toBeInTheDocument()
    expect(column(client, 'won')).toEqual([])
    expect(column(client, 'new')).toEqual([])
    expect(column(client, 'proposal')).toEqual([
      'Harbor Logistics fleet analytics',
      'Atlas Robotics training',
      'Cobalt Bank pilot',
    ])
    expect(found(client, 3)).toMatchObject({ stage: 'proposal', probability: 50 })
  })

  test('with no deals loaded, a move sends nothing', async () => {
    const calls = mockFetch(() => ({ status: 500 }))
    const { client, move } = renderMove(null)
    // The board's own request for the deals fails.
    await waitFor(() => expect(client.getQueryState(DEALS_KEY)?.status).toBe('error'))
    act(() => move({ id: 1, stage: 'won', index: 0 }))
    expect(cached(client)).toBeUndefined()
    expect(calls).toEqual([{ method: 'GET', path: '/deals', body: undefined }])
  })
})
