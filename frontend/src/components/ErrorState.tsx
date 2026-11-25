import { Link } from 'react-router'
import { NotFound, UNREACHABLE_MESSAGE } from '../lib/api'
import { Panel } from './Panel'

type ErrorStateProps = {
  error: unknown
  /** For a missing record: its kind and the list to go back to, such as "deal" and "/deals". */
  kind?: string
  listPath?: string
  listName?: string
}

export function ErrorState({ error, kind, listPath, listName }: ErrorStateProps) {
  if (error instanceof NotFound && kind && listPath) {
    return (
      <Panel>
        <title>{`This ${kind} no longer exists - Accountable`}</title>
        <h1 className="text-xl font-semibold">This {kind} no longer exists</h1>
        <p className="mt-2 text-ink-muted">
          <Link to={listPath} className="font-semibold text-link hover:underline">
            Back to {listName}
          </Link>
        </p>
      </Panel>
    )
  }
  // A record page has no header of its own while it can't load, so the message is its main heading.
  return (
    <Panel>
      <div role="alert">
        {kind ? <h1 className="text-xl font-semibold">{UNREACHABLE_MESSAGE}</h1> : <p className="text-ink">{UNREACHABLE_MESSAGE}</p>}
      </div>
    </Panel>
  )
}
