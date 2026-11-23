import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { Tooltip } from 'radix-ui'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { Stage } from './lib/types'

export const STAGES: Stage[] = [
  { key: 'new', name: 'New', order: 1, probability: 10, open: true },
  { key: 'qualified', name: 'Qualified', order: 2, probability: 25, open: true },
  { key: 'proposal', name: 'Proposal', order: 3, probability: 50, open: true },
  { key: 'negotiation', name: 'Negotiation', order: 4, probability: 75, open: true },
  { key: 'won', name: 'Won', order: 5, probability: 100, open: false },
  { key: 'lost', name: 'Lost', order: 6, probability: 0, open: false },
]

type RenderOptions = {
  path?: string
  route?: string
  /** Query data to start with, such as [['contacts'], [...]]. */
  data?: [QueryKey, unknown][]
}

/** Renders inside the app's providers, with the stages already loaded and a router at `path`. */
export function renderWithApp(ui: ReactElement, { path = '/', route = '/', data = [] }: RenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['stages'], STAGES)
  for (const [key, value] of data) client.setQueryData(key, value)
  const router = createMemoryRouter([{ path, element: ui }, { path: '*', element: null }], { initialEntries: [route] })
  const result = render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <RouterProvider router={router} />
      </Tooltip.Provider>
    </QueryClientProvider>,
  )
  return { ...result, client, router }
}

type Reply = { status?: number; body?: unknown }

/** Stands in for fetch. Each call is recorded, and answered by `reply`. */
export function mockFetch(reply: (method: string, path: string, body: unknown) => Reply = () => ({ body: {} })) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = input.replace(/^\/api/, '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })
    const { status = 200, body: replyBody = {} } = reply(method, path, body)
    return new Response(status === 204 ? null : JSON.stringify(replyBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}
