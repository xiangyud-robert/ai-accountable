import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Panel } from '../../components/Panel'
import { clockTime, timelineTime } from '../../lib/format'
import type { Dashboard, TimelineEntry } from '../../lib/types'
import { EntryIcon } from '../activities/Timeline'
import { groupRecent } from './chartData'

/** The record an entry belongs to, and its address. */
function recordOf(entry: TimelineEntry) {
  return entry.record === 'deal'
    ? { name: entry.deal_name, to: `/deals/${entry.deal_id}` }
    : { name: entry.contact_name, to: `/contacts/${entry.contact_id}` }
}

/** The 10 newest entries of any kind, from anywhere, under Today, Yesterday and Earlier. */
export function RecentActivity({ dashboard }: { dashboard: Dashboard }) {
  const groups = groupRecent(dashboard.recent, dashboard.today)
  return (
    <Panel title="Recent activity" subtitle="The latest from every contact and deal" className="col-span-6">
      {groups.length === 0 ? (
        <EmptyState message="Nothing has happened yet." />
      ) : (
        groups.map((group) => (
          <section key={group.title} aria-labelledby={`recent-${group.title}`} className="mt-2.5 first:mt-0">
            <h3
              id={`recent-${group.title}`}
              className="mb-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted"
            >
              {group.title}
            </h3>
            <ul>
              {group.entries.map((entry) => {
                const record = recordOf(entry)
                return (
                  <li key={entry.key} className="grid grid-cols-[30px_1fr_auto] items-center gap-3 py-2">
                    <EntryIcon entry={entry} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.text}</p>
                      <Link to={record.to} className="block truncate text-xs text-link hover:underline">
                        {record.name}
                      </Link>
                    </div>
                    <span className="whitespace-nowrap font-mono text-xs text-ink-muted">
                      {group.title === 'Earlier'
                        ? timelineTime(entry.at, new Date(`${dashboard.today}T12:00:00`))
                        : clockTime(entry.at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </Panel>
  )
}
