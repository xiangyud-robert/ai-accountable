import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { mockFetch } from '../test-utils'

const DANA = 'dana.holt@example.com'

/** Loads the app's modules afresh and picks up the saved session, as a page load does, so nothing
 *  carries over in memory from before. */
async function loadPage() {
  vi.resetModules()
  const session = await import('./session')
  const { api, queryClient } = await import('../lib/api')
  await session.startSession()
  const { result } = renderHook(() => session.useSession())
  return { ...session, api, queryClient, current: () => result.current }
}

/** The Authorization header the last request sent, if any. */
const sentToken = () => (vi.mocked(fetch).mock.lastCall?.[1]?.headers as Record<string, string>).Authorization

beforeEach(() => {
  mockFetch((_method, path) =>
    path === '/stand-in/sign-in' ? { body: { access_token: 'token-dana', expires_at: 1764200000 } } : { body: [] },
  )
})

test('signing out ends the session and empties the query cache', async () => {
  const page = await loadPage()
  expect(page.current()).toEqual({ status: 'signed-out', ended: false })
  await act(() => page.signIn(DANA, 'accountable'))
  expect(page.current()).toEqual({ status: 'signed-in' })
  page.queryClient.setQueryData(['deals'], [{ id: 7, name: 'Harbor Logistics fleet analytics' }])

  await act(() => page.signOut())
  expect(page.current()).toEqual({ status: 'signed-out', ended: false })
  expect(page.queryClient.getQueryCache().getAll()).toEqual([])
  await page.api('/deals')
  expect(sentToken()).toBeUndefined()
})

test('the stand-in’s token is kept across a reload and dropped on sign-out', async () => {
  const first = await loadPage()
  await act(() => first.signIn(DANA, 'accountable'))

  const reloaded = await loadPage()
  expect(reloaded.current()).toEqual({ status: 'signed-in' })
  await reloaded.api('/deals')
  expect(sentToken()).toBe('Bearer token-dana')
  await act(() => reloaded.signOut())

  const afterSignOut = await loadPage()
  expect(afterSignOut.current()).toEqual({ status: 'signed-out', ended: false })
})

test('a refused token ends the session, saying so, empties the cache and isn’t kept', async () => {
  const page = await loadPage()
  await act(() => page.signIn(DANA, 'accountable'))
  page.queryClient.setQueryData(['deals'], [{ id: 7, name: 'Harbor Logistics fleet analytics' }])

  mockFetch(() => ({ status: 401, body: { detail: 'Sign in to carry on.' } }))
  await act(() => expect(page.api('/deals')).rejects.toThrow())
  expect(page.current()).toEqual({ status: 'signed-out', ended: true })
  expect(page.queryClient.getQueryCache().getAll()).toEqual([])

  const reloaded = await loadPage()
  expect(reloaded.current()).toEqual({ status: 'signed-out', ended: false })
})
