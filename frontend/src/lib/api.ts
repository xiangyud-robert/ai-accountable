import { type DefaultOptions, MutationCache, QueryClient } from '@tanstack/react-query'

/** The server turned down some fields, with a message for each (a 422). */
export class FieldErrors extends Error {
  errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super('Some fields need changing')
    this.errors = errors
  }
}

/** The record asked for doesn't exist (a 404). */
export class NotFound extends Error {}

/** The server didn't answer, or answered with an error of its own. */
export class Unreachable extends Error {}

/** The server refused the request's token (a 401), or, for a sign-in, the email and password. */
export class Refused extends Error {}

export const UNREACHABLE_MESSAGE = "Can't reach Accountable's server. Check that it's running, then refresh."

/** What a request needs from the session. src/auth/session.ts sets it, so the two files don't
 *  import each other. */
type SessionHooks = {
  /** The token to send, or null when there's no session. */
  token: () => Promise<string | null>
  /** The server refused the token, which ends the session. */
  refused: () => void
}

let session: SessionHooks = { token: async () => null, refused: () => {} }

export function connectSession(hooks: SessionHooks) {
  session = hooks
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** A sign-in, which sends no token, and whose 401 means the email or password was wrong. */
  signingIn?: boolean
}

/** Sends the request with the session's token, unless it's a sign-in. */
async function send(path: string, { method = 'GET', body, signingIn = false }: Options) {
  try {
    const token = signingIn ? null : await session.token()
    return await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token !== null && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Unreachable(UNREACHABLE_MESSAGE)
  }
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 401) {
    if (!options.signingIn) session.refused()
    throw new Refused('Refused')
  }
  if (response.status === 422) {
    const json = await response.json()
    throw new FieldErrors(json.errors ?? {})
  }
  if (response.status === 404) throw new NotFound('Not found')
  if (!response.ok) throw new Unreachable(UNREACHABLE_MESSAGE)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** A query client that works the way the app's does. `queries` replaces some of its query defaults. */
export function createQueryClient(queries: DefaultOptions['queries'] = {}) {
  const client: QueryClient = new QueryClient({
    // Every successful change refetches every query. With hundreds of records that's cheap,
    // and it's always right, since one change can move figures on several screens.
    mutationCache: new MutationCache({
      onSuccess: () => client.invalidateQueries(),
    }),
    defaultOptions: {
      queries: {
        // A missing record or a 422 won't come right by asking again.
        retry: (count, error) => error instanceof Unreachable && count < 1,
        refetchOnWindowFocus: false,
        ...queries,
      },
    },
  })
  return client
}

export const queryClient = createQueryClient()
