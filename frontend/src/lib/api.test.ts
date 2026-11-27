import { MutationObserver, QueryObserver } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockFetch } from '../test-utils'
import {
  FieldErrors,
  NotFound,
  Refused,
  UNREACHABLE_MESSAGE,
  Unreachable,
  api,
  connectSession,
  queryClient,
} from './api'

/** The options the last request was sent with. */
const lastRequest = () => vi.mocked(fetch).mock.lastCall?.[1]

/** Called when the server refuses the session's token. */
let refused = vi.fn()

// Signed in as Dana, unless a test connects another session.
beforeEach(() => {
  refused = vi.fn()
  connectSession({ token: async () => 'token-dana', refused })
})

afterEach(() => queryClient.clear())

describe('api', () => {
  test('a read sends no body, only the token, and gives back the JSON', async () => {
    const calls = mockFetch(() => ({ body: [{ id: 7, name: 'Harbor Logistics fleet' }] }))
    await expect(api('/deals')).resolves.toEqual([{ id: 7, name: 'Harbor Logistics fleet' }])
    expect(calls).toEqual([{ method: 'GET', path: '/deals', body: undefined }])
    expect(lastRequest()).toMatchObject({ headers: { Authorization: 'Bearer token-dana' }, body: undefined })
  })

  test('a change sends its body as JSON, with the token', async () => {
    const calls = mockFetch(() => ({ body: { id: 7 } }))
    await api('/deals/7', { method: 'PATCH', body: { value: 72000 } })
    expect(calls).toEqual([{ method: 'PATCH', path: '/deals/7', body: { value: 72000 } }])
    expect(lastRequest()?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token-dana' })
  })

  test('a delete, answered with no content, gives back nothing', async () => {
    mockFetch(() => ({ status: 204 }))
    await expect(api('/deals/7', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  test('fields the server turns down come back with a message for each', async () => {
    mockFetch(() => ({ status: 422, body: { errors: { name: 'Enter a name', value: 'Enter an amount' } } }))
    const error = await api('/deals', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(FieldErrors)
    expect(error).toMatchObject({
      message: 'Some fields need changing',
      errors: { name: 'Enter a name', value: 'Enter an amount' },
    })
  })

  test('a 422 with no field messages still counts as turned-down fields', async () => {
    mockFetch(() => ({ status: 422, body: { detail: 'Invalid' } }))
    const error = await api('/deals', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(FieldErrors)
    expect(error).toMatchObject({ errors: {} })
  })

  test('a record that doesn’t exist is NotFound', async () => {
    mockFetch(() => ({ status: 404, body: { detail: 'Not found' } }))
    await expect(api('/deals/99')).rejects.toBeInstanceOf(NotFound)
  })

  test('an error from the server, or no answer at all, can’t reach the server', async () => {
    mockFetch(() => ({ status: 500 }))
    await expect(api('/deals')).rejects.toEqual(new Unreachable(UNREACHABLE_MESSAGE))

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api('/deals')).rejects.toEqual(new Unreachable(UNREACHABLE_MESSAGE))
  })
})

describe('the session', () => {
  const authorization = () => (lastRequest()?.headers as Record<string, string>).Authorization

  test('every request sends the token the session has at the time, and none without one', async () => {
    let token: string | null = 'token-before-renewal'
    connectSession({ token: async () => token, refused })
    mockFetch(() => ({ status: 204 }))

    await api('/deals')
    expect(authorization()).toBe('Bearer token-before-renewal')
    token = 'token-after-renewal'
    await api('/deals', { method: 'POST', body: { name: 'Cobalt Bank pilot' } })
    expect(authorization()).toBe('Bearer token-after-renewal')
    await api('/deals/7', { method: 'DELETE' })
    expect(authorization()).toBe('Bearer token-after-renewal')

    token = null
    await api('/deals')
    expect(lastRequest()?.headers).toEqual({})
  })

  test('a 401 ends the session', async () => {
    mockFetch(() => ({ status: 401, body: { detail: 'Sign in to carry on.' } }))
    await expect(api('/deals')).rejects.toBeInstanceOf(Refused)
    expect(refused).toHaveBeenCalledOnce()
  })

  test('the stand-in’s own “Wrong email or password.” doesn’t, and a sign-in sends no token', async () => {
    const calls = mockFetch(() => ({ status: 401, body: { detail: 'Wrong email or password.' } }))
    const details = { email: 'dana.holt@example.com', password: 'wrong' }
    await expect(api('/stand-in/sign-in', { method: 'POST', body: details, signingIn: true })).rejects.toBeInstanceOf(
      Refused,
    )
    expect(refused).not.toHaveBeenCalled()
    expect(calls).toEqual([{ method: 'POST', path: '/stand-in/sign-in', body: details }])
    expect(lastRequest()?.headers).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('the query client', () => {
  // The delay between tries is left out, so the tests don't wait for it. Whether to try again
  // is still the app's own rule.
  const fetchDeals = () => queryClient.fetchQuery({ queryKey: ['deals'], queryFn: () => api('/deals'), retryDelay: 0 })

  test('asks once more when it can’t reach the server, then gives up', async () => {
    const calls = mockFetch(() => ({ status: 500 }))
    await expect(fetchDeals()).rejects.toBeInstanceOf(Unreachable)
    expect(calls).toHaveLength(2)
  })

  test('doesn’t ask again when the token is refused', async () => {
    const calls = mockFetch(() => ({ status: 401 }))
    await expect(fetchDeals()).rejects.toBeInstanceOf(Refused)
    expect(calls).toHaveLength(1)
  })

  test('doesn’t ask again for a record that doesn’t exist', async () => {
    const calls = mockFetch(() => ({ status: 404 }))
    await expect(fetchDeals()).rejects.toBeInstanceOf(NotFound)
    expect(calls).toHaveLength(1)
  })

  test('refetches what’s on screen after every successful change, and not after a failed one', async () => {
    let saveStatus = 201
    const calls = mockFetch((method) => (method === 'GET' ? { body: [] } : { status: saveStatus, body: {} }))
    const deals = new QueryObserver(queryClient, { queryKey: ['deals'], queryFn: () => api('/deals') })
    const stopWatching = deals.subscribe(() => {})
    const requests = () => calls.map((c) => `${c.method} ${c.path}`)
    await waitFor(() => expect(requests()).toEqual(['GET /deals']))

    const save = () =>
      new MutationObserver(queryClient, {
        mutationFn: () => api('/deals', { method: 'POST', body: { name: 'Cobalt Bank pilot' } }),
      }).mutate()

    await save()
    await waitFor(() => expect(requests()).toEqual(['GET /deals', 'POST /deals', 'GET /deals']))

    saveStatus = 500
    await expect(save()).rejects.toBeInstanceOf(Unreachable)
    await new Promise((resolve) => setTimeout(resolve))
    expect(requests()).toEqual(['GET /deals', 'POST /deals', 'GET /deals', 'POST /deals'])
    stopWatching()
  })
})
