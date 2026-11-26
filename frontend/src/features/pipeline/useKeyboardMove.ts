import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { DealRow, Stage, StageKey } from '../../lib/types'
import { columnOf, moveDeal } from './board'

type Place = { stage: StageKey; index: number }
type Moving = { id: number; name: string; origin: Place; place: Place }

type Options = {
  deals: DealRow[]
  stages: Stage[]
  today: string
  /** Called when a card is dropped somewhere new. */
  onDrop: (id: number, place: Place) => void
  /** Called for Enter on a card that isn't being moved. */
  onOpen: (deal: DealRow) => void
  /** Called with each step, for the live region. */
  announce: (text: string) => void
}

/**
 * Moving cards with the keyboard, using the same moveDeal as dragging (see Risks in
 * docs/plan.md). Space picks a card up and drops it, Up and Down move it within its column,
 * Left and Right move it to the next column at the same position or the last one, and
 * Escape puts it back. Each step is announced in a live region.
 */
export function useKeyboardMove({ deals, stages, today, onDrop, onOpen, announce }: Options) {
  const [moving, setMoving] = useState<Moving | null>(null)
  // The card to keep focus on. Moving to another column remounts it, so it's found by id.
  const focusId = useRef<number | null>(null)

  const ordered = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])
  const shown = useMemo(
    () => (moving ? moveDeal(deals, stages, moving.id, moving.place.stage, moving.place.index, today) : deals),
    [deals, stages, today, moving],
  )

  // The key handler stays the same function from render to render, so the cards it's
  // passed to can skip redrawing. It reads the latest state from here, which is stored
  // as each render is committed, before any key can reach it.
  const latest = useRef({ moving, deals, shown, stages, ordered, today, onDrop, onOpen, announce })
  useLayoutEffect(() => {
    latest.current = { moving, deals, shown, stages, ordered, today, onDrop, onOpen, announce }
  })

  useEffect(() => {
    const id = focusId.current
    if (id === null) return
    const card = document.querySelector<HTMLElement>(`[data-deal-id="${id}"]`)
    if (card && document.activeElement !== card && (document.activeElement === document.body || moving)) {
      card.focus()
    }
  })

  // Once the user moves on, with the mouse or by focusing something else, focus is left
  // alone, so a card dragged later doesn't lose focus to the one moved by keyboard.
  useEffect(() => {
    const forget = (event: Event) => {
      const id = focusId.current
      if (id === null || latest.current.moving) return
      const onCard = event.target instanceof Element && event.target.closest(`[data-deal-id="${id}"]`)
      if (event.type === 'pointerdown' || !onCard) focusId.current = null
    }
    document.addEventListener('pointerdown', forget, true)
    document.addEventListener('focusin', forget, true)
    return () => {
      document.removeEventListener('pointerdown', forget, true)
      document.removeEventListener('focusin', forget, true)
    }
  }, [])

  const onKeyDown = useCallback((deal: DealRow, event: KeyboardEvent) => {
    const { moving, deals, shown, stages, ordered, today, onDrop, onOpen, announce } = latest.current
    const where = (place: Place, list: DealRow[]) => describePlace(place, list, ordered)

    if (!moving) {
      if (event.key === ' ') {
        event.preventDefault()
        const place = { stage: deal.stage, index: columnOf(deals, deal.stage).findIndex((d) => d.id === deal.id) }
        focusId.current = deal.id
        setMoving({ id: deal.id, name: deal.name, origin: place, place })
        announce(`Picked up ${deal.name}, in ${where(place, deals)}`)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onOpen(deal)
      }
      return
    }
    if (moving.id !== deal.id) return

    const { place, origin } = moving
    if (event.key === ' ') {
      event.preventDefault()
      setMoving(null)
      if (!samePlace(place, origin)) onDrop(moving.id, place)
      announce(`Dropped in ${where(place, shown)}`)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setMoving(null)
      announce(`Move cancelled. ${moving.name} is back in ${where(origin, deals)}`)
    } else {
      const next = arrowTarget(event.key, place, shown, ordered)
      if (!next) return
      event.preventDefault()
      if (samePlace(next, place)) return
      setMoving({ ...moving, place: next })
      announce(`Moved to ${where(next, moveDeal(deals, stages, moving.id, next.stage, next.index, today))}`)
    }
  }, [])

  return { shown, movingId: moving?.id ?? null, onKeyDown }
}

/**
 * Where an arrow key takes a card that's at this place, or null for any other key. Up and
 * Down stop at the ends of the column. Left and Right go to the same position in the next
 * column, or below its last card, and stop at the first and last columns.
 */
function arrowTarget(key: string, place: Place, shown: DealRow[], ordered: Stage[]): Place | null {
  const columnLength = (stage: StageKey) => columnOf(shown, stage).length
  switch (key) {
    case 'ArrowUp':
      return { stage: place.stage, index: Math.max(0, place.index - 1) }
    case 'ArrowDown':
      return { stage: place.stage, index: Math.min(columnLength(place.stage) - 1, place.index + 1) }
    case 'ArrowLeft':
    case 'ArrowRight': {
      const step = key === 'ArrowLeft' ? -1 : 1
      const target = ordered[ordered.findIndex((s) => s.key === place.stage) + step]
      return target ? { stage: target.key, index: Math.min(place.index, columnLength(target.key)) } : place
    }
    default:
      return null
  }
}

/** A place as it's announced, such as "Qualified, position 2 of 3". */
function describePlace(place: Place, list: DealRow[], ordered: Stage[]) {
  const stageName = ordered.find((s) => s.key === place.stage)!.name
  return `${stageName}, position ${place.index + 1} of ${columnOf(list, place.stage).length}`
}

const samePlace = (a: Place, b: Place) => a.stage === b.stage && a.index === b.index
