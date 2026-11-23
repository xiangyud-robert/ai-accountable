import { createBrowserRouter } from 'react-router'
import { ContactPage } from '../features/contacts/ContactPage'
import { ContactsPage } from '../features/contacts/ContactsPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { DealPage } from '../features/deals/DealPage'
import { DealsPage } from '../features/deals/DealsPage'
import { OrganizationPage } from '../features/organizations/OrganizationPage'
import { OrganizationsPage } from '../features/organizations/OrganizationsPage'
import { PipelinePage } from '../features/pipeline/PipelinePage'
import { AppShell } from './AppShell'
import { NotFound } from './NotFound'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/organizations', element: <OrganizationsPage /> },
      { path: '/organizations/:id', element: <OrganizationPage /> },
      { path: '/contacts', element: <ContactsPage /> },
      { path: '/contacts/:id', element: <ContactPage /> },
      { path: '/deals', element: <DealsPage /> },
      { path: '/deals/:id', element: <DealPage /> },
      { path: '/pipeline', element: <PipelinePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
