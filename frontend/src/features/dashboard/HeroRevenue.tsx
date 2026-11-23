import { Area, AreaChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTable } from '../../components/ChartTable'
import { Panel } from '../../components/Panel'
import { money, monthName, shortMoney } from '../../lib/format'
import type { Dashboard } from '../../lib/types'
import { ChartTooltip, FIGURE, TICK, usd } from './ChartTooltip'
import { moneyTicks, months, summaries } from './chartData'

/** The main figure, revenue won this month, over the line chart of the last 12 months. */
export function HeroRevenue({ dashboard }: { dashboard: Dashboard }) {
  const points = months(dashboard)
  const peak = Math.max(...points.map((p) => p.revenue))
  const last = points.length - 1
  const ticks = moneyTicks(peak)
  const thisMonth = monthName(`${dashboard.this_month.month}-01`)
  const lastMonth = monthName(`${dashboard.last_month.month}-01`)

  return (
    <Panel className="col-span-8 flex flex-col">
      <div className="mb-1.5 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-sm font-semibold">Revenue won in {thisMonth}</h2>
          <p className="mt-1.5 font-mono text-[46px] font-medium leading-[1.1] tracking-[-0.04em]">{money(dashboard.this_month.revenue)}</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {lastMonth}: <span className="font-mono font-medium text-ink">{money(dashboard.last_month.revenue)}</span>
          </p>
        </div>
        <div className="text-right text-[13px] text-ink-muted">
          Last 12 months
          <p className="my-0.5 font-mono text-[22px] font-medium text-ink">{money(dashboard.last_12_months.value)}</p>
          <span className="font-mono font-medium text-ink">{dashboard.last_12_months.count}</span> deals won · USD
        </div>
      </div>
      <h3 className="sr-only">Revenue won by month</h3>
      <p className="sr-only">{summaries(dashboard).revenue}</p>
      {/* The chart fills the panel, which is as tall as the three tiles beside it. */}
      <div aria-hidden className="min-h-[236px] flex-1">
        <AreaChart data={points} responsive style={{ width: '100%', height: '100%' }} margin={{ top: 22, right: 44, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--color-divider)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval={0} />
          <YAxis ticks={ticks} domain={[0, ticks.at(-1)!]} tickFormatter={(v) => shortMoney(Number(v))} tickLine={false} axisLine={false} tick={TICK} width={56} />
          <Tooltip
            cursor={{ stroke: 'var(--color-divider)' }}
            content={<ChartTooltip title={(p) => String(p.long)} lines={(p) => [['Won', usd(p.revenue)], ['Deals', String(p.count)]]} />}
          />
          <Area
            type="linear"
            dataKey="revenue"
            stroke="var(--color-chart-won)"
            strokeWidth={2.5}
            fill="var(--color-chart-wash)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-chart-won)', stroke: 'var(--color-panel)', strokeWidth: 2 }}
            isAnimationActive={false}
          >
            {/* The peak and this month are labelled, as in mockup C. */}
            <LabelList
              dataKey="revenue"
              content={({ x, y, value, index }) =>
                (index === last || (Number(value) === peak && peak > 0)) && typeof x === 'number' && typeof y === 'number' ? (
                  <g>
                    <circle cx={x} cy={y} r={3.5} fill="var(--color-chart-won)" />
                    <text x={x + (index === last ? 8 : 0)} y={y - (index === last ? 0 : 9)} textAnchor={index === last ? 'start' : 'middle'} dominantBaseline={index === last ? 'middle' : 'auto'} {...FIGURE}>
                      {shortMoney(Number(value))}
                    </text>
                  </g>
                ) : null
              }
            />
          </Area>
        </AreaChart>
      </div>
      <ChartTable caption="Revenue won by month" headers={['Month', 'Revenue won (USD)', 'Deals won']} rows={points.map((p) => [p.long, money(p.revenue), String(p.count)])} />
    </Panel>
  )
}
