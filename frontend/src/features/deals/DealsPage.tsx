import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LateBadge, StageBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDelete, dealQuestion } from '../../components/ConfirmDelete'
import { DataTable, type Column } from '../../components/DataTable'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { longDate, money, percent } from '../../lib/format'
import { useStages } from '../../lib/stages'
import type { DealRow, Stage } from '../../lib/types'
import { DealForm } from './DealForm'
import { useDeals, useDeleteDeal } from './queries'

function dealColumns(stages: Stage[]): Column<DealRow>[] {
  const order = new Map(stages.map((s) => [s.key, s.order]))
  const name = new Map(stages.map((s) => [s.key, s.name]))
  return [
    {
      id: 'name',
      header: 'Name',
      value: (d) => d.name,
      cell: (d) => (
        <Link to={`/deals/${d.id}`} className="font-medium text-link hover:underline">
          {d.name}
        </Link>
      ),
    },
    { id: 'organization', header: 'Organization', value: (d) => d.organization_name },
    { id: 'contact', header: 'Main contact', value: (d) => d.contact_name },
    {
      id: 'stage',
      header: 'Stage',
      value: (d) => d.stage,
      text: (d) => name.get(d.stage) ?? d.stage,
      // Always pipeline order, never alphabetical, then by close date.
      compare: (a, b) => order.get(a.stage)! - order.get(b.stage)! || a.close_date.localeCompare(b.close_date),
      cell: (d) => <StageBadge stage={d.stage} />,
    },
    {
      id: 'value',
      header: 'Value (USD)',
      value: (d) => d.value,
      text: (d) => money(d.value),
      cell: (d) => money(d.value),
      numeric: true,
    },
    {
      id: 'probability',
      header: 'Probability',
      value: (d) => d.probability,
      text: (d) => percent(d.probability),
      cell: (d) => percent(d.probability),
      numeric: true,
    },
    {
      id: 'expected',
      header: 'Expected (USD)',
      value: (d) => d.expected,
      text: (d) => money(d.expected),
      cell: (d) => money(d.expected),
      numeric: true,
    },
    {
      id: 'close_date',
      header: 'Close date',
      value: (d) => d.close_date,
      text: (d) => longDate(d.close_date),
      cell: (d) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className={`font-mono text-[13px] ${d.late ? 'text-alert-text' : ''}`}>{longDate(d.close_date)}</span>
          {d.late && <LateBadge />}
        </span>
      ),
    },
  ]
}

export function DealsPage() {
  const deals = useDeals()
  const { data: stages } = useStages()
  const remove = useDeleteDeal()
  const [editing, setEditing] = useState<DealRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DealRow | null>(null)
  const columns = useMemo(() => (stages ? dealColumns(stages) : []), [stages])

  const add = (
    <Button variant="primary" icon={<Plus aria-hidden size={16} />} onClick={() => setEditing('new')}>
      Add deal
    </Button>
  )

  const confirmDelete = () =>
    remove.mutate(deleting!.id, {
      onSuccess: () => {
        notify.done('Deal deleted')
        setDeleting(null)
      },
      onError: () => notify.failed(UNREACHABLE_MESSAGE),
    })

  return (
    <>
      <PageHeader title="Deals" actions={add} />
      {deals.error ? (
        <ErrorState error={deals.error} />
      ) : deals.data && stages ? (
        <Panel>
          <DataTable
            label="Deals"
            rows={deals.data}
            columns={columns}
            noun={['deal', 'deals']}
            initialSort={{ id: 'stage' }}
            rowId={(d) => d.id}
            rowName={(d) => d.name}
            onEdit={setEditing}
            onDelete={setDeleting}
            emptyAction={add}
          />
        </Panel>
      ) : null}
      <DealForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        deal={editing === 'new' ? undefined : (editing ?? undefined)}
      />
      {deleting && (
        <ConfirmDelete
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          question={dealQuestion(deleting.name, deleting.activity_count)}
          confirmLabel="Delete deal"
          onConfirm={confirmDelete}
          busy={remove.isPending}
        />
      )}
    </>
  )
}
