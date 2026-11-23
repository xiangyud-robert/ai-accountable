import { Link } from 'react-router'
import { StatusBadge } from '../../components/Badge'
import type { ContactRow } from '../../lib/types'

/** A short list of contacts for an organization's page. */
export function ContactList({ contacts, empty }: { contacts: ContactRow[]; empty: string }) {
  if (contacts.length === 0) return <p className="py-2 text-ink-muted">{empty}</p>
  return (
    <ul className="flex flex-col">
      {contacts.map((contact) => (
        <li key={contact.id} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0">
          <div className="min-w-0 flex-1">
            <Link to={`/contacts/${contact.id}`} className="font-medium text-link hover:underline">
              {contact.name}
            </Link>
            {contact.job_title && <p className="truncate text-xs text-ink-muted">{contact.job_title}</p>}
          </div>
          <StatusBadge status={contact.status} />
        </li>
      ))}
    </ul>
  )
}
