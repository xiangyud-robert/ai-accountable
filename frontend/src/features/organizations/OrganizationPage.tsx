import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AddedBy } from '../../components/AddedBy'
import { Button } from '../../components/Button'
import { ConfirmDelete, organizationQuestion } from '../../components/ConfirmDelete'
import { Details } from '../../components/Details'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { NotFound, UNREACHABLE_MESSAGE } from '../../lib/api'
import { money, plural } from '../../lib/format'
import { ContactForm } from '../contacts/ContactForm'
import { ContactList } from '../contacts/ContactList'
import { DealForm } from '../deals/DealForm'
import { DealList } from '../deals/DealList'
import { OrganizationForm } from './OrganizationForm'
import { useDeleteOrganization, useOrganization } from './queries'

export function OrganizationPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  // Once it's being deleted, its query stops, so nothing asks for a record that's gone.
  const [deleted, setDeleted] = useState(false)
  const organization = useOrganization(id, { enabled: Number.isInteger(id) && !deleted })
  const remove = useDeleteOrganization()
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'contact' | 'deal' | null>(null)

  const error = Number.isInteger(id) ? organization.error : new NotFound('Not found')
  if (error) return <ErrorState error={error} kind="organization" listPath="/organizations" listName="organizations" />
  const org = organization.data
  if (!org) return null

  const close = (open: boolean) => !open && setDialog(null)
  const confirmDelete = () => {
    setDeleted(true)
    remove.mutate(org.id, {
      onSuccess: () => {
        notify.done('Organization deleted')
        navigate('/organizations')
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
        title={org.name}
        actions={
          <>
            <Button icon={<Pencil aria-hidden size={16} />} onClick={() => setDialog('edit')}>
              Edit
            </Button>
            <Button variant="danger" icon={<Trash2 aria-hidden size={16} />} onClick={() => setDialog('delete')}>
              Delete
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-12 items-start gap-5">
        <Panel title="Details" className="col-span-4">
          <Details
            items={[
              ['Industry', org.industry],
              [
                'Website',
                org.website && (
                  <a href={org.website} target="_blank" rel="noreferrer" className="text-link hover:underline">
                    {org.website.replace(/^https?:\/\//, '')}
                  </a>
                ),
              ],
              ['Notes', org.notes && <span className="whitespace-pre-line">{org.notes}</span>],
            ]}
          />
          <AddedBy record={org} />
        </Panel>
        <Panel
          title="Contacts"
          subtitle={plural(org.contacts.length, 'contact')}
          className="col-span-4"
          action={
            <Button icon={<Plus aria-hidden size={16} />} onClick={() => setDialog('contact')}>
              Add contact
            </Button>
          }
        >
          <ContactList contacts={org.contacts} empty="No contacts yet." />
        </Panel>
        <Panel
          title="Deals"
          subtitle={
            <>
              <span className="font-mono text-ink">{money(org.open_value)}</span> open,{' '}
              <span className="font-mono text-ink">{money(org.won_value)}</span> won
            </>
          }
          className="col-span-4"
          action={
            <Button icon={<Plus aria-hidden size={16} />} onClick={() => setDialog('deal')}>
              Add deal
            </Button>
          }
        >
          <DealList deals={org.deals} empty="No deals yet." />
        </Panel>
      </div>
      <OrganizationForm open={dialog === 'edit'} onOpenChange={close} organization={org} />
      <ContactForm open={dialog === 'contact'} onOpenChange={close} defaults={{ organization_id: org.id }} />
      <DealForm open={dialog === 'deal'} onOpenChange={close} defaults={{ organization_id: org.id }} />
      <ConfirmDelete
        open={dialog === 'delete'}
        onOpenChange={close}
        question={organizationQuestion(org.name, org.contact_count, org.deal_count)}
        confirmLabel="Delete organization"
        onConfirm={confirmDelete}
        busy={remove.isPending}
      />
    </>
  )
}
