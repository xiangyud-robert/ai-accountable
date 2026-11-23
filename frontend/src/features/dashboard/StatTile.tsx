import type { ReactNode } from 'react'
import { Link } from 'react-router'

type StatTileProps = { label: string; value: string; children: ReactNode }

/** One of the three tiles beside the main figure. Each links to the pipeline. */
export function StatTile({ label, value, children }: StatTileProps) {
  return (
    <Link
      to="/pipeline"
      className="flex flex-1 flex-col justify-center rounded-panel bg-panel px-6 py-[22px] shadow-panel transition hover:shadow-lift"
    >
      <h2 className="text-[13px] font-medium text-ink-muted">{label}</h2>
      <p className="mb-1 mt-1.5 font-mono text-[26px] font-medium tracking-[-0.03em]">{value}</p>
      <p className="text-[13px] text-ink-muted">{children}</p>
    </Link>
  )
}
