import { createClient, isAuthApiError, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { CANT_REACH_SIGN_IN, SignInError, WRONG_DETAILS, type SignInService } from './service'

let client: SupabaseClient | undefined

// Made the first time it's needed, so the stand-in never makes one. Supabase's client keeps the
// session in local storage, renews the token before it runs out and keeps tabs in step.
function auth() {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    // Accountable signs in only with a password, so a session in the address is never taken up.
    auth: { detectSessionInUrl: false },
  })
  return client.auth
}

async function token() {
  // Renews the token first if it has run out, such as after the laptop slept.
  const { data } = await auth().getSession()
  return data.session?.access_token ?? null
}

async function resume(ended: () => void) {
  // Supabase drops the session when it can't be renewed, or when another tab signs out.
  auth().onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') ended()
  })
  return (await token()) !== null
}

/** Supabase's error, or null once signed in. */
async function attemptSignIn(email: string, password: string): Promise<unknown> {
  try {
    const { error } = await auth().signInWithPassword({ email, password })
    return error
  } catch (thrown) {
    return thrown
  }
}

async function signIn(email: string, password: string) {
  const error = await attemptSignIn(email, password)
  if (!error) return
  // Supabase answers 400 for a wrong email or password. Anything else means it couldn't be
  // reached or isn't working, which trying again later may fix.
  const wrong = isAuthApiError(error) && error.status === 400
  throw new SignInError(wrong ? WRONG_DETAILS : CANT_REACH_SIGN_IN)
}

async function signOut() {
  // Only this browser's session. Supabase forgets it before asking its server to revoke it, so
  // it ends even with no connection.
  await auth().signOut({ scope: 'local' })
}

/** Signing in with Supabase Auth, using the project's publishable key and nothing secret. */
export const supabase: SignInService = { resume, token, signIn, signOut }
