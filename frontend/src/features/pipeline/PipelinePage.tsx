import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { money } from '../../lib/format'
import { useStages } from '../../lib/stages'
import type { StageKey } from '../../lib/types'
import { DealForm } from '../deals/DealForm'
import { useDeals } from '../deals/queries'
import { boardTotals } from './board'
// With the extension: on Mac and Windows, './Board' would find board.ts first.
import { Board } from './Board.tsx'

export function PipelinePage() {
  const deals = useDeals()
  const { data: stages } = useStages()
  const [adding, setAdding] = useState<StageKey | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const totals = deals.data && stages ? boardTotals(deals.data, stages) : null

  return (
    <>
      <PageHeader
        title="Pipeline"
        actions={
          <>
            {totals && (
              <dl aria-label="Open deals" className="flex gap-[22px] rounded-card bg-panel px-3.5 py-2 shadow-panel">
                {[
                  ['Open deals', String(totals.count)],
                  ['Open value', money(totals.value)],
                  ['Expected revenue', money(totals.expected)],
                ].map(([label, figure]) => (
                  <div key={label}>
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    <dd className="font-mono text-base font-medium">{figure}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Button variant="primary" icon={<Plus aria-hidden size={16} />} onClick={() => setAdding('new')}>
              Add deal
            </Button>
          </>
        }
      />
      {deals.error ? (
        <ErrorState error={deals.error} />
      ) : deals.data && stages ? (
        <Board deals={deals.data} stages={stages} onAdd={setAdding} announcement={setAnnouncement} />
      ) : null}
      <div aria-live="assertive" role="status" className="sr-only" data-testid="pipeline-announcements">
        {announcement}
      </div>
      <DealForm
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        defaults={{ stage: adding ?? 'new' }}
      />
    </>
  )
}
