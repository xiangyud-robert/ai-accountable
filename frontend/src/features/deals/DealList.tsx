import { Link } from 'react-router'
import { LateBadge, StageBadge } from '../../components/Badge'
import { money, shortDate } from '../../lib/format'
import type { DealRow } from '../../lib/types'

/** A short list of deals for a record page's panel. */
export function DealList({ deals, empty }: { deals: DealRow[]; empty: string }) {
  if (deals.length === 0) return <p className="py-2 text-ink-muted">{empty}</p>
  return (
    <ul className="flex flex-col">
      {deals.map((deal) => (
        <li key={deal.id} className="flex items-start gap-3 border-t border-divider py-2.5 first:border-t-0">
          <div className="min-w-0 flex-1">
            <Link to={`/deals/${deal.id}`} className="font-medium text-link hover:underline">
              {deal.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StageBadge stage={deal.stage} />
              {deal.late && <LateBadge />}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[13px]">{money(deal.value)}</p>
            <p className={`font-mono text-xs ${deal.late ? 'text-alert-text' : 'text-ink-muted'}`}>{shortDate(deal.close_date)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
