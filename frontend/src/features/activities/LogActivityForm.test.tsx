import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockFetch, renderWithApp } from '../../test-utils'
import { LogActivityForm } from './LogActivityForm'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 22, 10, 0))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function logNote(description: string) {
  await userEvent.type(screen.getByLabelText('Description'), description)
  await userEvent.click(screen.getByRole('button', { name: 'Log activity' }))
}

describe('LogActivityForm', () => {
  test('left as it is, When is the time the activity is logged, not when the form appeared', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderWithApp(<LogActivityForm on={{ deal_id: 9 }} />)
    expect(screen.getByLabelText('When')).toHaveValue('2026-11-22T10:00')
    vi.setSystemTime(new Date(2026, 10, 22, 10, 30))
    await logNote('Called about the renewal')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ deal_id: 9, occurred_at: '2026-11-22T10:30:00' })
  })

  test('a time typed into When is the one sent', async () => {
    const calls = mockFetch(() => ({ status: 201, body: {} }))
    renderWithApp(<LogActivityForm on={{ contact_id: 3 }} />)
    const when = screen.getByLabelText('When')
    await userEvent.clear(when)
    await userEvent.type(when, '2026-11-21T09:05')
    vi.setSystemTime(new Date(2026, 10, 22, 10, 30))
    await logNote('Met at the conference')
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ contact_id: 3, occurred_at: '2026-11-21T09:05:00' })
  })
})
