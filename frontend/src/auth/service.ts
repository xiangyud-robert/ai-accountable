// What signing in with Supabase (supabase.ts) and with the stand-in (standIn.ts) have in common,
// so session.ts can use either.

export const WRONG_DETAILS = 'Wrong email or password.'
export const CANT_REACH_SIGN_IN = "Can't reach the sign-in service. Check your internet connection, then try again."

/** Signing in didn't work. The message is the one the sign-in screen shows. */
export class SignInError extends Error {}

export type SignInService = {
  /** Picks up the session saved in this browser, and says whether there was one. `ended` is called
   *  if the session later ends by itself, such as when its token can't be renewed. */
  resume(ended: () => void): Promise<boolean>
  /** The token to send with a request, or null when there's no session. */
  token(): Promise<string | null>
  /** Signs in, or throws a SignInError. */
  signIn(email: string, password: string): Promise<void>
  /** Forgets the session in this browser. */
  signOut(): Promise<void>
}
