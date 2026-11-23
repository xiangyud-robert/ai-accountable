import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
}

/**
 * Moving cards with the keyboard, using the same moveDeal as dragging (see Risks in
 * docs/plan.md). Space picks a card up and drops it, Up and Down move it within its column,
 * Left and Right move it to the next column at the same position or the last one, and
 * Escape puts it back. Each step is announced in a live region.
 */
export function useKeyboardMove({ deals, stages, today, onDrop, onOpen }: Options) {
  const [moving, setMoving] = useState<Moving | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // The card to keep focus on. Moving to another column remounts it, so it's found by id.
  const focusId = useRef<number | null>(null)

  const ordered = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])
  const shown = useMemo(
    () => (moving ? moveDeal(deals, stages, moving.id, moving.place.stage, moving.place.index, today) : deals),
    [deals, stages, today, moving],
  )

  useEffect(() => {
    const id = focusId.current
    if (id === null) return
    const card = document.querySelector<HTMLElement>(`[data-deal-id="${id}"]`)
    if (card && document.activeElement !== card && (document.activeElement === document.body || moving)) {
      card.focus()
    }
  })

  // The key handler stays the same function from render to render, so the cards it's
  // passed to can skip redrawing. It reads the latest state from here.
  const latest = useRef({ moving, deals, shown, stages, ordered, today, onDrop, onOpen })
  latest.current = { moving, deals, shown, stages, ordered, today, onDrop, onOpen }

  const onKeyDown = useCallback((deal: DealRow, event: KeyboardEvent) => {
    const { moving, deals, shown, stages, ordered, today, onDrop, onOpen } = latest.current
    const stageName = (key: StageKey) => ordered.find((s) => s.key === key)!.name
    const where = (place: Place, list: DealRow[]) =>
      `${stageName(place.stage)}, position ${place.index + 1} of ${columnOf(list, place.stage).length}`

    if (!moving) {
      if (event.key === ' ') {
        event.preventDefault()
        const place = { stage: deal.stage, index: columnOf(deals, deal.stage).findIndex((d) => d.id === deal.id) }
        focusId.current = deal.id
        setMoving({ id: deal.id, name: deal.name, origin: place, place })
        setAnnouncement(`Picked up ${deal.name}, in ${where(place, deals)}`)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onOpen(deal)
      }
      return
    }
    if (moving.id !== deal.id) return

    const { place } = moving
    const columnLength = (stage: StageKey) => columnOf(shown, stage).length
    let next: Place | null = null
    switch (event.key) {
      case 'ArrowUp':
        next = { stage: place.stage, index: Math.max(0, place.index - 1) }
        break
      case 'ArrowDown':
        next = { stage: place.stage, index: Math.min(columnLength(place.stage) - 1, place.index + 1) }
        break
      case 'ArrowLeft':
      case 'ArrowRight': {
        const step = event.key === 'ArrowLeft' ? -1 : 1
        const target = ordered[ordered.findIndex((s) => s.key === place.stage) + step]
        // The same position in the next column, or below its last card.
        next = target ? { stage: target.key, index: Math.min(place.index, columnLength(target.key)) } : place
        break
      }
      case ' ': {
        event.preventDefault()
        setMoving(null)
        if (place.stage !== moving.origin.stage || place.index !== moving.origin.index) onDrop(moving.id, place)
        setAnnouncement(`Dropped in ${where(place, shown)}`)
        return
      }
      case 'Escape': {
        event.preventDefault()
        setMoving(null)
        setAnnouncement(`Move cancelled. ${moving.name} is back in ${where(moving.origin, deals)}`)
        return
      }
      default:
        return
    }
    event.preventDefault()
    if (next.stage === place.stage && next.index === place.index) return
    const after = moveDeal(deals, stages, moving.id, next.stage, next.index, today)
    setMoving({ ...moving, place: next })
    setAnnouncement(`Moved to ${where(next, after)}`)
  }, [])

  return { shown, movingId: moving?.id ?? null, onKeyDown, announcement }
}
