import type { ReactNode } from 'react'

/** One plain line, and usually an Add button. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-ink-muted">{message}</p>
      {action}
    </div>
  )
}
