import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Bar, BarChart, LabelList, Rectangle, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts'
import { ChartTable } from '../../components/ChartTable'
import { Panel } from '../../components/Panel'
import { money, shortMoney } from '../../lib/format'
import type { Dashboard, Stage } from '../../lib/types'
import { ChartTooltip, FIGURE, TICK, usd } from './ChartTooltip'
import { pipelineBars, summaries, type StageBar } from './chartData'

// Each stage's bar: the expected part solid in the stage's color from the baseline up, and
// the rest of its value in the tint above it, with a rounded top.
const solid = (props: BarShapeProps) => <Rectangle {...props} fill={(props.payload as StageBar).color} />
const tinted = (props: BarShapeProps) => <Rectangle {...props} fill={(props.payload as StageBar).tint} radius={[4, 4, 0, 0]} />

function StageTick({ x, y, payload, bars }: { x?: number; y?: number; payload?: { value: string }; bars: StageBar[] }) {
  const bar = bars.find((b) => b.name === payload?.value)
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink)">
        {payload?.value}
      </text>
      <text y={26} textAnchor="middle" {...TICK}>
        {bar ? `${shortMoney(bar.expected)} exp.` : ''}
      </text>
    </g>
  )
}

/** The open pipeline as one column per open stage, with the expected part solid. */
export function PipelineByStage({ dashboard, stages }: { dashboard: Dashboard; stages: Stage[] }) {
  const bars = pipelineBars(dashboard, stages)
  return (
    <Panel
      title="Open pipeline by stage"
      subtitle="Solid: expected revenue"
      className="col-span-4"
      action={
        <Link to="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-semibold text-link hover:underline">
          Pipeline <ArrowRight aria-hidden size={14} />
        </Link>
      }
    >
      <p className="sr-only">{summaries(dashboard).pipeline}</p>
      <Link to="/pipeline" aria-hidden tabIndex={-1} className="block">
        <BarChart data={bars} responsive style={{ width: '100%', height: 250 }} margin={{ top: 22, right: 0, bottom: 0, left: 0 }} barSize={26} accessibilityLayer={false}>
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: 'var(--color-divider)' }} interval={0} height={40} tick={<StageTick bars={bars} />} />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            cursor={{ fill: 'var(--color-page)' }}
            content={<ChartTooltip title={(p) => String(p.name)} lines={(p) => [['Value', usd(p.value)], ['Expected', usd(p.expected)], ['Deals', String(p.count)]]} />}
          />
          <Bar dataKey="expected" stackId="stage" shape={solid} isAnimationActive={false} />
          <Bar dataKey="rest" stackId="stage" shape={tinted} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="top"
              {...FIGURE}
              formatter={(value) => shortMoney(Number(value))}
            />
          </Bar>
        </BarChart>
      </Link>
      <ChartTable
        caption="Open pipeline by stage"
        headers={['Stage', 'Open deals', 'Value (USD)', 'Expected revenue (USD)']}
        rows={bars.map((b) => [b.name, String(b.count), money(b.value), money(b.expected)])}
      />
    </Panel>
  )
}
