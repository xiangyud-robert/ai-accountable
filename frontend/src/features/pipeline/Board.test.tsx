import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Toaster } from '../../components/Toaster'
import type { DealRow, StageKey } from '../../lib/types'
import { STAGES, dealRow, mockFetch, renderWithApp } from '../../test-utils'
import { PipelinePage } from './PipelinePage'

const NAMES: Record<number, string> = {
  1: 'Alpha pilot',
  2: 'Bravo rollout',
  3: 'Charlie renewal',
  4: 'Xray licenses',
  5: 'Yankee training',
}

/** The board as each column's deal ids, top to bottom. */
type Layout = Partial<Record<StageKey, number[]>>

const START: Layout = { new: [1, 2, 3], qualified: [4, 5] }

function rows(layout: Layout): DealRow[] {
  return STAGES.flatMap((stage) =>
    (layout[stage.key] ?? []).map((id, position) =>
      dealRow({ id, name: NAMES[id], stage: stage.key, position, value: 10_000 }),
    ),
  )
}

/**
 * The board, with a stand-in server that keeps its own layout and applies each move to it.
 * With `failMoves`, it holds each move until `turnDown` is called, then turns it down, and
 * never answers the refetch after, so what the board shows then is its own doing.
 */
function renderBoard({ failMoves = false } = {}) {
  const saved: Layout = structuredClone(START)
  let turnDown = () => {}
  const turnedDown = new Promise<void>((resolve) => (turnDown = resolve))
  const calls = mockFetch(async (method, path, body) => {
    const move = /^\/deals\/(\d+)\/move$/.exec(path)
    if (failMoves) {
      await (move ? turnedDown : new Promise(() => {}))
      return { status: 500 }
    }
    if (!move) return { body: path === '/deals' ? rows(saved) : path === '/stages' ? STAGES : [] }
    const id = Number(move[1])
    const { stage, index } = body as { stage: StageKey; index: number }
    for (const { key } of STAGES) saved[key] = (saved[key] ?? []).filter((each) => each !== id)
    saved[stage]!.splice(index, 0, id)
    return { body: rows(saved).find((d) => d.id === id) }
  })
  // Outside the router, as in the app.
  render(<Toaster />)
  const result = renderWithApp(<PipelinePage />, { data: [[['deals'], rows(START)]] })
  const moves = () => calls.filter((c) => c.method === 'POST').map(({ path, body }) => ({ path, body }))
  return { calls, moves, turnDown, ...result }
}

// jsdom has no layout, so the board is given one, as a browser would lay it out: the columns
// side by side, each with its cards stacked from the top, 60px high with 20px between them.
const COLUMN = { top: 100, width: 160, gap: 10, height: 600 }
const CARD = { height: 60, gap: 20 }

function layout(element: Element): DOMRect {
  const columns = [...document.querySelectorAll('[data-cards]')]
  const columnLeft = (cards: Element) => columns.indexOf(cards) * (COLUMN.width + COLUMN.gap)
  if (element.matches('[data-cards]')) {
    return DOMRect.fromRect({ x: columnLeft(element), y: COLUMN.top, width: COLUMN.width, height: COLUMN.height })
  }
  const cards = element.parentElement
  if (element.matches('[data-deal-id]') && cards?.matches('[data-cards]')) {
    const top = COLUMN.top + [...cards.children].indexOf(element) * (CARD.height + CARD.gap)
    return DOMRect.fromRect({ x: columnLeft(cards), y: top, width: COLUMN.width, height: CARD.height })
  }
  // The card under the pointer is in a fixed panel, placed by its own top, left and size.
  const fixed = element.closest<HTMLElement>('[style*="position: fixed"]')
  if (fixed) {
    const { left, top, width, height } = fixed.style
    return DOMRect.fromRect({
      x: parseFloat(left),
      y: parseFloat(top),
      width: parseFloat(width),
      height: parseFloat(height),
    })
  }
  return DOMRect.fromRect()
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return layout(this)
  })
})

// A test that fails mid-drag leaves dnd-kit listening on the document, and its drop would land
// in the next test. Escape cancels it.
afterEach(() => endDrag(() => fireEvent.keyDown(document, { code: 'Escape' })))

const region = (stage: string) => screen.getByRole('region', { name: stage })
/** A deal's card in its column, rather than the copy of it under the pointer. */
const card = (id: number) =>
  screen
    .getAllByRole('region')
    .map((each) => each.querySelector<HTMLElement>(`[data-deal-id="${id}"]`))
    .find((each) => each !== null)!
const column = (stage: string) =>
  [...region(stage).querySelectorAll<HTMLElement>('[data-deal-id]')].map((each) => Number(each.dataset.dealId))
const cardArea = (stage: string) => region(stage).querySelector('[data-cards]')!
/** The column's value, the first sum of money under its name. */
const columnValue = (stage: string) => within(region(stage)).getAllByText(/^\$[\d,]+$/)[0].textContent
/** The page header's figures: its open deals, open value and expected revenue. */
const headerFigures = () =>
  within(screen.getByLabelText('Open deals'))
    .getAllByRole('definition')
    .map((figure) => figure.textContent)
/** The copy of a card that follows the pointer, outside every column. */
const underPointer = (name: string) =>
  screen
    .queryAllByText(name)
    .map((each) => each.closest<HTMLElement>('[data-deal-id]')!)
    .find((each) => !each.closest('section'))

/** Waits until the server has confirmed this many moves, as the user is told. */
const confirmed = (count: number) => waitFor(() => expect(screen.getAllByText('Deal moved')).toHaveLength(count))

type Point = { x: number; y: number }

/** After a drag, dnd-kit swallows every click for this long. */
const CLICKS_SWALLOWED_MS = 50

/**
 * Stops the clock, if it's going, so timeouts and Date.now move on only when the test moves
 * them. Testing Library waits on a timeout after each user-event call, so while the clock is
 * stopped, the test uses fireEvent.
 */
function stopClock() {
  if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
}

/** Moves the stopped clock on, and shows what that changes. */
function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * Ends a drag on a stopped clock, runs it on past the clicks dnd-kit then swallows, so none
 * of them can reach a later click or the next test, and starts it again.
 */
async function endDrag(end: () => void) {
  stopClock()
  end()
  tick(CLICKS_SWALLOWED_MS)
  vi.useRealTimers()
  // dnd-kit takes away the card under the pointer once a promise has settled.
  await act(async () => {})
}

/** Places on a card or a column, the same ones the end-to-end drag helper uses. */
function spot(element: Element, where: 'top' | 'middle' | 'bottom' | 'gap above'): Point {
  const { left, top, width, height } = layout(element)
  const y = { top: top + height / 4, middle: top + height / 2, bottom: top + height - 6, 'gap above': top - 4 }[where]
  return { x: left + width / 2, y }
}

/** Presses on the middle of a card and moves 8px, past the 5px it takes to pick it up. */
async function pickUp(from: HTMLElement) {
  const user = userEvent.setup()
  const coords = ({ x, y }: Point) => ({ clientX: x, clientY: y })
  let here = spot(from, 'middle')
  await user.pointer({ keys: '[MouseLeft>]', target: from, coords: coords(here) })
  here = { x: here.x + 8, y: here.y + 8 }
  await user.pointer({ target: document.body, coords: coords(here) })
  const letGo = () => fireEvent.pointerUp(document.body, coords(here))
  return {
    /** Moves there, then a pixel further, as the end-to-end drag does, so the card under the
     *  pointer is found again once the board has made room for it. */
    async moveTo(point: Point) {
      await user.pointer({ target: document.body, coords: coords(point) })
      here = { x: point.x, y: point.y + 1 }
      await user.pointer({ target: document.body, coords: coords(here) })
    },
    /** Lets go, leaving the clock as it is. */
    letGo,
    drop: () => endDrag(letGo),
    /** Presses Escape, which puts the card back. */
    cancel: () => endDrag(() => fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' })),
  }
}

async function drag(from: HTMLElement, to: Point) {
  const pointer = await pickUp(from)
  await pointer.moveTo(to)
  await pointer.drop()
}

describe('dragging a card', () => {
  test("onto a card in another column puts it in that card's place, and saves the move", async () => {
    const { moves } = renderBoard()
    await drag(card(2), spot(card(4), 'top'))
    expect(column('Qualified')).toEqual([2, 4, 5])
    expect(column('New')).toEqual([1, 3])
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/2/move', body: { stage: 'qualified', index: 0 } }])
    // The board refetched from the server still has it there.
    await waitFor(() => expect(column('Qualified')).toEqual([2, 4, 5]))
  })

  test('onto the first card of its own column moves it to the top', async () => {
    const { moves } = renderBoard()
    await drag(card(3), spot(card(1), 'top'))
    expect(column('New')).toEqual([3, 1, 2])
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/3/move', body: { stage: 'new', index: 0 } }])
  })

  test('into the gap between two cards, moving up or down its column, lands between them', async () => {
    const { moves } = renderBoard()
    await drag(card(3), spot(card(2), 'gap above'))
    expect(column('New')).toEqual([1, 3, 2])
    await confirmed(1)

    await drag(card(1), spot(card(2), 'gap above'))
    expect(column('New')).toEqual([3, 1, 2])
    await confirmed(2)
    expect(moves()).toEqual([
      { path: '/deals/3/move', body: { stage: 'new', index: 1 } },
      { path: '/deals/1/move', body: { stage: 'new', index: 1 } },
    ])
  })

  test('into the gap between two cards of another column lands between them', async () => {
    const { moves } = renderBoard()
    await drag(card(1), spot(card(5), 'gap above'))
    expect(column('Qualified')).toEqual([4, 1, 5])
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/1/move', body: { stage: 'qualified', index: 1 } }])
  })

  test('below the last card of another column puts it at the bottom', async () => {
    const { moves } = renderBoard()
    await drag(card(1), spot(cardArea('Qualified'), 'bottom'))
    expect(column('Qualified')).toEqual([4, 5, 1])
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/1/move', body: { stage: 'qualified', index: 2 } }])
  })

  test('below the last card of its own column puts it at the bottom', async () => {
    const { moves } = renderBoard()
    await drag(card(1), spot(cardArea('New'), 'bottom'))
    expect(column('New')).toEqual([2, 3, 1])
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/1/move', body: { stage: 'new', index: 2 } }])
  })

  test("into an empty column makes it that column's only card, a compact one for Lost", async () => {
    const { moves } = renderBoard()
    const pointer = await pickUp(card(2))
    await pointer.moveTo(spot(cardArea('Lost'), 'middle'))
    // Under the pointer it already looks like a Lost card, with no probability.
    expect(underPointer('Bravo rollout')).not.toHaveTextContent('%')
    await pointer.drop()
    expect(column('Lost')).toEqual([2])
    expect(card(2)).not.toHaveTextContent('%')
    await confirmed(1)
    expect(moves()).toEqual([{ path: '/deals/2/move', body: { stage: 'lost', index: 0 } }])
  })

  test('while it is over another column, it shows there as it will be, and the figures wait for the drop', async () => {
    renderBoard()
    expect(headerFigures()).toEqual(['5', '$50,000', '$8,000'])
    const pointer = await pickUp(card(2))
    await pointer.moveTo(spot(card(4), 'top'))

    expect(column('Qualified')).toEqual([2, 4, 5])
    expect(underPointer('Bravo rollout')).toHaveTextContent('25%')
    expect(columnValue('Qualified')).toBe('$20,000')
    expect(headerFigures()).toEqual(['5', '$50,000', '$8,000'])

    await pointer.drop()
    expect(underPointer('Bravo rollout')).toBeUndefined()
    expect(columnValue('Qualified')).toBe('$30,000')
    expect(columnValue('New')).toBe('$20,000')
    expect(headerFigures()).toEqual(['5', '$50,000', '$9,500'])
    await confirmed(1)
  })

  test('dropped back where it started, it saves nothing', async () => {
    const { moves } = renderBoard()
    await drag(card(2), spot(card(2), 'middle'))
    expect(column('New')).toEqual([1, 2, 3])
    expect(moves()).toEqual([])
  })

  test('let go away from every column, it goes back and saves nothing', async () => {
    const { moves } = renderBoard()
    const pointer = await pickUp(card(2))
    await pointer.moveTo(spot(card(4), 'top'))
    expect(column('Qualified')).toContain(2)
    await pointer.moveTo({ x: 300, y: COLUMN.top + COLUMN.height + 60 })
    await pointer.drop()
    expect(column('New')).toEqual([1, 2, 3])
    expect(column('Qualified')).toEqual([4, 5])
    expect(moves()).toEqual([])
  })

  test('Escape puts it back and saves nothing', async () => {
    const { moves } = renderBoard()
    const pointer = await pickUp(card(2))
    await pointer.moveTo(spot(card(4), 'top'))
    expect(column('Qualified')).toContain(2)
    await pointer.cancel()
    expect(column('New')).toEqual([1, 2, 3])
    expect(column('Qualified')).toEqual([4, 5])
    await pointer.drop()
    expect(moves()).toEqual([])
  })

  test('a move the server turns down puts the card back, with a message, before anything is refetched', async () => {
    const { calls, moves, turnDown } = renderBoard({ failMoves: true })
    await drag(card(2), spot(cardArea('Won'), 'middle'))
    expect(column('Won')).toEqual([2])
    turnDown()
    expect(await screen.findByText("Couldn't save the move, so the card is back where it was.")).toBeInTheDocument()
    expect(moves()).toEqual([{ path: '/deals/2/move', body: { stage: 'won', index: 0 } }])
    expect(column('New')).toEqual([1, 2, 3])
    expect(column('Won')).toEqual([])
    // The deals have been asked for again, and the server never sends them.
    await waitFor(() => expect(calls).toContainEqual({ method: 'GET', path: '/deals', body: undefined }))
  })
})

describe('clicking a card', () => {
  test('opens the deal', async () => {
    const { router } = renderBoard()
    await userEvent.click(card(4))
    expect(router.state.location.pathname).toBe('/deals/4')
  })

  test('straight after a drag opens nothing, and a moment later opens the deal', async () => {
    const { router } = renderBoard()
    const pointer = await pickUp(card(2))
    await pointer.moveTo(spot(card(2), 'middle'))
    stopClock()
    pointer.letGo()
    // Past the 50ms in which dnd-kit swallows every click, but inside the board's own 150ms.
    tick(100)
    fireEvent.click(card(2))
    expect(router.state.location.pathname).toBe('/')
    tick(100)
    fireEvent.click(card(2))
    expect(router.state.location.pathname).toBe('/deals/2')
  })
})
