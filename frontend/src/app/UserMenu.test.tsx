import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogOut } from 'lucide-react'
import { describe, expect, test, vi } from 'vitest'
import { signOut } from '../auth/session'
import type { Me } from '../auth/useMe'
import { holdFetch, renderWithApp } from '../test-utils'
import { UserMenu } from './UserMenu'

vi.mock('../auth/session', async (original) => ({
  ...(await original<typeof import('../auth/session')>()),
  signOut: vi.fn(async () => {}),
}))

const DANA: Me = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Dana Holt',
  email: 'dana.holt@example.com',
  initials: 'DH',
  timezone: 'America/Los_Angeles',
}

/** Someone with no display name, who shows by their email (R16). */
const SAM: Me = { id: 'user-sam', name: 'sam@example.com', email: 'sam@example.com', initials: 'S', timezone: null }

function renderMenu(me: Me = DANA) {
  return renderWithApp(<UserMenu />, { data: [[['me'], me]] })
}

const button = () => screen.getByRole('button', { name: /^Account, / })
const menu = () => screen.getByRole('menu')

/** Opens the menu from the keyboard, as Tab then Enter would. */
async function openMenu() {
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  return menu()
}

describe('UserMenu', () => {
  test('is announced as "Account, Dana Holt, DH", ending with the initials it shows, a button that opens a menu', () => {
    renderMenu()
    expect(screen.getByRole('button', { name: 'Account, Dana Holt, DH' })).toHaveTextContent(/^DH$/)
    expect(button()).toHaveAttribute('aria-haspopup', 'menu')
    expect(button()).toHaveAttribute('aria-expanded', 'false')
  })

  test('its tooltip gives the name', async () => {
    renderMenu()
    await userEvent.tab()
    expect(button()).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Dana Holt$/)
  })

  test.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['Down', '{ArrowDown}'],
  ])('%s opens it, with focus on its first item, Light', async (_name, key) => {
    renderMenu()
    await userEvent.tab()
    await userEvent.keyboard(key)
    expect(button()).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu()).getByRole('menuitemradio', { name: 'Light' })).toHaveFocus()
  })

  test('holds the name and email, then the theme choice, then Sign out, with a divider between each', async () => {
    renderMenu()
    const open = await openMenu()
    const parts = [
      within(open).getByText('Dana Holt').parentElement,
      ...within(open).getAllByRole('separator'),
      within(open).getByRole('group', { name: 'Theme' }),
      within(open).getByRole('menuitem', { name: 'Sign out' }),
    ]
    const inOrder = [...open.querySelectorAll<HTMLElement>('*')].filter((element) => parts.includes(element))
    expect(inOrder).toEqual([parts[0], parts[1], parts[3], parts[2], parts[4]])
    expect(
      within(parts[3]!)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['Light', 'Dark', 'System'])
  })

  test('Up and Down move through Light, Dark, System and Sign out', async () => {
    renderMenu()
    const open = await openMenu()
    const focused = () => document.activeElement?.textContent
    expect(focused()).toBe('Light')
    for (const name of ['Dark', 'System', 'Sign out']) {
      await userEvent.keyboard('{ArrowDown}')
      expect(focused()).toBe(name)
    }
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(focused()).toBe('Dark')
    expect(open.contains(document.activeElement)).toBe(true)
  })

  test('a click opens it too, as a menu named by the button', async () => {
    renderMenu()
    await userEvent.click(button())
    expect(menu()).toHaveAccessibleName('Account, Dana Holt, DH')
  })

  test('shows the name in semibold, and the email beneath it', async () => {
    renderMenu()
    const open = await openMenu()
    expect(within(open).getByText('Dana Holt')).toHaveClass('font-semibold')
    expect(within(open).getByText('dana.holt@example.com')).toBeInTheDocument()
  })

  test('someone with no display name shows their email once', async () => {
    renderMenu(SAM)
    expect(screen.getByRole('button', { name: 'Account, sam@example.com, S' })).toHaveTextContent(/^S$/)
    const open = await openMenu()
    expect(within(open).getAllByText('sam@example.com')).toHaveLength(1)
  })

  test('while it’s open, the rest of the page is still there for screen readers, and Tab stays in the menu', async () => {
    renderWithApp(
      <>
        <UserMenu />
        <button type="button">Add deal</button>
      </>,
      { data: [[['me'], DANA]] },
    )
    const open = await openMenu()
    expect(screen.getByRole('button', { name: 'Add deal' })).toBeInTheDocument()
    await userEvent.tab()
    expect(open.contains(document.activeElement)).toBe(true)
  })

  test('Escape closes it, and focus goes back to the button', async () => {
    renderMenu()
    await openMenu()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button()).toHaveFocus()
  })

  test('Sign out, with its icon, signs out', async () => {
    renderMenu()
    const open = await openMenu()
    const item = within(open).getByRole('menuitem', { name: 'Sign out' })
    const { container } = render(<LogOut />)
    expect(item.querySelector('svg')!.innerHTML).toBe(container.querySelector('svg')!.innerHTML)
    await userEvent.click(item)
    expect(signOut).toHaveBeenCalledOnce()
  })

  test('shows nothing until it knows who’s signed in', () => {
    holdFetch()
    renderWithApp(<UserMenu />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
