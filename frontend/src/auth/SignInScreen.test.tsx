import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { UNREACHABLE_MESSAGE } from '../lib/api'
import { holdFetch, mockFetch } from '../test-utils'
import { startSession } from './session'
import { SignInScreen } from './SignInScreen'

// The app is built for the stand-in unless a test builds it for Supabase, whose client is mocked
// at its edge, so nothing here reaches Supabase.
const build = vi.hoisted(() => ({ supabase: false }))
vi.mock('./config', () => ({
  SUPABASE_URL: 'https://accountable-tests.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key-for-tests',
  get usesSupabase() {
    return build.supabase
  },
}))
const supabaseAuth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))
vi.mock('@supabase/supabase-js', async (original) => ({
  ...(await original<typeof import('@supabase/supabase-js')>()),
  createClient: () => ({ auth: supabaseAuth }),
}))

const DANA = 'dana.holt@example.com'

const email = () => screen.getByLabelText('Email')
const password = () => screen.getByLabelText('Password')

async function fillIn(details = { email: DANA, password: 'accountable' }) {
  await userEvent.type(email(), details.email)
  await userEvent.type(password(), details.password)
}

beforeEach(() => startSession())
afterEach(() => {
  build.supabase = false
})

describe('SignInScreen', () => {
  test('has the title, the labelled fields with their autocomplete, and Email focused', () => {
    render(<SignInScreen ended={false} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in')
    // The panel is named by the title, so the fields can be found inside it.
    expect(within(screen.getByRole('region', { name: 'Sign in' })).getByLabelText('Email')).toBe(email())
    expect(email()).toHaveAttribute('type', 'email')
    expect(email()).toHaveAttribute('autocomplete', 'email')
    expect(password()).toHaveAttribute('type', 'password')
    expect(password()).toHaveAttribute('autocomplete', 'current-password')
    expect(email()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test.each(['Email', 'Password'])('Enter in the %s field signs in', async (field) => {
    const calls = mockFetch(() => ({ body: { access_token: 'token-dana', expires_at: 1764200000 } }))
    render(<SignInScreen ended={false} />)
    await fillIn()
    await userEvent.click(screen.getByLabelText(field))
    await userEvent.keyboard('{Enter}')
    expect(calls).toEqual([
      { method: 'POST', path: '/stand-in/sign-in', body: { email: DANA, password: 'accountable' } },
    ])
  })

  test('"Signing in..." can’t be pressed twice', async () => {
    const { calls, release } = holdFetch({ body: { access_token: 'token-dana', expires_at: 1764200000 } })
    render(<SignInScreen ended={false} />)
    await fillIn()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const busy = screen.getByRole('button', { name: 'Signing in...' })
    expect(busy).toBeDisabled()
    await userEvent.click(busy)
    await userEvent.type(password(), '{Enter}')
    expect(calls).toHaveLength(1)
    release()
  })

  test('a wrong password shows its message, announced, and clears the password', async () => {
    mockFetch(() => ({ status: 401, body: { detail: 'Wrong email or password.' } }))
    render(<SignInScreen ended={false} />)
    await fillIn({ email: DANA, password: 'wrong' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(password()).toHaveValue('')
    expect(password()).toHaveFocus()
    expect(email()).toHaveValue(DANA)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('when Supabase can’t be reached, its message shows, and the password is kept', async () => {
    build.supabase = true
    supabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    })
    render(<SignInScreen ended={false} />)
    await fillIn()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Can't reach the sign-in service. Check your internet connection, then try again.",
    )
    expect(password()).toHaveValue('accountable')
  })

  test('when the stand-in’s server can’t be reached, the app’s usual message shows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<SignInScreen ended={false} />)
    await fillIn()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
  })

  test('the stand-in’s small print shows with the stand-in, and the normal line without it', () => {
    const { unmount } = render(<SignInScreen ended={false} />)
    expect(
      screen.getByText(
        'On this computer, sign in as a sample teammate, such as dana.holt@example.com, with the password accountable.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/No account yet/)).not.toBeInTheDocument()
    unmount()

    build.supabase = true
    render(<SignInScreen ended={false} />)
    expect(screen.getByText('No account yet? Ask whoever set up Accountable for your team to add you.')).toBeVisible()
    expect(screen.queryByText(/sample teammate/)).not.toBeInTheDocument()
  })

  test('after a session ends, its message shows, announced', async () => {
    const { unmount } = render(<SignInScreen ended={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    unmount()

    render(<SignInScreen ended />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Your session has ended. Sign in again to carry on.'),
    )
  })
})
