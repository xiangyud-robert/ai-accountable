import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { todayISO } from '../../lib/format'
import type { DealRow, Stage, StageKey } from '../../lib/types'
import { useMoveDeal } from '../deals/queries'
import { boardColumns, columnOf, moveDeal } from './board'
import { Column } from './Column'
import { CardContent, DealCard, cardLook } from './DealCard'
import { useKeyboardMove } from './useKeyboardMove'

const INSTRUCTIONS =
  'Press Space to pick up this card, the arrow keys to move it, and Space again to drop it. ' +
  'Escape puts it back. Enter opens the deal.'

type Place = { id: number; stage: StageKey; index: number }

// The column under the pointer first, then only its cards, so a move checks a few dozen
// rectangles rather than every card on the board. A card wins over its column, so a drop
// lands next to the card under the pointer, and below the last card the column takes it.
const collisions: CollisionDetection = (args) => {
  const columns = args.droppableContainers.filter((c) => isColumn(c.id))
  const [column] = pointerWithin({ ...args, droppableContainers: columns })
  if (!column) return rectIntersection({ ...args, droppableContainers: columns })
  const stage = String(column.id).slice('column-'.length)
  const cards = args.droppableContainers.filter((c) => c.data.current?.sortable?.containerId === stage)
  const [card] = pointerWithin({ ...args, droppableContainers: cards })
  return card ? [card] : [column]
}

const isColumn = (id: string | number): id is string => typeof id === 'string' && id.startsWith('column-')

type BoardProps = {
  deals: DealRow[]
  stages: Stage[]
  onAdd: (stage: StageKey) => void
  /** Each keyboard step, for the live region. */
  announcement: (text: string) => void
}

export function Board({ deals, stages, onAdd, announcement }: BoardProps) {
  const navigate = useNavigate()
  const move = useMoveDeal()
  const today = todayISO()
  const open = useCallback((deal: DealRow) => navigate(`/deals/${deal.id}`), [navigate])
  const keyboard = useKeyboardMove({
    deals,
    stages,
    today,
    onDrop: (id, place) => move({ id, ...place }),
    onOpen: open,
  })
  const lastAnnouncement = useRef('')
  if (keyboard.announcement !== lastAnnouncement.current) {
    lastAnnouncement.current = keyboard.announcement
    queueMicrotask(() => announcement(keyboard.announcement))
  }

  // While a card is dragged over another column, it's shown there as a tinted space.
  const [drag, setDrag] = useState<Place | null>(null)
  const draggedAt = useRef(0)
  // A click straight after a drag is the end of the drag, not a request to open the deal.
  const click = useCallback((deal: DealRow) => Date.now() - draggedAt.current > 150 && open(deal), [open])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const shown = useMemo(
    () => (drag ? moveDeal(deals, stages, drag.id, drag.stage, drag.index, today) : keyboard.shown),
    [drag, deals, stages, today, keyboard.shown],
  )
  // The figures come from the deals as saved, or as just dropped, never from a card in mid-air.
  const figures = useMemo(() => boardColumns(deals, stages), [deals, stages])
  const columns = useMemo(() => boardColumns(shown, stages), [shown, stages])
  const active = drag ? shown.find((d) => d.id === drag.id) : undefined

  const placeOf = (list: DealRow[], id: number): Place | null => {
    const deal = list.find((d) => d.id === id)
    return deal ? { id, stage: deal.stage, index: columnOf(list, deal.stage).findIndex((d) => d.id === id) } : null
  }

  const onDragStart = ({ active }: DragStartEvent) => setDrag(placeOf(deals, Number(active.id)))

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!drag || !over) return
    const overStage = isColumn(over.id) ? (over.data.current?.stage as StageKey) : shown.find((d) => d.id === over.id)?.stage
    if (!overStage || overStage === drag.stage) return
    // Into another column: next to the card under the pointer, or below the last one.
    const target = columnOf(shown, overStage)
    let index = target.length
    if (!isColumn(over.id)) {
      const overIndex = target.findIndex((d) => d.id === over.id)
      const dragged = active.rect.current.translated
      const below = dragged ? dragged.top > over.rect.top + over.rect.height / 2 : false
      index = overIndex + (below ? 1 : 0)
    }
    setDrag({ id: drag.id, stage: overStage, index })
  }

  const onDragEnd = ({ over }: DragEndEvent) => {
    const current = drag
    setDrag(null)
    draggedAt.current = Date.now()
    if (!current || !over) return
    const column = columnOf(shown, current.stage)
    let index = column.findIndex((d) => d.id === current.id)
    if (!isColumn(over.id)) {
      const overIndex = column.findIndex((d) => d.id === over.id)
      if (overIndex >= 0) index = overIndex
    } else if (over.data.current?.stage === current.stage) {
      index = column.length - 1
    }
    const start = placeOf(deals, current.id)
    if (start && start.stage === current.stage && start.index === index) return
    move({ id: current.id, stage: current.stage, index })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisions}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        screenReaderInstructions: { draggable: INSTRUCTIONS },
        // Mouse drags need no announcements. Keyboard moves have their own, in the live region.
        announcements: {
          onDragStart: () => undefined,
          onDragOver: () => undefined,
          onDragEnd: () => undefined,
          onDragCancel: () => undefined,
        },
      }}
    >
      <div className="flex h-[calc(100vh-112px)] min-h-[420px] gap-3 overflow-x-auto pb-1">
        {columns.map((column, i) => (
          <Column key={column.stage.key} figures={figures[i]} ids={column.deals.map((d) => d.id)} onAdd={() => onAdd(column.stage.key)}>
            {column.deals.map((deal) => (
              <SortableCard
                key={deal.id}
                deal={deal}
                compact={!column.stage.open}
                lifted={keyboard.movingId === deal.id}
                onKeyDown={keyboard.onKeyDown}
                onOpen={click}
              />
            ))}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active && <DealCard deal={active} compact={!stages.find((s) => s.key === active.stage)!.open} lifted />}
      </DragOverlay>
    </DndContext>
  )
}

type SortableCardProps = {
  deal: DealRow
  compact: boolean
  lifted: boolean
  onKeyDown: (deal: DealRow, event: KeyboardEvent) => void
  onOpen: (deal: DealRow) => void
}

/**
 * A card in its column. dnd-kit redraws every card whenever the card under the pointer
 * changes, so this keeps that redraw small: one element, with its content made once.
 * It's memoized, with handlers that don't change, so the board redrawing skips it too.
 */
const SortableCard = memo(function SortableCard({ deal, compact, lifted, onKeyDown, onOpen }: SortableCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: deal.id })
  const content = useMemo(() => <CardContent deal={deal} compact={compact} />, [deal, compact])
  const look = cardLook(deal, compact, lifted, isDragging)
  return (
    <div
      ref={setNodeRef}
      data-deal-id={deal.id}
      className={look.className}
      style={{ ...look.style, transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={(event) => onKeyDown(deal, event)}
      onClick={() => onOpen(deal)}
    >
      {content}
    </div>
  )
})
