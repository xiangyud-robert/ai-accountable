import { longDate } from '../lib/format'
import type { Person } from '../lib/types'

type Authored = {
  created_at: string
  created_by: Person | null
  updated_at: string
  updated_by: Person | null
}

/** Adding a record sets both people and both times alike, so any difference means a change. */
const hasChanged = (record: Authored) =>
  record.updated_at !== record.created_at || record.updated_by?.id !== record.created_by?.id

/**
 * Who added a record and who last changed it, with when (R17), for the end of its details.
 * A record from before sign-in has no one recorded, so it shows nothing.
 */
export function AddedBy({ record }: { record: Authored }) {
  const added = record.created_by
  const changed = hasChanged(record) ? record.updated_by : null
  if (!added && !changed) return null
  return (
    <div className="mt-5 flex flex-col gap-0.5 text-xs text-ink-muted">
      {added && (
        <p>
          Added by {added.name} on {longDate(record.created_at)}
        </p>
      )}
      {changed && (
        <p>
          Last changed by {changed.name} on {longDate(record.updated_at)}
        </p>
      )}
    </div>
  )
}
