import { afterEach, describe, expect, test, vi } from 'vitest'
import { setTeamZone } from '../../lib/teamTime'
import { localMinute, toApiTime } from './fields'

afterEach(() => {
  setTeamZone(null)
  vi.useRealTimers()
})

describe('localMinute', () => {
  test('is now, to the minute', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, 8, 3, 45))
    expect(localMinute()).toBe('2026-01-05T08:03')
  })

  test('is now on the team’s clock, a day ahead of this browser’s', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // 1:30 PM on June 15 in Los Angeles, where this browser is, and 5:30 AM on June 16 in Tokyo.
    vi.setSystemTime(new Date('2026-06-15T20:30:45Z'))
    setTeamZone('Asia/Tokyo')
    expect(localMinute()).toBe('2026-06-16T05:30')
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
