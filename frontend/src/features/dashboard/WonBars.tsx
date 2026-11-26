import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTable } from '../../components/ChartTable'
import { Panel } from '../../components/Panel'
import { money } from '../../lib/format'
import type { Dashboard } from '../../lib/types'
import { ChartTooltip, FIGURE, TICK, usd } from './ChartTooltip'
import { months } from './chartData'

/** Deals won in each of the last 12 months, with the count on each bar. */
export function WonBars({ dashboard }: { dashboard: Dashboard }) {
  const points = months(dashboard)
  return (
    <Panel
      title="Deals won by month"
      subtitle={
        <>
          <span className="font-mono">{dashboard.last_12_months.count}</span> in the last 12 months
        </>
      }
      className="col-span-4"
    >
      <div aria-hidden>
        <BarChart
          data={points}
          responsive
          style={{ width: '100%', height: 250 }}
          margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--color-divider)' }}
            tick={TICK}
            tickMargin={8}
            interval={0}
          />
          <YAxis hide allowDecimals={false} domain={[0, 'dataMax']} />
          <Tooltip
            cursor={{ fill: 'var(--color-page)' }}
            content={
              <ChartTooltip
                title={(p) => String(p.long)}
                lines={(p) => [
                  ['Deals won', String(p.count)],
                  ['Revenue', usd(p.revenue)],
                ]}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-chart-won)"
            radius={[4, 4, 0, 0]}
            barSize={14}
            isAnimationActive={false}
          >
            <LabelList dataKey="count" position="top" {...FIGURE} />
          </Bar>
        </BarChart>
      </div>
      <ChartTable
        caption="Deals won by month"
        headers={['Month', 'Deals won', 'Revenue won (USD)']}
        rows={points.map((p) => [p.long, String(p.count), money(p.revenue)])}
      />
    </Panel>
  )
}
