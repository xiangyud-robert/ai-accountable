import { Calendar } from 'lucide-react'
import { memo, type CSSProperties } from 'react'
import { LateBadge } from '../../components/Badge'
import { initials, money, percent, shortDate } from '../../lib/format'
import { stageTint } from '../../lib/stages'
import type { DealRow } from '../../lib/types'

type DealCardProps = {
  deal: DealRow
  /** Won and Lost cards are compact: the name, value and close date. */
  compact: boolean
  /** Picked up with the keyboard, or shown under the pointer while dragging. */
  lifted?: boolean
}

/** The card's own look: its padding, surface and shadow. */
export function cardLook(deal: DealRow, compact: boolean, lifted: boolean, placeholder: boolean) {
  return {
    className: `shrink-0 cursor-grab touch-none select-none rounded-card text-left ${compact ? 'px-[11px] py-2.5' : 'p-3'} ${
      placeholder ? '*:invisible' : 'bg-panel'
    } ${placeholder ? '' : lifted ? 'shadow-lift' : 'shadow-panel'}`,
    style: (placeholder ? { background: stageTint(deal.stage) } : {}) as CSSProperties,
  }
}

/** A deal on the pipeline, as shown under the pointer while it's dragged. It's only a
 *  picture: the card in its column is the one that takes the keyboard and the pointer. */
export function DealCard({ deal, compact, lifted = false }: DealCardProps) {
  const look = cardLook(deal, compact, lifted, false)
  return (
    <div data-deal-id={deal.id} style={look.style} className={look.className}>
      <CardContent deal={deal} compact={compact} />
    </div>
  )
}

const unchanged = (a: { deal: DealRow; compact: boolean }, b: typeof a) =>
  a.compact === b.compact &&
  a.deal.name === b.deal.name &&
  a.deal.stage === b.deal.stage &&
  a.deal.value === b.deal.value &&
  a.deal.probability === b.deal.probability &&
  a.deal.close_date === b.deal.close_date &&
  a.deal.late === b.deal.late &&
  a.deal.contact_name === b.deal.contact_name

/** What a card shows. Memoized on what's drawn, so moving one card, which renumbers its
 *  column, doesn't redraw every card in it. */
export const CardContent = memo(function CardContent({ deal, compact }: { deal: DealRow; compact: boolean }) {
  return (
    <div>
      {!compact && (
        <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
          {deal.contact_name && (
            <>
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-ink"
                style={{ background: stageTint(deal.stage) }}
              >
                {initials(deal.contact_name)}
              </span>
              <span className="min-w-0 truncate">{deal.contact_name}</span>
            </>
          )}
          {deal.late && (
            <span className="ml-auto">
              <LateBadge />
            </span>
          )}
        </div>
      )}
      <p className={`font-semibold leading-[1.3] ${compact ? 'text-[13px]' : 'text-[13.5px]'}`}>{deal.name}</p>
      {compact ? (
        <>
          <p className="mt-2 font-mono text-[13px] font-medium">{money(deal.value)}</p>
          <p className="mt-px font-mono text-xs text-ink-muted">{shortDate(deal.close_date)}</p>
        </>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-mono text-[15px] font-medium">{money(deal.value)}</span>
            <span className="font-mono text-xs text-ink-muted">{percent(deal.probability)}</span>
          </div>
          <p
            className={`mt-1 flex items-center gap-1.5 font-mono text-xs ${deal.late ? 'text-alert-text' : 'text-ink-muted'}`}
          >
            <Calendar aria-hidden size={12} />
            {shortDate(deal.close_date)}
          </p>
        </>
      )}
    </div>
  )
}, unchanged)
