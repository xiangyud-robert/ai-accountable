import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../../components/Button'
import { money } from '../../lib/format'
import { stageColor, stageTint } from '../../lib/stages'
import type { BoardColumn } from './board'

type ColumnProps = {
  /** The column's figures, from the deals as saved or as just dropped. */
  figures: BoardColumn
  /** The ids of the cards shown, in order, including one being moved into it. */
  ids: number[]
  onAdd: () => void
  children: ReactNode
}

/** One stage's column: its heading panel, and its cards, which scroll on their own. */
export function Column({ figures, ids, onAdd, children }: ColumnProps) {
  const { stage, count, value, expected } = figures
  // The whole column accepts drops, so a card can go below the last one or into an empty column.
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage.key}`, data: { stage: stage.key } })
  const share = value > 0 ? Math.round((expected / value) * 100) : 0

  return (
    <section
      aria-labelledby={`column-${stage.key}`}
      className={`flex min-h-0 flex-col gap-2.5 ${stage.open ? 'min-w-[170px] flex-[1.2]' : 'min-w-[115px] flex-[0.8]'}`}
    >
      {/* Narrow columns, such as Won and Lost on a 1280px screen, get tighter spacing and a
          smaller total, so the stage's name and its figures still fit. */}
      <div className="@container rounded-column bg-panel shadow-panel">
        <div className="py-3 pl-2.5 pr-2 @[130px]:pl-3.5 @[130px]:pr-3">
          <div className="flex items-center gap-1.5 @[130px]:gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: stageColor(stage.key) }} />
            <h2 id={`column-${stage.key}`} className="truncate font-semibold">
              {stage.name}
            </h2>
            <span className="font-mono text-xs text-ink-muted">{count}</span>
            <IconButton
              label={`Add deal in ${stage.name}`}
              tooltip="Add deal"
              onClick={onAdd}
              className="ml-auto size-[26px] bg-page text-ink"
            >
              <Plus aria-hidden size={15} />
            </IconButton>
          </div>
          <p className="mt-1.5 font-mono text-[14px] font-medium @[130px]:text-[17px]">{money(value)}</p>
          {stage.open ? (
            <>
              <p className="text-xs text-ink-muted">
                <span className="font-mono font-medium text-ink">{money(expected)}</span> expected
              </p>
              <div
                title="Expected share of the value"
                aria-hidden
                className="mt-2.5 h-1 overflow-hidden rounded"
                style={{ background: stageTint(stage.key) }}
              >
                <div className="h-full rounded-r" style={{ width: `${share}%`, background: stageColor(stage.key) }} />
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted">{stage.key === 'won' ? 'Won, all time' : 'Lost, all time'}</p>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        data-cards={stage.key}
        className={`flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto rounded-card p-0.5 pb-4 ${isOver && ids.length === 0 ? 'bg-panel/60' : ''}`}
      >
        <SortableContext id={stage.key} items={ids} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </section>
  )
}
