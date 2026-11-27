import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { mockFetch } from '../test-utils'
import { CANT_REACH_SIGN_IN, WRONG_DETAILS } from './service'

// Built for Supabase, whose client is mocked at its edge (risk 14), so nothing here reaches it.
vi.mock('./config', () => ({
  SUPABASE_URL: 'https://accountable-tests.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key-for-tests',
  usesSupabase: true,
}))

/** Stands in for Supabase's client, which keeps one session and tells its listeners when it ends. */
const supabase = vi.hoisted(() => {
  let session: { access_token: string } | null = null
  let listeners: ((event: string) => void)[] = []
  const emit = (event: string) => listeners.forEach((listener) => listener(event))
  const startSession = async () => {
    session = { access_token: 'supabase-token-dana' }
    return { error: null as unknown }
  }
  /** What a sign-in gets: a new session, unless a test answers with Supabase's error or a throw. */
  let signInAnswer: () => Promise<{ error: unknown }> = startSession
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    signInWithPassword: vi.fn(() => signInAnswer()),
    signOut: vi.fn(async () => {
      session = null
      emit('SIGNED_OUT')
      return { error: null }
    }),
    onAuthStateChange: (listener: (event: string) => void) => {
      listeners.push(listener)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
  }
  return {
    createClient: vi.fn(() => ({ auth })),
    auth,
    reset() {
      session = null
      listeners = []
      signInAnswer = startSession
    },
    answerSignIn(answer: typeof signInAnswer) {
      signInAnswer = answer
    },
    /** Supabase renewed the token. */
    renew(token: string) {
      session = { access_token: token }
      emit('TOKEN_REFRESHED')
    },
    /** Supabase couldn't renew the token, so it dropped the session. */
    expire() {
      session = null
      emit('SIGNED_OUT')
    },
  }
})
vi.mock('@supabase/supabase-js', async (original) => ({
  ...(await original<typeof import('@supabase/supabase-js')>()),
  createClient: supabase.createClient,
}))

const DANA = 'dana.holt@example.com'

/** Loads the app's modules afresh and picks up the saved session, as a page load does. */
async function loadPage() {
  vi.resetModules()
  const session = await import('./session')
  const { api, queryClient } = await import('../lib/api')
  await session.startSession()
  const { result } = renderHook(() => session.useSession())
  return { ...session, api, queryClient, current: () => result.current }
}

async function signedIn() {
  const page = await loadPage()
  await act(() => page.signIn(DANA, 'accountable'))
  page.queryClient.setQueryData(['deals'], [{ id: 7, name: 'Harbor Logistics fleet analytics' }])
  return page
}

/** The Authorization header the last request sent, if any. */
const sentToken = () => (vi.mocked(fetch).mock.lastCall?.[1]?.headers as Record<string, string>).Authorization

beforeEach(() => {
  supabase.reset()
  mockFetch(() => ({ body: [] }))
})

test('the client has the project’s URL and publishable key, and never takes a session from the address', async () => {
  await loadPage()
  expect(supabase.createClient).toHaveBeenCalledExactlyOnceWith(
    'https://accountable-tests.supabase.co',
    'publishable-key-for-tests',
    { auth: { detectSessionInUrl: false } },
  )
})

test('signing in sends the email and password, then every request sends Supabase’s token, renewed', async () => {
  const page = await signedIn()
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({ email: DANA, password: 'accountable' })
  expect(page.current()).toEqual({ status: 'signed-in' })
  await page.api('/deals')
  expect(sentToken()).toBe('Bearer supabase-token-dana')

  act(() => supabase.renew('supabase-token-renewed'))
  expect(page.current()).toEqual({ status: 'signed-in' })
  await page.api('/deals')
  expect(sentToken()).toBe('Bearer supabase-token-renewed')
})

test('a session Supabase kept is picked up after a reload', async () => {
  await signedIn()
  const reloaded = await loadPage()
  expect(reloaded.current()).toEqual({ status: 'signed-in' })
})

test.each([
  [
    'a wrong email or password',
    new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    WRONG_DETAILS,
  ],
  ['an empty email', new AuthApiError('missing email or phone', 400, 'validation_failed'), WRONG_DETAILS],
  ['no connection', new AuthRetryableFetchError('Failed to fetch', 0), CANT_REACH_SIGN_IN],
  ['Supabase not working', new AuthRetryableFetchError('Service Unavailable', 503), CANT_REACH_SIGN_IN],
  [
    'too many tries',
    new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    CANT_REACH_SIGN_IN,
  ],
])('%s becomes its sign-in message', async (_case, error, message) => {
  supabase.answerSignIn(async () => ({ error }))
  const page = await loadPage()
  await act(() => expect(page.signIn(DANA, 'wrong')).rejects.toThrow(message))
  expect(page.current()).toEqual({ status: 'signed-out', ended: false })
})

test('a sign-in that throws can’t reach the sign-in service', async () => {
  supabase.answerSignIn(() => Promise.reject(new TypeError('Failed to fetch')))
  const page = await loadPage()
  await act(() => expect(page.signIn(DANA, 'accountable')).rejects.toThrow(CANT_REACH_SIGN_IN))
})

test('signing out ends the app’s session and Supabase’s, in this browser only', async () => {
  const page = await signedIn()
  await act(() => page.signOut())
  expect(supabase.auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })
  expect(page.current()).toEqual({ status: 'signed-out', ended: false })
  expect(page.queryClient.getQueryCache().getAll()).toEqual([])
})

test('a session Supabase can’t renew ends the app’s session, saying so', async () => {
  const page = await signedIn()
  act(() => supabase.expire())
  expect(page.current()).toEqual({ status: 'signed-out', ended: true })
  expect(page.queryClient.getQueryCache().getAll()).toEqual([])
})

test('a token the backend refuses ends Supabase’s session too', async () => {
  const page = await signedIn()
  mockFetch(() => ({ status: 401, body: { detail: 'Sign in to carry on.' } }))
  await act(() => expect(page.api('/deals')).rejects.toThrow())
  expect(page.current()).toEqual({ status: 'signed-out', ended: true })
  expect(supabase.auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })

  const reloaded = await loadPage()
  expect(reloaded.current()).toEqual({ status: 'signed-out', ended: false })
})
