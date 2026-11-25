// The pipeline's pure functions. They apply the rules the server applies (R1 to R5), so
// the board changes as soon as a card drops. The server's answer then replaces them.

import type { DealRow, Stage, StageKey } from '../../lib/types'

export type BoardColumn = {
  stage: Stage
  deals: DealRow[]
  count: number
  value: number
  /** Expected revenue, for open columns. */
  expected: number
}

export type Totals = { count: number; value: number; expected: number }

const byPosition = (a: DealRow, b: DealRow) => a.position - b.position || a.id - b.id

/** R1: an open deal whose close date is before today. */
export function isLate(stage: Stage, closeDate: string, today: string): boolean {
  return stage.open && closeDate < today
}

/** The deals in one stage's column, top to bottom. */
export function columnOf(deals: DealRow[], stage: StageKey): DealRow[] {
  return deals.filter((d) => d.stage === stage).sort(byPosition)
}

/**
 * The deals after one is moved to `index` in `toStage`'s column, as the server will have
 * them (R3, R5). The index is where the card ends up, and is clamped to the column.
 * A new stage takes its usual probability, and Won or Lost sets today as the close date.
 * Both columns are renumbered from 0.
 */
export function moveDeal(
  deals: DealRow[],
  stages: Stage[],
  id: number,
  toStage: StageKey,
  index: number,
  today: string,
): DealRow[] {
  const deal = deals.find((d) => d.id === id)
  if (!deal) return deals
  const target = stages.find((s) => s.key === toStage)!
  let moved = deal
  if (deal.stage !== toStage) {
    const probability = target.probability
    const closeDate = target.open ? deal.close_date : today
    moved = {
      ...deal,
      stage: toStage,
      probability,
      close_date: closeDate,
      expected: (deal.value * probability) / 100,
      late: isLate(target, closeDate, today),
    }
  }

  const column = columnOf(deals, toStage).filter((d) => d.id !== id)
  column.splice(Math.max(0, Math.min(index, column.length)), 0, moved)
  const renumbered = new Map<number, DealRow>()
  column.forEach((d, position) => renumbered.set(d.id, d.position === position && d !== moved ? d : { ...d, position }))
  if (deal.stage !== toStage) {
    columnOf(deals, deal.stage)
      .filter((d) => d.id !== id)
      .forEach((d, position) => renumbered.set(d.id, d.position === position ? d : { ...d, position }))
  }

  const order = new Map(stages.map((s) => [s.key, s.order]))
  return deals
    .map((d) => renumbered.get(d.id) ?? d)
    .sort((a, b) => order.get(a.stage)! - order.get(b.stage)! || byPosition(a, b))
}

/**
 * The deals with one put back as it was in `before`, at its old place, when its move
 * couldn't be saved. Any card moved since stays where it is.
 */
export function putBack(deals: DealRow[], before: DealRow[], stages: Stage[], id: number, today: string): DealRow[] {
  const old = before.find((d) => d.id === id)
  if (!old) return deals
  const index = columnOf(before, old.stage).findIndex((d) => d.id === id)
  // moveDeal gives the new stage's usual probability, so the deal's own figures come back after.
  return moveDeal(deals, stages, id, old.stage, index, today).map((d) => (d.id === id ? { ...old, position: d.position } : d))
}

/** Each stage's column with its figures. Expected revenue counts open deals only (R2). */
export function boardColumns(deals: DealRow[], stages: Stage[]): BoardColumn[] {
  return [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const column = columnOf(deals, stage.key)
      return {
        stage,
        deals: column,
        count: column.length,
        value: column.reduce((sum, d) => sum + d.value, 0),
        expected: stage.open ? column.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0) : 0,
      }
    })
}

/** The board's figures: open deals only (R1, R2). */
export function boardTotals(deals: DealRow[], stages: Stage[]): Totals {
  const open = new Set(stages.filter((s) => s.open).map((s) => s.key))
  return deals
    .filter((d) => open.has(d.stage))
    .reduce(
      (totals, d) => ({
        count: totals.count + 1,
        value: totals.value + d.value,
        expected: totals.expected + (d.value * d.probability) / 100,
      }),
      { count: 0, value: 0, expected: 0 },
    )
}
