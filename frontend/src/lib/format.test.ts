import { describe, expect, test } from 'vitest'
import {
  dueLabel,
  followUpLabel,
  longDate,
  money,
  shortDate,
  shortMoney,
  timelineTime,
  todayISO,
} from './format'

// Vitest runs in America/Los_Angeles (vite.config.ts), where a date read as the start of a UTC day
// would show as the day before.
const NOW = new Date(2026, 10, 22, 15, 0) // Nov 22, 2026, 3:00 PM local

describe('money', () => {
  test('full amounts', () => {
    expect(money(12500)).toBe('$12,500')
    expect(money(0)).toBe('$0')
    expect(money(1234567)).toBe('$1,234,567')
    expect(money(4073.85)).toBe('$4,074')
  })

  test('short amounts for tight spaces', () => {
    expect(shortMoney(1_200_000)).toBe('$1.2M')
    expect(shortMoney(48_000)).toBe('$48K')
    expect(shortMoney(47_500)).toBe('$47.5K')
    expect(shortMoney(131_000)).toBe('$131K')
    expect(shortMoney(13_100)).toBe('$13.1K')
    expect(shortMoney(999_999)).toBe('$1M')
    expect(shortMoney(950)).toBe('$950')
    expect(shortMoney(0)).toBe('$0')
  })
})

describe('dates', () => {
  test('runs in America/Los_Angeles with no day shifted', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Los_Angeles')
    expect(longDate('2026-06-15')).toBe('Jun 15, 2026')
    expect(longDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(todayISO(new Date(2026, 10, 22, 23, 59))).toBe('2026-11-22')
    expect(todayISO(new Date(2026, 10, 22, 0, 1))).toBe('2026-11-22')
  })

  test('the year is left out when it is this year', () => {
    expect(shortDate('2026-12-09', NOW)).toBe('Dec 9')
    expect(shortDate('2027-02-12', NOW)).toBe('Feb 12, 2027')
    expect(shortDate('2025-11-30', NOW)).toBe('Nov 30, 2025')
  })

  test('timeline times', () => {
    expect(timelineTime('2026-11-22T14:30:00', NOW)).toBe('Today, 2:30 PM')
    expect(timelineTime('2026-11-22T00:05:00', NOW)).toBe('Today, 12:05 AM')
    expect(timelineTime('2026-11-21T09:05:00', NOW)).toBe('Yesterday, 9:05 AM')
    expect(timelineTime('2026-11-12T14:30:00', NOW)).toBe('Nov 12, 2:30 PM')
    expect(timelineTime('2025-11-12T14:30:00', NOW)).toBe('Nov 12, 2025, 2:30 PM')
  })
})

describe('due labels', () => {
  test('from days until it is due', () => {
    expect(dueLabel(-1)).toBe('1 day overdue')
    expect(dueLabel(-3)).toBe('3 days overdue')
    expect(dueLabel(0)).toBe('Due today')
    expect(dueLabel(1)).toBe('Due tomorrow')
    expect(dueLabel(4)).toBe('Due in 4 days')
  })

  test('follow-up labels in a timeline', () => {
    expect(followUpLabel('2026-11-25', false, false, NOW)).toBe('Follow up Nov 25')
    expect(followUpLabel('2026-11-22', false, false, NOW)).toBe('Follow up Nov 22')
    expect(followUpLabel('2026-11-18', false, true, NOW)).toBe('Overdue since Nov 18')
    expect(followUpLabel('2026-11-18', true, false, NOW)).toBe('Done')
  })
})
