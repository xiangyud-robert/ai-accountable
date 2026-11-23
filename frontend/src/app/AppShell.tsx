import { Briefcase, Building2, LayoutDashboard, SquareKanban, Users, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useContacts } from '../features/contacts/queries'
import { useDeals } from '../features/deals/queries'
import { useOrganizations } from '../features/organizations/queries'

type Section = { to: string; label: string; icon: LucideIcon; count?: number }

/** The floating sidebar with the five sections, and the main area beside it. */
export function AppShell() {
  const organizations = useOrganizations()
  const contacts = useContacts()
  const deals = useDeals()

  const sections: Section[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/organizations', label: 'Organizations', icon: Building2, count: organizations.data?.length },
    { to: '/contacts', label: 'Contacts', icon: Users, count: contacts.data?.length },
    { to: '/deals', label: 'Deals', icon: Briefcase, count: deals.data?.length },
    { to: '/pipeline', label: 'Pipeline', icon: SquareKanban },
  ]

  return (
    <div className="min-h-screen">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-panel px-4 py-2 font-semibold shadow-lift focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="fixed bottom-4 left-4 top-4 flex w-56 flex-col gap-[30px] overflow-y-auto rounded-panel bg-panel px-3.5 py-6 shadow-panel">
        <div className="px-2.5">
          <p className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]">
            <span aria-hidden className="grid size-[30px] place-items-center rounded-full bg-ink">
              <span className="size-3 rounded-full bg-primary" />
            </span>
            Accountable
          </p>
          <p className="mt-1.5 font-serif text-[17px] text-ink-muted">Every deal, accounted for</p>
        </div>
        <nav aria-label="Sections">
          <ul className="flex flex-col gap-1">
            {sections.map(({ to, label, icon: Icon, count }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `group flex h-[42px] items-center gap-3 rounded-card px-3 ${
                      isActive ? 'bg-primary-tint font-semibold' : 'font-medium hover:bg-page'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon aria-hidden size={18} className={isActive ? 'text-primary-text' : 'text-ink-muted'} />
                      {label}
                      {count !== undefined && (
                        <span className="ml-auto font-mono text-xs font-normal text-ink-muted">{count}</span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main id="content" tabIndex={-1} className="pb-4 pl-[264px] pr-7 pt-7 outline-none">
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
