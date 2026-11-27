import { FieldErrors, Refused, UNREACHABLE_MESSAGE, api } from '../lib/api'
import { SignInError, WRONG_DETAILS, type SignInService } from './service'

/** Where the stand-in's token is kept in local storage, as the token itself. */
export const STAND_IN_TOKEN_KEY = 'accountable-stand-in-token'

type Reply = { access_token: string; expires_at: number }

async function signIn(email: string, password: string) {
  let reply: Reply
  try {
    reply = await api<Reply>('/stand-in/sign-in', { method: 'POST', body: { email, password }, signingIn: true })
  } catch (error) {
    const wrong = error instanceof Refused || error instanceof FieldErrors
    throw new SignInError(wrong ? WRONG_DETAILS : UNREACHABLE_MESSAGE)
  }
  localStorage.setItem(STAND_IN_TOKEN_KEY, reply.access_token)
}

/** Signing in with the backend's stand-in, on this computer only (concern 18). It never checks the
 *  token's expiry itself, since the browser's clock may be fixed by a test, and leaves that to the
 *  backend's 401 (risk 6). */
export const standIn: SignInService = {
  resume: async () => localStorage.getItem(STAND_IN_TOKEN_KEY) !== null,
  token: async () => localStorage.getItem(STAND_IN_TOKEN_KEY),
  signIn,
  signOut: async () => localStorage.removeItem(STAND_IN_TOKEN_KEY),
}
