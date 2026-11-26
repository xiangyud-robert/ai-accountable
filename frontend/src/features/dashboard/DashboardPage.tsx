import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { dateline, money, monthName } from '../../lib/format'
import { useStages } from '../../lib/stages'
import { DealForm } from '../deals/DealForm'
import { FollowUps } from './FollowUps'
import { Funnel } from './Funnel'
import { HeroRevenue } from './HeroRevenue'
import { PipelineByStage } from './PipelineByStage'
import { RecentActivity } from './RecentActivity'
import { StatTile } from './StatTile'
import { WonBars } from './WonBars'
import { useDashboard } from './queries'

export function DashboardPage() {
  const query = useDashboard()
  const { data: stages } = useStages()
  const [adding, setAdding] = useState(false)
  const dashboard = query.data

  const header = (
    <PageHeader
      title="Dashboard"
      eyebrow={dashboard ? dateline(dashboard.today) : undefined}
      actions={
        <Button variant="primary" icon={<Plus aria-hidden size={16} />} onClick={() => setAdding(true)}>
          Add deal
        </Button>
      }
    />
  )

  if (query.error) {
    return (
      <>
        {header}
        <ErrorState error={query.error} />
      </>
    )
  }
  if (!dashboard || !stages) return header

  const { open } = dashboard
  const share = open.value > 0 ? Math.round((open.expected / open.value) * 100) : 0
  const b = (text: string | number) => <span className="font-mono font-medium text-ink">{text}</span>

  return (
    <>
      {header}
      <div className="grid grid-cols-12 gap-5">
        <HeroRevenue dashboard={dashboard} />
        <div className="col-span-4 flex flex-col gap-5">
          <StatTile
            label={`Deals won in ${monthName(`${dashboard.this_month.month}-01`)}`}
            value={String(dashboard.this_month.count)}
          >
            {monthName(`${dashboard.last_month.month}-01`)}: {b(dashboard.last_month.count)}
          </StatTile>
          <StatTile label="Open pipeline" value={money(open.value)}>
            {b(open.count)} open deals
          </StatTile>
          <StatTile label="Expected revenue" value={money(open.expected)}>
            {b(`${share}%`)} of the open pipeline
          </StatTile>
        </div>
        <WonBars dashboard={dashboard} />
        <Funnel dashboard={dashboard} stages={stages} />
        <PipelineByStage dashboard={dashboard} stages={stages} />
        <FollowUps dashboard={dashboard} />
        <RecentActivity dashboard={dashboard} />
      </div>
      <DealForm open={adding} onOpenChange={setAdding} />
    </>
  )
}
