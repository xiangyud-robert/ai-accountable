import { money } from '../../lib/format'

type ChartTooltipProps = {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
  /** The tooltip's lines for the point under the pointer. */
  lines: (point: Record<string, unknown>) => [string, string][]
  title: (point: Record<string, unknown>) => string
}

/** A white panel with full USD amounts in the mono font. */
export function ChartTooltip({ active, payload, lines, title }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-control bg-panel px-3 py-2 text-xs shadow-lift">
      <p className="font-semibold">{title(point)}</p>
      {lines(point).map(([label, value]) => (
        <p key={label} className="text-ink-muted">
          {label} <span className="font-mono font-medium text-ink">{value}</span>
        </p>
      ))}
    </div>
  )
}

export const usd = (value: unknown) => money(Number(value))

// Axis and label text, by role.
export const TICK = { fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--color-ink-muted)' }
export const FIGURE = { fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, fill: 'var(--color-ink)' }
