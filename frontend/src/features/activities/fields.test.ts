import { afterEach, describe, expect, test, vi } from 'vitest'
import { localMinute, toApiTime } from './fields'

afterEach(() => vi.useRealTimers())

describe('localMinute', () => {
  test('is now on this computer, to the minute', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, 8, 3, 45))
    expect(localMinute()).toBe('2026-01-05T08:03')
  })

  test('is a stored time to the minute', () => {
    expect(localMinute('2026-11-21T09:05:30')).toBe('2026-11-21T09:05')
  })
})

describe('toApiTime', () => {
  test('adds the seconds to a time given to the minute', () => {
    expect(toApiTime('2026-11-21T09:05')).toBe('2026-11-21T09:05:00')
  })

  test('leaves a time that has its seconds as it is', () => {
    expect(toApiTime('2026-11-21T09:05:30')).toBe('2026-11-21T09:05:30')
  })
})
