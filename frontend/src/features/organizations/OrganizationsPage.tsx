import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { ConfirmDelete, organizationQuestion } from '../../components/ConfirmDelete'
import { DataTable, type Column } from '../../components/DataTable'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { money } from '../../lib/format'
import type { OrganizationRow } from '../../lib/types'
import { OrganizationForm } from './OrganizationForm'
import { useDeleteOrganization, useOrganizations } from './queries'

const COLUMNS: Column<OrganizationRow>[] = [
  {
    id: 'name',
    header: 'Name',
    value: (o) => o.name,
    cell: (o) => (
      <Link to={`/organizations/${o.id}`} className="font-medium text-link hover:underline">
        {o.name}
      </Link>
    ),
  },
  { id: 'industry', header: 'Industry', value: (o) => o.industry },
  {
    id: 'website',
    header: 'Website',
    value: (o) => o.website?.replace(/^https?:\/\//, '') ?? null,
    cell: (o) => <span className="text-ink-muted">{o.website?.replace(/^https?:\/\//, '')}</span>,
  },
  { id: 'contacts', header: 'Contacts', value: (o) => o.contact_count, numeric: true },
  { id: 'open_deals', header: 'Open deals', value: (o) => o.open_deal_count, numeric: true },
  {
    id: 'open_value',
    header: 'Open value (USD)',
    value: (o) => o.open_value,
    text: (o) => money(o.open_value),
    cell: (o) => money(o.open_value),
    numeric: true,
  },
]

export function OrganizationsPage() {
  const organizations = useOrganizations()
  const remove = useDeleteOrganization()
  const [editing, setEditing] = useState<OrganizationRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<OrganizationRow | null>(null)
  const columns = useMemo(() => COLUMNS, [])

  const add = (
    <Button variant="primary" icon={<Plus aria-hidden size={16} />} onClick={() => setEditing('new')}>
      Add organization
    </Button>
  )

  const confirmDelete = () =>
    remove.mutate(deleting!.id, {
      onSuccess: () => {
        notify.done('Organization deleted')
        setDeleting(null)
      },
      onError: () => notify.failed(UNREACHABLE_MESSAGE),
    })

  return (
    <>
      <PageHeader title="Organizations" actions={add} />
      {organizations.error ? (
        <ErrorState error={organizations.error} />
      ) : organizations.data ? (
        <Panel>
          <DataTable
            label="Organizations"
            rows={organizations.data}
            columns={columns}
            noun={['organization', 'organizations']}
            initialSort={{ id: 'name' }}
            rowId={(o) => o.id}
            rowName={(o) => o.name}
            onEdit={setEditing}
            onDelete={setDeleting}
            emptyAction={add}
          />
        </Panel>
      ) : null}
      <OrganizationForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        organization={editing === 'new' ? undefined : (editing ?? undefined)}
      />
      {deleting && (
        <ConfirmDelete
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          question={organizationQuestion(deleting.name, deleting.contact_count, deleting.deal_count)}
          confirmLabel="Delete organization"
          onConfirm={confirmDelete}
          busy={remove.isPending}
        />
      )}
    </>
  )
}
