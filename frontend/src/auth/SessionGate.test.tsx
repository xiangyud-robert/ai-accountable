import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBrowserRouter, RouterProvider, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, queryClient, UNREACHABLE_MESSAGE } from '../lib/api'
import { setTeamZone, teamTodayISO } from '../lib/teamTime'
import { mockFetch } from '../test-utils'
import { SessionGate } from './SessionGate'
import { signIn, startSession } from './session'
import type { Me } from './useMe'

const DANA: Me = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Dana Holt',
  email: 'dana.holt@example.com',
  initials: 'DH',
  timezone: 'Asia/Tokyo',
}

/** The team's date each time a deal page drew. */
let datesDrawn: string[] = []

function DealPage() {
  const { id } = useParams()
  const deal = useQuery({ queryKey: ['deals', id], queryFn: () => api<{ name: string }>(`/deals/${id}`) })
  datesDrawn.push(teamTodayISO())
  return <h1>{deal.data?.name ?? 'Loading the deal'}</h1>
}

/** The app's providers and a browser router, as main.tsx has them, opened at `address`. */
function openApp(address: string) {
  window.history.pushState({}, '', address)
  const router = createBrowserRouter([
    { path: '/deals/:id', element: <DealPage /> },
    { path: '*', element: <h1>Another page</h1> },
  ])
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionGate>
        <RouterProvider router={router} />
      </SessionGate>
    </QueryClientProvider>,
  )
}

type Reply = { status?: number; body?: unknown }

function usualReply(path: string): Reply {
  if (path === '/stand-in/sign-in') return { body: { access_token: 'token-dana', expires_at: 1764200000 } }
  if (path === '/me') return { body: DANA }
  return { body: { name: 'Harbor Logistics fleet analytics' } }
}

/** The API, signing in through the stand-in. `answer` can answer a path itself, such as with a 401. */
function serveApi(answer: (path: string) => Reply | undefined | Promise<Reply | undefined> = () => undefined) {
  return mockFetch(async (_method, path) => (await answer(path)) ?? usualReply(path))
}

const signInHeading = () => screen.queryByRole('heading', { level: 1, name: 'Sign in' })

beforeEach(() => {
  datesDrawn = []
})

afterEach(() => {
  queryClient.clear()
  setTeamZone(null)
  vi.useRealTimers()
  window.history.replaceState({}, '', '/')
})

describe('SessionGate', () => {
  test('while it checks the saved session, shows nothing but the background', async () => {
    serveApi()
    const checking = startSession()
    const { container } = openApp('/deals/12')
    expect(container).toBeEmptyDOMElement()
    await act(() => checking)
    expect(signInHeading()).toBeInTheDocument()
  })

  test.each(['/', '/deals/12', '/no-such-page'])(
    'signed out, shows the sign-in screen at %s, and asks the API for nothing',
    async (address) => {
      const calls = serveApi()
      await startSession()
      openApp(address)
      expect(signInHeading()).toBeInTheDocument()
      expect(screen.queryByText(/Harbor Logistics|Another page/)).not.toBeInTheDocument()
      expect(window.location.pathname).toBe(address)
      expect(calls).toEqual([])
    },
  )

  test('signed in, shows the app at the same address, once /api/me has set the team’s zone', async () => {
    // 20:30 UTC on June 15 is still June 15 in Los Angeles, where the tests run, but June 16 in Tokyo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-15T20:30:00Z'))
    let answerMe = () => {}
    const meAnswered = new Promise<void>((resolve) => (answerMe = resolve))
    serveApi(async (path) => {
      if (path === '/me') await meAnswered
      return undefined
    })
    await startSession()
    await signIn(DANA.email, 'accountable')

    const { container } = openApp('/deals/12')
    expect(container).toBeEmptyDOMElement()
    await act(async () => answerMe())
    expect(await screen.findByRole('heading', { name: 'Harbor Logistics fleet analytics' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/deals/12')
    expect(new Set(datesDrawn)).toEqual(new Set(['2026-06-16']))
  })

  test('a 401 shows the sign-in screen saying the session ended, and signing in returns to the same page', async () => {
    let refusing = false
    serveApi(() => (refusing ? { status: 401, body: { detail: 'Sign in to carry on.' } } : undefined))
    await startSession()
    await signIn(DANA.email, 'accountable')
    openApp('/deals/12')
    expect(await screen.findByRole('heading', { name: 'Harbor Logistics fleet analytics' })).toBeInTheDocument()

    refusing = true
    await act(() => queryClient.invalidateQueries())
    expect(await screen.findByText('Your session has ended. Sign in again to carry on.')).toBeInTheDocument()
    expect(screen.queryByText('Harbor Logistics fleet analytics')).not.toBeInTheDocument()

    refusing = false
    await userEvent.type(screen.getByLabelText('Email'), DANA.email)
    await userEvent.type(screen.getByLabelText('Password'), 'accountable{Enter}')
    expect(await screen.findByRole('heading', { name: 'Harbor Logistics fleet analytics' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/deals/12')
  })

  test('says so if the server can’t be reached for the person', async () => {
    serveApi((path) => (path === '/me' ? { status: 500 } : undefined))
    // The app asks once more before giving up. The wait between is left out, so the test doesn't wait for it.
    queryClient.setQueryDefaults(['me'], { retryDelay: 0 })
    await startSession()
    await signIn(DANA.email, 'accountable')
    openApp('/deals/12')
    expect(await screen.findByRole('heading', { level: 1, name: UNREACHABLE_MESSAGE })).toBeInTheDocument()
    expect(screen.queryByText(/Harbor Logistics/)).not.toBeInTheDocument()
  })
})
