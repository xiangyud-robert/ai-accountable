import { describe, expect, test } from 'vitest'
import type { DealRow, StageKey } from '../../lib/types'
import { STAGES, dealRow } from '../../test-utils'
import { boardColumns, boardTotals, columnOf, moveDeal, putBack } from './board'

const TODAY = '2026-06-15'

let nextId = 1
/** A $10,000 deal at `position` in `stage`, closing after TODAY, with the next id. */
function deal(stage: StageKey, position: number, fields: Partial<DealRow> = {}): DealRow {
  const id = nextId++
  return dealRow({ id, name: `Deal ${id}`, stage, position, value: 10_000, close_date: '2026-07-01', ...fields })
}

const names = (deals: DealRow[], stage: StageKey) => columnOf(deals, stage).map((d) => [d.name, d.position])

function board() {
  nextId = 1
  return [
    deal('new', 0, { name: 'A' }),
    deal('new', 1, { name: 'B' }),
    deal('new', 2, { name: 'C' }),
    deal('qualified', 0, { name: 'X' }),
    deal('qualified', 1, { name: 'Y' }),
  ]
}

const byName = (deals: DealRow[], name: string) => deals.find((d) => d.name === name)!

describe('moveDeal', () => {
  test('within a column, only the positions change', () => {
    const deals = board()
    const moved = moveDeal(deals, STAGES, byName(deals, 'C').id, 'new', 0, TODAY)
    expect(names(moved, 'new')).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ])
    expect(byName(moved, 'C').probability).toBe(10)
    expect(names(moved, 'qualified')).toEqual([
      ['X', 0],
      ['Y', 1],
    ])
  })

  test('between columns, both are renumbered from 0', () => {
    const deals = board()
    const moved = moveDeal(deals, STAGES, byName(deals, 'B').id, 'qualified', 1, TODAY)
    expect(names(moved, 'new')).toEqual([
      ['A', 0],
      ['C', 1],
    ])
    expect(names(moved, 'qualified')).toEqual([
      ['X', 0],
      ['B', 1],
      ['Y', 2],
    ])
  })

  test('to an empty column', () => {
    const deals = board()
    const moved = moveDeal(deals, STAGES, byName(deals, 'A').id, 'proposal', 0, TODAY)
    expect(names(moved, 'proposal')).toEqual([['A', 0]])
    expect(names(moved, 'new')).toEqual([
      ['B', 0],
      ['C', 1],
    ])
  })

  test('an index past the end goes below the last card', () => {
    const deals = board()
    const moved = moveDeal(deals, STAGES, byName(deals, 'A').id, 'qualified', 99, TODAY)
    expect(names(moved, 'qualified')).toEqual([
      ['X', 0],
      ['Y', 1],
      ['A', 2],
    ])
    const within = moveDeal(deals, STAGES, byName(deals, 'A').id, 'new', 99, TODAY)
    expect(names(within, 'new')).toEqual([
      ['B', 0],
      ['C', 1],
      ['A', 2],
    ])
  })

  test('an open stage takes its usual probability, keeping the close date', () => {
    const deals = board()
    const id = byName(deals, 'A').id
    const moved = byName(moveDeal(deals, STAGES, id, 'proposal', 0, TODAY), 'A')
    expect([moved.stage, moved.probability, moved.expected, moved.close_date]).toEqual([
      'proposal',
      50,
      5_000,
      '2026-07-01',
    ])
  })

  test('Won sets today and 100%, and Lost sets today and 0%', () => {
    const deals = board()
    const won = byName(moveDeal(deals, STAGES, byName(deals, 'A').id, 'won', 0, TODAY), 'A')
    expect([won.probability, won.close_date, won.expected]).toEqual([100, TODAY, 10_000])
    const lost = byName(moveDeal(deals, STAGES, byName(deals, 'X').id, 'lost', 0, TODAY), 'X')
    expect([lost.probability, lost.close_date, lost.expected]).toEqual([0, TODAY, 0])
  })

  test('the rules come from the stages passed in', () => {
    const deals = board()
    const custom = STAGES.map((s) => (s.key === 'proposal' ? { ...s, probability: 40 } : s))
    expect(byName(moveDeal(deals, custom, byName(deals, 'A').id, 'proposal', 0, TODAY), 'A').probability).toBe(40)
  })

  test('late flags after a move', () => {
    nextId = 1
    const deals = [
      deal('proposal', 0, { name: 'Late', close_date: '2026-06-01', late: true }),
      deal('won', 0, { name: 'Won', close_date: '2026-05-01' }),
    ]
    const won = byName(moveDeal(deals, STAGES, byName(deals, 'Late').id, 'won', 0, TODAY), 'Late')
    expect(won.late).toBe(false)
    const reopened = byName(moveDeal(deals, STAGES, byName(deals, 'Won').id, 'negotiation', 0, TODAY), 'Won')
    expect([reopened.late, reopened.close_date, reopened.probability]).toEqual([true, '2026-05-01', 75])
  })

  test('leaves the deals it was given alone', () => {
    const deals = board()
    const copy = structuredClone(deals)
    moveDeal(deals, STAGES, byName(deals, 'A').id, 'won', 0, TODAY)
    expect(deals).toEqual(copy)
  })
})

describe('putBack', () => {
  test('a move that failed is undone, and a later one stays', () => {
    nextId = 1
    const before = [
      ...board().slice(0, 3),
      deal('qualified', 0, { name: 'X', probability: 40 }),
      deal('qualified', 1, { name: 'Y' }),
    ]
    const x = byName(before, 'X').id
    const b = byName(before, 'B').id
    // X fails to move to Won. B moves to Proposal before X's save has failed.
    const first = moveDeal(before, STAGES, x, 'won', 0, TODAY)
    const second = moveDeal(first, STAGES, b, 'proposal', 0, TODAY)
    const back = putBack(second, before, STAGES, x, TODAY)
    expect(names(back, 'qualified')).toEqual([
      ['X', 0],
      ['Y', 1],
    ])
    expect(names(back, 'won')).toEqual([])
    expect(names(back, 'proposal')).toEqual([['B', 0]])
    expect(names(back, 'new')).toEqual([
      ['A', 0],
      ['C', 1],
    ])
    // Its own probability, set by hand, comes back too.
    expect([byName(back, 'X').probability, byName(back, 'X').expected, byName(back, 'X').close_date]).toEqual([
      40,
      4_000,
      '2026-07-01',
    ])
  })
})

describe('board figures', () => {
  test('columns in stage order, with their totals', () => {
    nextId = 1
    const deals = [
      deal('new', 0, { value: 10_000 }),
      deal('new', 1, { value: 30_000, probability: 20 }),
      deal('negotiation', 0, { value: 8_000 }),
      deal('won', 0, { value: 50_000 }),
    ]
    const columns = boardColumns(deals, STAGES)
    expect(columns.map((c) => c.stage.key)).toEqual(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
    expect(columns[0]).toMatchObject({ count: 2, value: 40_000, expected: 7_000 })
    expect(columns[1]).toMatchObject({ count: 0, value: 0, expected: 0 })
    expect(columns[3]).toMatchObject({ count: 1, value: 8_000, expected: 6_000 })
    expect(columns[4]).toMatchObject({ count: 1, value: 50_000, expected: 0 })
  })

  test('board totals count open deals only', () => {
    nextId = 1
    const deals = [
      deal('new', 0),
      deal('proposal', 0),
      deal('won', 0, { value: 99_000 }),
      deal('lost', 0, { value: 77_000 }),
    ]
    expect(boardTotals(deals, STAGES)).toEqual({ count: 2, value: 20_000, expected: 6_000 })
  })

  test('figures after a move', () => {
    const deals = board()
    const moved = moveDeal(deals, STAGES, byName(deals, 'A').id, 'won', 0, TODAY)
    expect(boardTotals(moved, STAGES)).toEqual({ count: 4, value: 40_000, expected: 2 * 1_000 + 2 * 2_500 })
    expect(boardColumns(moved, STAGES)[4]).toMatchObject({ count: 1, value: 10_000 })
  })
})
