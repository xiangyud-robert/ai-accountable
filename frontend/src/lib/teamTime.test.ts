import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { format } from 'date-fns'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { setTeamZone, teamNow, teamTodayISO } from './teamTime'

// The tests run with this browser in Los Angeles (vite.config.ts). At 20:30 UTC on June 15,
// it's 1:30 PM on June 15 there, and already 5:30 AM on June 16 in Tokyo.
const MOMENT = new Date('2026-06-15T20:30:45.250Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MOMENT)
})

afterEach(() => {
  setTeamZone(null)
  vi.useRealTimers()
})

const clock = (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss.SSS')

describe('the team’s clock', () => {
  test('with the team in Tokyo, today and now are Tokyo’s, not this browser’s', () => {
    setTeamZone('Asia/Tokyo')
    expect(teamTodayISO()).toBe('2026-06-16')
    expect(clock(teamNow())).toBe('2026-06-16 05:30:45.250')
  })

  test('without a zone, today and now are this browser’s', () => {
    setTeamZone(null)
    expect(teamTodayISO()).toBe('2026-06-15')
    expect(clock(teamNow())).toBe('2026-06-15 13:30:45.250')
  })

  test('a team in this browser’s own zone gets the browser’s clock', () => {
    setTeamZone('America/Los_Angeles')
    expect(clock(teamNow())).toBe('2026-06-15 13:30:45.250')
  })

  test('five past twelve at night for the team reads 00:05, not 24:05', () => {
    vi.setSystemTime(new Date('2026-06-15T15:05:00Z'))
    setTeamZone('Asia/Tokyo')
    expect(clock(teamNow())).toBe('2026-06-16 00:05:00.000')
  })

  test('it follows the clock as it moves', () => {
    setTeamZone('Europe/London')
    expect(clock(teamNow())).toBe('2026-06-15 21:30:45.250')
    vi.setSystemTime(new Date('2026-06-15T23:10:00Z'))
    expect(teamTodayISO()).toBe('2026-06-16')
  })
})

describe('nothing reads this browser’s clock instead of the team’s', () => {
  const SRC = join(__dirname, '..')

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return /\.tsx?$/.test(name) ? [path] : []
    })
  }

  test('no new Date() with no arguments in the features or in format.ts', () => {
    const files = [...sourceFiles(join(SRC, 'features')), join(SRC, 'lib', 'format.ts')]
    const found = files.flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, i) => (/new Date\(\s*\)/.test(line) ? [`${relative(SRC, path)}:${i + 1}`] : [])),
    )
    expect(files.length).toBeGreaterThan(50)
    expect(found).toEqual([])
  })
})
