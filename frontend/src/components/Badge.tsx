import type { ReactNode } from 'react'
import { dueLabel } from '../lib/format'
import { stageColor, stageTint, statusColor, statusName, statusTint, useStages } from '../lib/stages'
import type { StageKey, Status } from '../lib/types'

/** A pill with a tint background, ink text and a dot in the full color. */
export function Badge({ dot, tint, children }: { dot: string; tint: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium text-ink"
      style={{ background: tint }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} />
      {children}
    </span>
  )
}

export function StageBadge({ stage }: { stage: StageKey }) {
  const { data: stages } = useStages()
  const name = stages?.find((s) => s.key === stage)?.name ?? ''
  return (
    <Badge dot={stageColor(stage)} tint={stageTint(stage)}>
      {name}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge dot={statusColor(status)} tint={statusTint(status)}>
      {statusName(status)}
    </Badge>
  )
}

export function LateBadge() {
  return (
    <Badge dot="var(--color-alert)" tint="var(--color-alert-tint)">
      Late
    </Badge>
  )
}

/** "3 days overdue" in the alert tint, "Due today" in the caution tint, and neutral otherwise. */
export function DueBadge({ days }: { days: number }) {
  const [dot, tint] =
    days < 0 ? ['alert', 'alert-tint'] : days === 0 ? ['caution', 'caution-tint'] : ['neutral', 'neutral-tint']
  return (
    <Badge dot={`var(--color-${dot})`} tint={`var(--color-${tint})`}>
      {dueLabel(days)}
    </Badge>
  )
}
