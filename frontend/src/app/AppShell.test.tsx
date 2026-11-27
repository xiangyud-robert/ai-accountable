import { QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from 'radix-ui'
import { RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../auth/useMe'
import { SETTLE_MS } from '../features/search/queries'
import { createQueryClient } from '../lib/api'
import { mockFetch, renderWithApp, STAGES } from '../test-utils'
import { router } from './App'
import { AppShell } from './AppShell'

const SECTIONS = ['Dashboard', 'Organizations', 'Contacts', 'Deals', 'Pipeline']

const sections = () => within(screen.getByRole('navigation', { name: 'Sections' }))
const section = (name: string) => sections().getByRole('link', { name: new RegExp(`^${name}`) })

/** Who's signed in, which the session gate has loaded before the shell shows. */
const SIGNED_IN: [QueryKey, Me] = [
  ['me'],
  { id: 'user-dana', name: 'Dana Holt', email: 'dana.holt@example.com', initials: 'DH', timezone: null },
]

/** The shell at `route`, with lists of these lengths already loaded. */
function renderShell(route = '/', path = route, counts = { organizations: 3, contacts: 12, deals: 7 }) {
  const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))
  return renderWithApp(<AppShell />, {
    path,
    route,
    data: [
      SIGNED_IN,
      [['organizations'], list(counts.organizations)],
      [['contacts'], list(counts.contacts)],
      [['deals'], list(counts.deals)],
    ],
  })
}

describe('AppShell', () => {
  test('a skip link comes first, and goes to the main area', () => {
    renderShell()
    const skip = screen.getAllByRole('link')[0]
    expect(skip).toHaveTextContent('Skip to content')
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })

  test('the sidebar has the wordmark, its tagline and the five sections', () => {
    renderShell()
    expect(screen.getByRole('complementary')).toHaveTextContent(/^AccountableEvery deal, accounted for/)
    const links = sections().getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/organizations',
      '/contacts',
      '/deals',
      '/pipeline',
    ])
    // Each name, without the count some of them end with.
    expect(links.map((link) => link.textContent?.replace(/\d+$/, ''))).toEqual(SECTIONS)
  })

  test('the sidebar holds only the wordmark and the five sections, with no Dark mode switch', () => {
    renderShell()
    const sidebar = screen.getByRole('complementary')
    expect(within(sidebar).queryByRole('switch')).not.toBeInTheDocument()
    expect(sidebar).not.toHaveTextContent('Dark mode')
    // The five sections are all it has that Tab can reach.
    expect(sidebar.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(5)
  })

  test('Organizations, Contacts and Deals show how many records they have', () => {
    renderShell('/', '/', { organizations: 3, contacts: 12, deals: 0 })
    expect(section('Dashboard')).toHaveTextContent(/^Dashboard$/)
    expect(section('Organizations')).toHaveTextContent(/^Organizations3$/)
    expect(section('Contacts')).toHaveTextContent(/^Contacts12$/)
    expect(section('Deals')).toHaveTextContent(/^Deals0$/)
    expect(section('Pipeline')).toHaveTextContent(/^Pipeline$/)
  })

  test('the counts load from the server, and show once they have', async () => {
    const replies: Record<string, unknown[]> = { '/organizations': [{}, {}], '/contacts': [{}], '/deals': [{}, {}, {}] }
    const calls = mockFetch((_method, path) => ({ body: replies[path] }))
    renderWithApp(<AppShell />, { data: [SIGNED_IN] })
    expect(section('Organizations')).toHaveTextContent(/^Organizations$/)
    await waitFor(() => expect(section('Deals')).toHaveTextContent(/^Deals3$/))
    expect(section('Organizations')).toHaveTextContent(/^Organizations2$/)
    expect(section('Contacts')).toHaveTextContent(/^Contacts1$/)
    expect(calls.map((c) => c.path).sort()).toEqual(['/contacts', '/deals', '/organizations'])
  })

  test('marks the current section, including on a record’s own page', () => {
    renderShell('/contacts/4', '/contacts/:id')
    expect(section('Contacts')).toHaveAttribute('aria-current', 'page')
    for (const name of ['Dashboard', 'Organizations', 'Deals', 'Pipeline']) {
      expect(section(name)).not.toHaveAttribute('aria-current')
    }
  })

  test('the dashboard is only current on its own address', () => {
    renderShell('/')
    expect(section('Dashboard')).toHaveAttribute('aria-current', 'page')
    expect(sections().getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  test('choosing a section goes there', async () => {
    const { router } = renderShell('/')
    await userEvent.click(section('Pipeline'))
    expect(router.state.location.pathname).toBe('/pipeline')
  })
})

describe('the top bar', () => {
  const searchBox = () =>
    within(screen.getByRole('search', { name: 'Search' })).getByRole('combobox', { name: 'Search' })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('comes after the sidebar and before the page, outside the main area, so the skip link goes past it', () => {
    renderShell()
    const sidebar = screen.getByRole('complementary')
    const main = screen.getByRole('main')
    expect(sidebar).not.toContainElement(searchBox())
    expect(main).not.toContainElement(searchBox())
    expect(sidebar.compareDocumentPosition(searchBox()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(searchBox().compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('is on every page, Page not found included', async () => {
    mockFetch((_method, path) => {
      if (path === '/stages') return { body: STAGES }
      return path === '/organizations' || path === '/contacts' || path === '/deals'
        ? { body: [] }
        : { status: 404, body: { detail: 'Not found' } }
    })
    await act(() => router.navigate('/reports/2026'))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Tooltip.Provider>
          <RouterProvider router={router} />
        </Tooltip.Provider>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(searchBox()).toBeInTheDocument()
  })

  test('its results show each kind with the sidebar’s icon for it', async () => {
    // The search waits for typing to pause, so the clock is stopped and moved on by the test.
    // Testing Library moves a stopped clock on only when it sees Jest's, so it gets Vitest's.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const advanceTimersByTime = (ms: number) => vi.advanceTimersByTime(ms)
    vi.stubGlobal('jest', { advanceTimersByTime })
    const one = <T,>(result: T) => ({ total: 1, results: [result] })
    mockFetch(() => ({
      body: {
        organizations: one({ id: 1, name: 'Harbor Logistics', industry: 'Logistics' }),
        contacts: one({ id: 4, name: 'Sharon Hale', job_title: null, organization_name: 'Harbor Logistics' }),
        deals: one({ id: 12, name: 'Harbor fleet analytics', organization_name: null, stage: 'new', value: 5_000 }),
      },
    }))
    renderShell()
    await userEvent.setup({ advanceTimers: advanceTimersByTime }).type(searchBox(), 'har')
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
    await screen.findByRole('listbox', { name: 'Search results' })

    for (const kind of ['Organizations', 'Contacts', 'Deals']) {
      const result = within(screen.getByRole('group', { name: kind })).getByRole('option')
      expect(result.querySelector('svg')!.innerHTML).toBe(section(kind).querySelector('svg')!.innerHTML)
    }
  })
})
