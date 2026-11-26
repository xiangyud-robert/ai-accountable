import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { StatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDelete, contactQuestion } from '../../components/ConfirmDelete'
import { DataTable, type Column } from '../../components/DataTable'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/Panel'
import { notify } from '../../components/Toaster'
import { UNREACHABLE_MESSAGE } from '../../lib/api'
import { STATUSES, statusName } from '../../lib/stages'
import type { ContactRow, Status } from '../../lib/types'
import { ContactForm } from './ContactForm'
import { useContacts, useDeleteContact } from './queries'

const STATUS_ORDER: Record<Status, number> = { lead: 1, qualified: 2, customer: 3 }

const COLUMNS: Column<ContactRow>[] = [
  {
    id: 'name',
    header: 'Name',
    value: (c) => c.name,
    cell: (c) => (
      <Link to={`/contacts/${c.id}`} className="font-medium text-link hover:underline">
        {c.name}
      </Link>
    ),
  },
  {
    id: 'organization',
    header: 'Organization',
    value: (c) => c.organization_name,
    cell: (c) =>
      c.organization_id && (
        <Link to={`/organizations/${c.organization_id}`} className="hover:underline">
          {c.organization_name}
        </Link>
      ),
  },
  { id: 'job_title', header: 'Job title', value: (c) => c.job_title },
  {
    id: 'email',
    header: 'Email',
    value: (c) => c.email,
    cell: (c) => <span className="text-ink-muted">{c.email}</span>,
  },
  {
    id: 'phone',
    header: 'Phone',
    value: (c) => c.phone,
    cell: (c) => <span className="font-mono text-[13px] text-ink-muted">{c.phone}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    value: (c) => c.status,
    text: (c) => statusName(c.status),
    compare: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    cell: (c) => <StatusBadge status={c.status} />,
  },
]

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...STATUSES.map((s) => ({ key: s.key, label: s.plural })),
]

export function ContactsPage() {
  const contacts = useContacts()
  const remove = useDeleteContact()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ContactRow | null>(null)

  // The status filter lives in the address (/contacts?status=lead), so it survives a refresh.
  const asked = params.get('status')
  const status = FILTERS.some((f) => f.key === asked) ? (asked as Status) : 'all'
  const all = useMemo(() => contacts.data ?? [], [contacts.data])
  const rows = useMemo(() => (status === 'all' ? all : all.filter((c) => c.status === status)), [all, status])
  const counts = (key: Status | 'all') => (key === 'all' ? all.length : all.filter((c) => c.status === key).length)

  const choose = (key: Status | 'all') => setParams(key === 'all' ? {} : { status: key }, { replace: true })

  const add = (
    <Button variant="primary" icon={<Plus aria-hidden size={16} />} onClick={() => setEditing('new')}>
      Add contact
    </Button>
  )

  const filter = (
    <div role="group" aria-label="Status" className="flex gap-1 rounded-control bg-page p-1">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={status === f.key}
          onClick={() => choose(f.key)}
          className={`flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium ${
            status === f.key ? 'bg-panel shadow-panel' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {f.label}
          <span className="font-mono text-xs text-ink-muted">{counts(f.key)}</span>
        </button>
      ))}
    </div>
  )

  const confirmDelete = () =>
    remove.mutate(deleting!.id, {
      onSuccess: () => {
        notify.done('Contact deleted')
        setDeleting(null)
      },
      onError: () => notify.failed(UNREACHABLE_MESSAGE),
    })

  return (
    <>
      <PageHeader title="Contacts" actions={add} />
      {contacts.error ? (
        <ErrorState error={contacts.error} />
      ) : contacts.data ? (
        <Panel>
          <DataTable
            label="Contacts"
            rows={rows}
            columns={COLUMNS}
            noun={['contact', 'contacts']}
            initialSort={{ id: 'name' }}
            rowId={(c) => c.id}
            rowName={(c) => c.name}
            onEdit={setEditing}
            onDelete={setDeleting}
            toolbar={filter}
            emptyAction={add}
          />
        </Panel>
      ) : null}
      <ContactForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        contact={editing === 'new' ? undefined : (editing ?? undefined)}
        defaults={{ status: status === 'all' ? 'lead' : status }}
      />
      {deleting && (
        <ConfirmDelete
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          question={contactQuestion(deleting.name, deleting.deal_count, deleting.activity_count)}
          confirmLabel="Delete contact"
          onConfirm={confirmDelete}
          busy={remove.isPending}
        />
      )}
    </>
  )
}
