import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { StatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDelete, contactQuestion } from '../../components/ConfirmDelete'
import { Details } from '../../components/Details'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { NotFound, UNREACHABLE_MESSAGE } from '../../lib/api'
import { LogActivityForm } from '../activities/LogActivityForm'
import { Timeline } from '../activities/Timeline'
import { DealForm } from '../deals/DealForm'
import { DealList } from '../deals/DealList'
import { ContactForm } from './ContactForm'
import { useContact, useDeleteContact } from './queries'

export function ContactPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  // Once it's being deleted, its query stops, so nothing asks for a record that's gone.
  const [deleted, setDeleted] = useState(false)
  const contact = useContact(id, { enabled: Number.isInteger(id) && !deleted })
  const remove = useDeleteContact()
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'deal' | null>(null)

  const error = Number.isInteger(id) ? contact.error : new NotFound('Not found')
  if (error) return <ErrorState error={error} kind="contact" listPath="/contacts" listName="contacts" />
  const person = contact.data
  if (!person) return null

  const close = (open: boolean) => !open && setDialog(null)
  const confirmDelete = () => {
    setDeleted(true)
    remove.mutate(person.id, {
      onSuccess: () => {
        notify.done('Contact deleted')
        navigate('/contacts')
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
        title={person.name}
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
        <div className="mt-2">
          <StatusBadge status={person.status} />
        </div>
      </PageHeader>
      <div className="grid grid-cols-12 items-start gap-5">
        <div className="col-span-4 flex flex-col gap-5">
          <Panel title="Details">
            <Details
              items={[
                ['Job title', person.job_title],
                [
                  'Organization',
                  person.organization && (
                    <Link to={`/organizations/${person.organization.id}`} className="text-link hover:underline">
                      {person.organization.name}
                    </Link>
                  ),
                ],
                [
                  'Email',
                  person.email && (
                    <a href={`mailto:${person.email}`} className="text-link hover:underline">
                      {person.email}
                    </a>
                  ),
                ],
                ['Phone', person.phone && <span className="font-mono text-[13px]">{person.phone}</span>],
              ]}
            />
          </Panel>
          <Panel
            title="Deals"
            subtitle="Where they're the main contact"
            action={
              <Button icon={<Plus aria-hidden size={16} />} onClick={() => setDialog('deal')}>
                Add deal
              </Button>
            }
          >
            <DealList deals={person.deals} empty="No deals yet." />
          </Panel>
        </div>
        <Panel title="Timeline" subtitle="Their activities, their deals and their status" className="col-span-8">
          <LogActivityForm on={{ contact_id: person.id }} />
          <div className="mt-4">
            <Timeline entries={person.timeline} on="contact" />
          </div>
        </Panel>
      </div>
      <ContactForm open={dialog === 'edit'} onOpenChange={close} contact={person} />
      <DealForm
        open={dialog === 'deal'}
        onOpenChange={close}
        defaults={{ contact_id: person.id, organization_id: person.organization_id }}
      />
      <ConfirmDelete
        open={dialog === 'delete'}
        onOpenChange={close}
        question={contactQuestion(person.name, person.deal_count, person.activity_count)}
        confirmLabel="Delete contact"
        onConfirm={confirmDelete}
        busy={remove.isPending}
      />
    </>
  )
}
