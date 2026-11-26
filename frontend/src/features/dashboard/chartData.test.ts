import { describe, expect, test } from 'vitest'
import type { Dashboard, TimelineEntry } from '../../lib/types'
import { STAGES } from '../../test-utils'
import { funnel, groupRecent, moneyTicks, months, pipelineBars, summaries } from './chartData'

const DASHBOARD: Dashboard = {
  today: '2026-06-15',
  this_month: { month: '2026-06', revenue: 47_500, count: 1 },
  last_month: { month: '2026-05', revenue: 138_500, count: 2 },
  months: [
    { month: '2025-07', revenue: 0, count: 0 },
    ...['08', '09', '10', '11', '12'].map((m) => ({ month: `2025-${m}`, revenue: 10_000, count: 1 })),
    ...['01', '02', '03', '04'].map((m) => ({ month: `2026-${m}`, revenue: 20_000, count: 1 })),
    { month: '2026-05', revenue: 138_500, count: 2 },
    { month: '2026-06', revenue: 47_500, count: 1 },
  ],
  last_12_months: { count: 12, value: 316_000 },
  open: { count: 19, value: 804_500, expected: 384_775 },
  by_stage: [
    { stage: 'new', count: 5, value: 131_000, expected: 13_100 },
    { stage: 'qualified', count: 5, value: 169_000, expected: 42_250 },
    { stage: 'proposal', count: 5, value: 245_500, expected: 132_250 },
    { stage: 'negotiation', count: 4, value: 259_000, expected: 197_175 },
  ],
  funnel: [
    { stage: 'new', count: 35, value: 1_600_000 },
    { stage: 'qualified', count: 29, value: 1_456_000 },
    { stage: 'proposal', count: 23, value: 1_280_000 },
    { stage: 'negotiation', count: 16, value: 864_000 },
    { stage: 'won', count: 11, value: 544_000 },
  ],
  lost: { count: 5, value: 268_000 },
  follow_ups: [
    {
      id: 1,
      type: 'call',
      description: 'Chase',
      follow_up_date: '2026-06-06',
      days: -9,
      overdue: true,
      contact_id: null,
      contact_name: null,
      deal_id: 3,
      deal_name: 'Sable',
    },
    {
      id: 2,
      type: 'email',
      description: 'Send',
      follow_up_date: '2026-06-16',
      days: 1,
      overdue: false,
      contact_id: 4,
      contact_name: 'Grace',
      deal_id: null,
      deal_name: null,
    },
  ],
  recent: [],
}

const entry = (key: string, at: string) => ({ key, at, text: key }) as TimelineEntry

describe('chart data', () => {
  test('the 12 months, with short and long labels', () => {
    const points = months(DASHBOARD)
    expect(points).toHaveLength(12)
    expect(points[0]).toEqual({ month: '2025-07', label: 'Jul', long: 'July 2025', revenue: 0, count: 0 })
    expect(points.at(-1)).toEqual({ month: '2026-06', label: 'Jun', long: 'June 2026', revenue: 47_500, count: 1 })
  })

  test('the funnel, with each stage’s share of New’s value', () => {
    expect(funnel(DASHBOARD, STAGES).map((s) => [s.name, s.count, s.share])).toEqual([
      ['New', 35, 100],
      ['Qualified', 29, 91],
      ['Proposal', 23, 80],
      ['Negotiation', 16, 54],
      ['Won', 11, 34],
    ])
    expect(funnel(DASHBOARD, STAGES)[0].fill).toBe('var(--color-stage-new)')
  })

  test('an empty funnel has no shares', () => {
    const empty = { ...DASHBOARD, funnel: DASHBOARD.funnel.map((s) => ({ ...s, count: 0, value: 0 })) }
    expect(funnel(empty, STAGES).every((s) => s.share === 0)).toBe(true)
  })

  test('each open stage’s bar: the expected part, and the rest above it', () => {
    const bars = pipelineBars(DASHBOARD, STAGES)
    expect(bars.map((b) => [b.name, b.value, b.expected, b.rest])).toEqual([
      ['New', 131_000, 13_100, 117_900],
      ['Qualified', 169_000, 42_250, 126_750],
      ['Proposal', 245_500, 132_250, 113_250],
      ['Negotiation', 259_000, 197_175, 61_825],
    ])
    expect(bars[3]).toMatchObject({
      color: 'var(--color-stage-negotiation)',
      tint: 'var(--color-stage-negotiation-tint)',
    })
  })

  test('the summaries in words', () => {
    expect(summaries(DASHBOARD)).toEqual({
      revenue: '$316,000 won in the last 12 months',
      funnel: '$544,000 of $1,600,000 reached Won',
      pipeline: '$804,500 open, $384,775 expected',
      lost: '5 deals, $268,000',
    })
  })
})

describe('recent activity', () => {
  test('is grouped under Today, Yesterday and Earlier', () => {
    const groups = groupRecent(
      [
        entry('a', '2026-06-15T09:40:00'),
        entry('b', '2026-06-15T00:05:00'),
        entry('c', '2026-06-14T23:59:00'),
        entry('d', '2026-06-13T10:00:00'),
        entry('e', '2025-12-01T10:00:00'),
      ],
      '2026-06-15',
    )
    expect(groups.map((g) => [g.title, g.entries.map((e) => e.key)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Earlier', ['d', 'e']],
    ])
  })

  test('leaves out an empty group', () => {
    const groups = groupRecent([entry('d', '2026-06-01T10:00:00')], '2026-06-15')
    expect(groups.map((g) => g.title)).toEqual(['Earlier'])
  })
})

describe('money axis', () => {
  test('round steps, the top at or above the highest value', () => {
    expect(moneyTicks(138_500)).toEqual([0, 50_000, 100_000, 150_000])
    expect(moneyTicks(250_000)).toEqual([0, 100_000, 200_000, 300_000])
    expect(moneyTicks(60_000)).toEqual([0, 20_000, 40_000, 60_000])
    expect(moneyTicks(7_000)).toEqual([0, 2_500, 5_000, 7_500])
    expect(moneyTicks(0)).toEqual([0])
  })
})
