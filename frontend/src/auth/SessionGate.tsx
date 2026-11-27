import type { ReactNode } from 'react'
import { Panel } from '../components/Panel'
import { UNREACHABLE_MESSAGE } from '../lib/api'
import { useSession } from './session'
import { SignInScreen } from './SignInScreen'
import { useMe } from './useMe'

/** The app for someone signed in, and the sign-in screen for anyone else, at whatever address was
 *  opened (R15). */
export function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession()
  // Only the page's background while the saved session is checked, so it never flashes the sign-in screen.
  if (session.status === 'checking') return null
  if (session.status === 'signed-out') return <SignInScreen ended={session.ended} />
  return <SignedIn>{children}</SignedIn>
}

/** Waits for the person and the team's time zone, so the app first draws with the team's dates. */
function SignedIn({ children }: { children: ReactNode }) {
  const me = useMe()
  // Once loaded, a later refetch that fails leaves the app as it is.
  if (me.data) return children
  // A 401 has already ended the session, so this is the server not answering.
  if (me.isError) return <CantLoad />
  return null
}

function CantLoad() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="w-[400px] max-w-full">
        <div role="alert">
          <h1 className="text-xl font-semibold">{UNREACHABLE_MESSAGE}</h1>
        </div>
      </Panel>
    </main>
  )
}
