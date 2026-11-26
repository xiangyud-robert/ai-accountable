import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from 'radix-ui'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { createQueryClient } from './lib/api'
import type { ContactRow, DealRow, OrganizationRow, Stage } from './lib/types'

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
  /**
   * Uses the app's own query client, so every successful change refetches every query in use.
   * Off by default while some tests still expect a save to send nothing more.
   */
  refetchAfterChanges?: boolean
}

// Each test sees only the data it sets up, and a failed request isn't asked again.
const TEST_QUERIES = { retry: false, staleTime: Infinity }

/** Renders inside the app's providers, with the stages already loaded and a router at `path`. */
export function renderWithApp(
  ui: ReactElement,
  { path = '/', route = '/', data = [], refetchAfterChanges = false }: RenderOptions = {},
) {
  const client = refetchAfterChanges
    ? createQueryClient(TEST_QUERIES)
    : new QueryClient({ defaultOptions: { queries: TEST_QUERIES } })
  client.setQueryData(['stages'], STAGES)
  for (const [key, value] of data) client.setQueryData(key, value)
  const router = createMemoryRouter(
    [
      { path, element: ui },
      { path: '*', element: null },
    ],
    { initialEntries: [route] },
  )
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

/** Stands in for fetch. Each call is recorded, and answered by `reply`, which can hold it with a promise. */
export function mockFetch(
  reply: (method: string, path: string, body: unknown) => Reply | Promise<Reply> = () => ({ body: {} }),
) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = input.replace(/^\/api/, '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body })
    const { status = 200, body: replyBody = {} } = await reply(method, path, body)
    return new Response(status === 204 ? null : JSON.stringify(replyBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

/** Like mockFetch, but every request waits until `release` is called, then gets `reply`. */
export function holdFetch(reply: Reply = {}) {
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  const calls = mockFetch(async () => {
    await released
    return reply
  })
  return { calls, release }
}

/** A deal as the API lists it, at its stage's usual probability unless `overrides` sets one. */
export function dealRow(overrides: Partial<DealRow> = {}): DealRow {
  const { stage = 'proposal', value = 72_000 } = overrides
  const probability = overrides.probability ?? STAGES.find((s) => s.key === stage)!.probability
  return {
    id: 7,
    name: 'Harbor Logistics fleet analytics',
    organization_id: 1,
    organization_name: 'Harbor Logistics',
    contact_id: 10,
    contact_name: 'Priya Raman',
    stage,
    value,
    probability,
    expected: (value * probability) / 100,
    close_date: '2026-12-11',
    position: 0,
    late: false,
    activity_count: 4,
    created_at: '2026-10-05T09:30:00',
    updated_at: '2026-11-20T10:15:00',
    ...overrides,
  }
}

/** A contact as the API lists it: the main contact on dealRow() and one won deal. */
export function contactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 10,
    name: 'Priya Raman',
    email: 'priya@harborlogistics.com',
    phone: '+1 415 555 0142',
    job_title: 'Head of Operations',
    organization_id: 1,
    organization_name: 'Harbor Logistics',
    status: 'customer',
    deal_count: 2,
    activity_count: 5,
    created_at: '2026-09-14T11:00:00',
    updated_at: '2026-11-21T09:05:00',
    ...overrides,
  }
}

/** An organization as the API lists it, whose one open deal is dealRow(). */
export function organizationRow(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    id: 1,
    name: 'Harbor Logistics',
    website: 'https://harborlogistics.com',
    industry: 'Logistics',
    notes: 'Fleet of 400 trucks.',
    contact_count: 2,
    deal_count: 2,
    open_deal_count: 1,
    open_value: 72_000,
    created_at: '2026-09-14T10:30:00',
    updated_at: '2026-11-02T16:40:00',
    ...overrides,
  }
}

/** A named region of the page, such as a record page's Details panel. */
export const panel = (name: string) => screen.getByRole('region', { name })

/** A record page's Details panel as label and value pairs. */
export function details() {
  const list = within(panel('Details'))
  const definitions = list.getAllByRole('definition')
  return Object.fromEntries(list.getAllByRole('term').map((term, i) => [term.textContent, definitions[i].textContent]))
}

/** Every row of the named table as the text of its cells, headings first. */
export const tableRows = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .map((row) => Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent))

/** The named table's rows under its headings, as the text of their cells. */
export const bodyRows = (name: string) => tableRows(name).slice(1)

/** Gives Recharts a size to draw at for this test, since jsdom lays nothing out. Call it in beforeEach. */
export function stubChartSize(width = 400, height = 250) {
  const measure = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('recharts-wrapper') ? new DOMRect(0, 0, width, height) : measure.call(this)
  })
}

/** The drawn chart. Screen readers skip it and get its table instead. */
export const chart = () => document.querySelector<HTMLElement>('.recharts-wrapper')!

/** Moves the pointer onto the chart above one of its axis labels, such as "Oct", to show its tooltip. */
export async function pointAbove(label: string) {
  const x = Number(within(chart()).getByText(label).getAttribute('x'))
  await userEvent.pointer({ target: chart(), coords: { clientX: x, clientY: 120 } })
}

/** The tooltip's line that starts with `label`, such as "Won $61,500" for "Won". */
export const tooltipLine = (label: string) => within(chart()).getByText(label)
