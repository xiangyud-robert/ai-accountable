import { ArrowRight, CirclePlus, Ellipsis, FileText, Mail, Phone, UserCheck, type LucideIcon } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { IconButton } from '../../components/Button'
import { ConfirmDelete, activityQuestion } from '../../components/ConfirmDelete'
import { notify } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { followUpLabel, timelineTime } from '../../lib/format'
import { stageTint } from '../../lib/stages'
import type { ActivityType, StageKey, TimelineEntry } from '../../lib/types'
import { ActivityDialog, DoneCheckbox, type EditableActivity } from './ActivityDialog'
import { useChangeActivity, useDeleteActivity } from './queries'

export const TYPE_ICONS: Record<ActivityType, LucideIcon> = { call: Phone, email: Mail, note: FileText }

/** Each kind of entry's icon, and the tint behind it. */
export function entryIcon(entry: TimelineEntry): { Icon: LucideIcon; tint: string } {
  if (entry.kind === 'activity') {
    return { Icon: TYPE_ICONS[entry.type!], tint: `var(--color-kind-${entry.type}-tint)` }
  }
  if (entry.kind === 'status_change') return { Icon: UserCheck, tint: 'var(--color-kind-status-tint)' }
  return {
    Icon: entry.from_value ? ArrowRight : CirclePlus,
    tint: stageTint(entry.to_value as StageKey),
  }
}

/** A 30px round icon on a tint. */
export function KindIcon({ icon: Icon, tint }: { icon: LucideIcon; tint: string }) {
  return (
    <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-full text-ink" style={{ background: tint }}>
      <Icon size={15} />
    </span>
  )
}

export function EntryIcon({ entry }: { entry: TimelineEntry }) {
  const { Icon, tint } = entryIcon(entry)
  return <KindIcon icon={Icon} tint={tint} />
}

const toActivity = (entry: TimelineEntry): EditableActivity => ({
  id: entry.id,
  type: entry.type!,
  description: entry.text,
  occurred_at: entry.at,
  follow_up_date: entry.follow_up_date,
  follow_up_done: !!entry.follow_up_done,
})

/** A contact's or deal's timeline (R10), newest first, as the server sends it. */
export function Timeline({ entries, on }: { entries: TimelineEntry[]; on: 'contact' | 'deal' }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-ink-muted">Nothing has happened here yet.</p>
  }
  return (
    <ol aria-label="Timeline" className="flex flex-col">
      {entries.map((entry) => (
        <Entry key={entry.key} entry={entry} on={on} />
      ))}
    </ol>
  )
}

function Entry({ entry, on }: { entry: TimelineEntry; on: 'contact' | 'deal' }) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const change = useChangeActivity()
  const remove = useDeleteActivity()
  const isActivity = entry.kind === 'activity'
  // On a contact's timeline, entries from one of their deals name the deal (R10).
  const fromDeal = on === 'contact' && entry.record === 'deal' && entry.deal_id !== null
  const followUpDone = !!entry.follow_up_done
  const overdue = !followUpDone && !!entry.follow_up_overdue

  const markDone = (done: boolean) =>
    change.mutate(
      { id: entry.id, values: { follow_up_done: done }, message: done ? 'Follow-up done' : 'Follow-up not done' },
      { onError: () => notify.failed(UNREACHABLE_MESSAGE) },
    )

  const confirmDelete = () => remove.mutate(entry.id, { onError: () => notify.failed(UNREACHABLE_MESSAGE) })

  return (
    <li className="flex gap-3 border-t border-divider py-3 first:border-t-0">
      <EntryIcon entry={entry} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-line font-medium">{entry.text}</p>
          <span className="shrink-0 whitespace-nowrap pt-0.5 font-mono text-xs text-ink-muted">{timelineTime(entry.at)}</span>
          {isActivity && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <IconButton label={`Actions for this ${entry.type}`} tooltip="Edit or delete" className="-my-1.5">
                  <Ellipsis aria-hidden size={16} />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-32 rounded-card bg-panel p-1 shadow-lift">
                  <DropdownMenu.Item
                    onSelect={() => setEditing(true)}
                    className="flex h-8 cursor-pointer items-center rounded-control px-2.5 text-sm data-[highlighted]:bg-page"
                  >
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setDeleting(true)}
                    className="flex h-8 cursor-pointer items-center rounded-control px-2.5 text-sm text-alert-text data-[highlighted]:bg-page"
                  >
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
        {fromDeal && (
          <p className="mt-0.5 text-xs text-ink-muted">
            On{' '}
            <Link to={`/deals/${entry.deal_id}`} className="text-link hover:underline">
              {entry.deal_name}
            </Link>
          </p>
        )}
        {isActivity && entry.follow_up_date && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <DoneCheckbox
              checked={followUpDone}
              onCheckedChange={markDone}
              label="Done"
              describedBy={`${id}-follow-up`}
              disabled={change.isPending}
            />
            <span id={`${id}-follow-up`} className={overdue ? 'font-medium text-alert-text' : 'text-ink-muted'}>
              {followUpLabel(entry.follow_up_date, followUpDone, overdue)}
            </span>
          </div>
        )}
      </div>
      {isActivity && (
        <>
          <ActivityDialog open={editing} onOpenChange={setEditing} activity={toActivity(entry)} />
          <ConfirmDelete
            open={deleting}
            onOpenChange={setDeleting}
            question={activityQuestion(entry.type!)}
            confirmLabel={`Delete ${entry.type}`}
            onConfirm={confirmDelete}
            busy={remove.isPending}
          />
        </>
      )}
    </li>
  )
}
