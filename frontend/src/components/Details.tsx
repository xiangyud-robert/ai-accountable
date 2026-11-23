import type { ReactNode } from 'react'

/** A record's details as label and value pairs. Empty values show a dash. */
export function Details({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-3.5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[13px] font-medium text-ink-muted">{label}</dt>
          <dd className="mt-0.5 break-words">{value ?? <span className="text-ink-muted">-</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
