import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { Field, TextInput } from '../components/fields'
import { usesSupabase } from './config'
import { CANT_REACH_SIGN_IN, SignInError, WRONG_DETAILS } from './service'
import { signIn } from './session'

const SMALL_PRINT = 'No account yet? Ask whoever set up Accountable for your team to add you.'
const STAND_IN_SMALL_PRINT =
  'On this computer, sign in as a sample teammate, such as dana.holt@example.com, with the password accountable.'

type SignInScreenProps = {
  /** The session ended by itself while the app was open. */
  ended: boolean
}

/** Shown at whatever address was opened, so signing in shows that page. */
export function SignInScreen({ ended }: SignInScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailField = useRef<HTMLInputElement>(null)
  const passwordField = useRef<HTMLInputElement>(null)

  useEffect(() => emailField.current?.focus(), [])

  async function submit(event: FormEvent) {
    // While busy, the disabled button also stops Enter in a field from sending the form again.
    event.preventDefault()
    setBusy(true)
    // Cleared first, so the same message is announced again if it comes back.
    setError(null)
    try {
      // Once signed in, the app takes this screen's place.
      await signIn(email, password)
    } catch (thrown) {
      const message = thrown instanceof SignInError ? thrown.message : CANT_REACH_SIGN_IN
      setError(message)
      setBusy(false)
      if (message === WRONG_DETAILS) {
        setPassword('')
        passwordField.current?.focus()
      }
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <title>Sign in - Accountable</title>
      <div className="flex w-[400px] max-w-full flex-col">
        <div className="text-center">
          <p className="flex items-center justify-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]">
            <span aria-hidden className="grid size-[30px] place-items-center rounded-full bg-logo">
              <span className="size-3 rounded-full bg-primary" />
            </span>
            Accountable
          </p>
          <p className="mt-1.5 font-serif text-[17px] text-ink-muted">Every deal, accounted for</p>
        </div>

        <section aria-labelledby="sign-in-title" className="mt-6 rounded-panel bg-panel p-6 shadow-panel">
          <h1 id="sign-in-title" className="text-[28px] font-semibold leading-[1.2] tracking-[-0.01em]">
            Sign in
          </h1>
          {ended && (
            <p role="alert" className="mt-2 text-ink-muted">
              Your session has ended. Sign in again to carry on.
            </p>
          )}
          <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <Field id="sign-in-email" label="Email">
              <TextInput
                ref={emailField}
                id="sign-in-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field id="sign-in-password" label="Password">
              <TextInput
                ref={passwordField}
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            {error && (
              <p role="alert" className="flex items-center gap-2 text-alert-text">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-alert" />
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
              {busy ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </section>

        <p className="mt-4 text-center text-xs text-ink-muted">{usesSupabase ? SMALL_PRINT : STAND_IN_SMALL_PRINT}</p>
      </div>
    </main>
  )
}
