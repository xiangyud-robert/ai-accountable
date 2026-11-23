import { Link } from 'react-router'
import { Panel } from '../components/Panel'

export function NotFound() {
  return (
    <Panel>
      <title>Page not found - Accountable</title>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2">
        <Link to="/" className="font-semibold text-link hover:underline">
          Go to the dashboard
        </Link>
      </p>
    </Panel>
  )
}
