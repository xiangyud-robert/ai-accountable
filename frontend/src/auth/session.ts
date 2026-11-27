import { useSyncExternalStore } from 'react'
import { connectSession, queryClient } from '../lib/api'
import { usesSupabase } from './config'
import type { SignInService } from './service'
import { standIn } from './standIn'
import { supabase } from './supabase'

/** The app's one session. `ended` says it ended by itself, rather than by signing out. */
export type Session = { status: 'checking' } | { status: 'signed-out'; ended: boolean } | { status: 'signed-in' }

let session: Session = { status: 'checking' }
const listeners = new Set<() => void>()

function change(next: Session) {
  session = next
  for (const listener of listeners) listener()
}

const service = (): SignInService => (usesSupabase ? supabase : standIn)

/** Picks up the session saved in this browser. main.tsx calls it once, as the page loads. */
export async function startSession() {
  change({ status: 'checking' })
  connectSession({ token: () => service().token(), refused: () => endSession(true) })
  const saved = await service().resume(() => leave(true))
  change(saved ? { status: 'signed-in' } : { status: 'signed-out', ended: false })
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, () => session)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Signs in, or throws a SignInError with the message for the sign-in screen. */
export async function signIn(email: string, password: string) {
  await service().signIn(email, password)
  change({ status: 'signed-in' })
}

/** Ends the session in this browser, which shows the sign-in screen. */
export function signOut() {
  return endSession(false)
}

/** Shows the sign-in screen and empties the query cache, so nothing from the session stays in
 *  memory for whoever signs in next. False if no one was signed in. */
function leave(ended: boolean) {
  if (session.status !== 'signed-in') return false
  change({ status: 'signed-out', ended })
  queryClient.clear()
  return true
}

async function endSession(ended: boolean) {
  if (leave(ended)) await service().signOut()
}
