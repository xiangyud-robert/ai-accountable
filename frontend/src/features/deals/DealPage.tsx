import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LateBadge, StageBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDelete, dealQuestion } from '../../components/ConfirmDelete'
import { Details } from '../../components/Details'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { NotFound, UNREACHABLE_MESSAGE } from '../../lib/api'
import { longDate, money, percent } from '../../lib/format'
import { useStages } from '../../lib/stages'
import { LogActivityForm } from '../activities/LogActivityForm'
import { Timeline } from '../activities/Timeline'
import { DealForm } from './DealForm'
import { useDeal, useDeleteDeal } from './queries'

export function DealPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: stages } = useStages()
  // Once it's being deleted, its query stops, so nothing asks for a record that's gone.
  const [deleted, setDeleted] = useState(false)
  const query = useDeal(id, { enabled: Number.isInteger(id) && !deleted })
  const remove = useDeleteDeal()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)

  const error = Number.isInteger(id) ? query.error : new NotFound('Not found')
  if (error) return <ErrorState error={error} kind="deal" listPath="/deals" listName="deals" />
  const deal = query.data
  if (!deal || !stages) return null
  const open = stages.find((s) => s.key === deal.stage)!.open

  const close = (isOpen: boolean) => !isOpen && setDialog(null)
  const confirmDelete = () => {
    setDeleted(true)
    remove.mutate(deal.id, {
      onSuccess: () => {
        notify.done('Deal deleted')
        navigate('/deals')
      },
      onError: () => {
        setDeleted(false)
        notify.failed(UNREACHABLE_MESSAGE)
      },
    })
  }

  return (
    <>
      <PageHeader
        title={deal.name}
        actions={
          <>
            <Button icon={<Pencil aria-hidden size={16} />} onClick={() => setDialog('edit')}>
              Edit
            </Button>
            <Button icon={<Trash2 aria-hidden size={16} />} onClick={() => setDialog('delete')}>
              Delete
            </Button>
          </>
        }
      >
        <div className="mt-2 flex items-center gap-2">
          <StageBadge stage={deal.stage} />
          {deal.late && <LateBadge />}
        </div>
      </PageHeader>
      <div className="grid grid-cols-12 items-start gap-5">
        <Panel title="Details" className="col-span-4">
          <Details
            items={[
              ['Value (USD)', <span className="font-mono">{money(deal.value)}</span>],
              ['Probability', <span className="font-mono">{percent(deal.probability)}</span>],
              ['Expected revenue (USD)', <span className="font-mono">{open ? money(deal.expected) : '-'}</span>],
              [
                open ? 'Expected close' : 'Closed',
                <span className={`font-mono ${deal.late ? 'text-alert-text' : ''}`}>{longDate(deal.close_date)}</span>,
              ],
              [
                'Organization',
                deal.organization_id && (
                  <Link to={`/organizations/${deal.organization_id}`} className="text-link hover:underline">
                    {deal.organization_name}
                  </Link>
                ),
              ],
              [
                'Main contact',
                deal.contact_id && (
                  <Link to={`/contacts/${deal.contact_id}`} className="text-link hover:underline">
                    {deal.contact_name}
                  </Link>
                ),
              ],
            ]}
          />
        </Panel>
        <Panel title="Timeline" subtitle="Its activities and stage changes" className="col-span-8">
          <LogActivityForm on={{ deal_id: deal.id }} />
          <div className="mt-4">
            <Timeline entries={deal.timeline} on="deal" />
          </div>
        </Panel>
      </div>
      <DealForm open={dialog === 'edit'} onOpenChange={close} deal={deal} />
      <ConfirmDelete
        open={dialog === 'delete'}
        onOpenChange={close}
        question={dealQuestion(deal.name, deal.activity_count)}
        confirmLabel="Delete deal"
        onConfirm={confirmDelete}
        busy={remove.isPending}
      />
    </>
  )
}
