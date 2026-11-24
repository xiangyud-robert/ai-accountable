// Turns the dashboard's response into each chart's data. Every figure comes from the server;
// this only shapes it, adds labels, and works out shares.

import { differenceInCalendarDays, parseISO } from 'date-fns'
import { money, monthLong, monthShort, plural } from '../../lib/format'
import { stageColor, stageTint } from '../../lib/stages'
import type { Dashboard, Stage, StageKey, TimelineEntry } from '../../lib/types'

export type MonthPoint = { month: string; label: string; long: string; revenue: number; count: number }

/** The 12 months, oldest first, for the revenue line and the deals-won bars. */
export function months(dashboard: Dashboard): MonthPoint[] {
  return dashboard.months.map((m) => ({
    month: m.month,
    label: monthShort(m.month),
    long: monthLong(m.month),
    revenue: m.revenue,
    count: m.count,
  }))
}

export type FunnelStep = {
  stage: StageKey
  name: string
  count: number
  value: number
  /** The share of New's value that reaches this stage, as a whole percentage. */
  share: number
  fill: string
}

export function funnel(dashboard: Dashboard, stages: Stage[]): FunnelStep[] {
  const first = dashboard.funnel[0]?.value ?? 0
  return dashboard.funnel.map((step) => ({
    stage: step.stage,
    name: stages.find((s) => s.key === step.stage)!.name,
    count: step.count,
    value: step.value,
    share: first > 0 ? Math.round((step.value / first) * 100) : 0,
    fill: stageColor(step.stage),
  }))
}

export type StageBar = {
  stage: StageKey
  name: string
  count: number
  value: number
  expected: number
  /** The value that isn't expected, drawn in the tint above the solid expected part. */
  rest: number
  color: string
  tint: string
}

export function pipelineBars(dashboard: Dashboard, stages: Stage[]): StageBar[] {
  return dashboard.by_stage.map((s) => ({
    stage: s.stage,
    name: stages.find((st) => st.key === s.stage)!.name,
    count: s.count,
    value: s.value,
    expected: s.expected,
    rest: Math.max(0, s.value - s.expected),
    color: stageColor(s.stage),
    tint: stageTint(s.stage),
  }))
}

/** The one-line summaries in words, so no figure is given by color or shape alone. */
export function summaries(dashboard: Dashboard) {
  const { last_12_months: year, open } = dashboard
  const funnelFirst = dashboard.funnel[0]
  const funnelWon = dashboard.funnel.at(-1)
  return {
    revenue: `${money(year.value)} won in the last 12 months`,
    funnel: funnelFirst && funnelWon ? `${money(funnelWon.value)} of ${money(funnelFirst.value)} reached Won` : '',
    pipeline: `${money(open.value)} open, ${money(open.expected)} expected`,
    lost: `${plural(dashboard.lost.count, 'deal')}, ${money(dashboard.lost.value)}`,
  }
}

export type RecentGroup = { title: 'Today' | 'Yesterday' | 'Earlier'; entries: TimelineEntry[] }

/** Recent activity under Today, Yesterday and Earlier, leaving out an empty group. */
export function groupRecent(entries: TimelineEntry[], today: string): RecentGroup[] {
  const groups: RecentGroup[] = [
    { title: 'Today', entries: [] },
    { title: 'Yesterday', entries: [] },
    { title: 'Earlier', entries: [] },
  ]
  for (const entry of entries) {
    const days = differenceInCalendarDays(parseISO(today), parseISO(entry.at))
    groups[days <= 0 ? 0 : days === 1 ? 1 : 2].entries.push(entry)
  }
  return groups.filter((g) => g.entries.length > 0)
}

/** Round steps for a money axis, such as 0, 50K, 100K and 150K: three steps of 1, 2, 2.5 or
 *  5 times a power of ten, the top one at or above the highest value. */
export function moneyTicks(max: number): number[] {
  if (max <= 0) return [0]
  const rough = max / 3
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)!
  return [0, step, step * 2, step * 3]
}
