import { Link } from 'react-router'
import { DueBadge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import type { Dashboard, FollowUp } from '../../lib/types'
import { DoneCheckbox } from '../activities/ActivityDialog'
import { useChangeActivity } from '../activities/queries'
import { KindIcon, TYPE_ICONS } from '../activities/Timeline'
import { summaries } from './chartData'

/** R9: overdue first, oldest first, then the rest due in the next 7 days, soonest first. */
export function FollowUps({ dashboard }: { dashboard: Dashboard }) {
  const change = useChangeActivity()
  const done = (followUp: FollowUp) =>
    change.mutate(
      { id: followUp.id, values: { follow_up_done: true }, message: 'Follow-up done' },
      { onError: () => notify.failed(UNREACHABLE_MESSAGE) },
    )

  return (
    <Panel title="Follow-ups" subtitle={summaries(dashboard).followUps} className="col-span-6">
      {dashboard.follow_ups.length === 0 ? (
        <EmptyState message="Nothing to follow up in the next 7 days." />
      ) : (
        <ul aria-label="Follow-ups" className="-mr-2 max-h-[470px] overflow-y-auto pr-2">
          {dashboard.follow_ups.map((followUp) => (
            <li key={followUp.id} className="grid grid-cols-[18px_30px_1fr_auto] items-center gap-3 border-t border-divider py-[9px] first:border-t-0">
              <DoneCheckbox
                checked={false}
                onCheckedChange={() => done(followUp)}
                label="Done"
                describedBy={`follow-up-${followUp.id}`}
                disabled={change.isPending && change.variables?.id === followUp.id}
              />
              <KindIcon icon={TYPE_ICONS[followUp.type]} tint="var(--color-neutral-tint)" />
              <div className="min-w-0">
                <p id={`follow-up-${followUp.id}`} className="truncate font-medium">
                  {followUp.description}
                </p>
                <Link
                  to={followUp.deal_id ? `/deals/${followUp.deal_id}` : `/contacts/${followUp.contact_id}`}
                  className="block truncate text-xs text-link hover:underline"
                >
                  {followUp.deal_name ?? followUp.contact_name}
                </Link>
              </div>
              <DueBadge days={followUp.days} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
