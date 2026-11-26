import { Funnel as FunnelShape, FunnelChart, Tooltip } from 'recharts'
import { ChartTable } from '../../components/ChartTable'
import { Panel } from '../../components/Panel'
import { money, shortMoney } from '../../lib/format'
import type { Dashboard, Stage } from '../../lib/types'
import { ChartTooltip, usd } from './ChartTooltip'
import { funnel, summaries } from './chartData'

const STEP = 42

/** The value reaching each stage, from New to Won (concern 7), with the lost total beneath. */
export function Funnel({ dashboard, stages }: { dashboard: Dashboard; stages: Stage[] }) {
  const steps = funnel(dashboard, stages)
  const text = summaries(dashboard)
  return (
    <Panel title="Sales funnel" subtitle="Value reaching each stage" className="col-span-4">
      <p className="sr-only">{text.funnel}</p>
      <div className="flex gap-3.5">
        <div aria-hidden className="shrink-0">
          {/* Each trapezoid narrows from its stage's value to the next one's, and Won is a
              rectangle. The panel-colored outline makes the 2px gap between them. */}
          <FunnelChart
            width={150}
            height={steps.length * STEP}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <Tooltip
              content={
                <ChartTooltip
                  title={(p) => String(p.name)}
                  lines={(p) => [
                    ['Deals', String(p.count)],
                    ['Value', usd(p.value)],
                  ]}
                />
              }
            />
            <FunnelShape
              dataKey="value"
              data={steps}
              lastShapeType="rectangle"
              stroke="var(--color-panel)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </FunnelChart>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col">
          {steps.map((step) => (
            <li key={step.stage} className="flex flex-col justify-center" style={{ height: STEP }}>
              <span className="text-[13px] font-semibold">
                {step.name} <span className="font-medium text-ink-muted">· {step.count}</span>
              </span>
              <span className="font-mono text-xs text-ink-muted" title={money(step.value)}>
                <span className="font-medium text-ink">{shortMoney(step.value)}</span> · {step.share}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3.5 flex items-center gap-2 text-[13px] text-ink-muted">
        <span aria-hidden className="size-2 rounded-full bg-neutral" />
        Lost: <span className="font-mono font-medium text-ink">{dashboard.lost.count}</span> deals,{' '}
        <span className="font-mono font-medium text-ink">{money(dashboard.lost.value)}</span>
      </p>
      <ChartTable
        caption="Sales funnel"
        headers={['Stage', 'Deals reaching it', 'Value reaching it (USD)', 'Share of New’s value']}
        rows={steps.map((s) => [s.name, String(s.count), money(s.value), `${s.share}%`])}
      />
    </Panel>
  )
}
