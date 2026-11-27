import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropdownMenu } from 'radix-ui'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { type Choice, setChoice } from '../lib/colorMode'
import { ThemeChoice } from './ThemeChoice'

const html = document.documentElement
const saved = () => localStorage.getItem('accountable-mode')
const pageIsDark = () => html.getAttribute('data-theme') === 'dark'

/** ThemeChoice in a menu of its own, as the user menu holds it. */
function renderInMenu() {
  render(
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <ThemeChoice />
      </DropdownMenu.Content>
    </DropdownMenu.Root>,
  )
}

const menu = () => screen.getByRole('menu')
const theme = () => within(menu()).getByRole('group', { name: 'Theme' })
const item = (name: string) => within(theme()).getByRole('menuitemradio', { name })

beforeEach(() => {
  // A light device, so System gives light.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})

describe('ThemeChoice', () => {
  test('is a group named Theme of three choices, with Light checked when nothing is chosen', async () => {
    renderInMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    const choices = within(theme()).getAllByRole('menuitemradio')
    expect(choices.map((choice) => choice.textContent)).toEqual(['Light', 'Dark', 'System'])
    expect(item('Light')).toBeChecked()
    expect(item('Dark')).not.toBeChecked()
    expect(item('System')).not.toBeChecked()
  })

  test.each([
    ['Dark', 'dark'],
    ['System', 'system'],
  ] satisfies [string, Choice][])('%s is checked when the menu opens after it was chosen', async (name, choice) => {
    setChoice(choice)
    renderInMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(within(theme()).getByRole('menuitemradio', { checked: true })).toHaveAccessibleName(name)
  })

  test('choosing one changes the mode at once, saves it, and leaves the menu open', async () => {
    renderInMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Account' }))

    await userEvent.click(item('Dark'))
    expect(pageIsDark()).toBe(true)
    expect(saved()).toBe('dark')
    expect(item('Dark')).toBeChecked()
    expect(item('Light')).not.toBeChecked()

    await userEvent.click(item('System'))
    expect(pageIsDark()).toBe(false)
    expect(saved()).toBe('system')
    expect(item('System')).toBeChecked()
    expect(item('Dark')).not.toBeChecked()
  })

  test('Enter or Space chooses from the keyboard, and the menu stays open', async () => {
    renderInMenu()
    screen.getByRole('button', { name: 'Account' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(item('Light')).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(pageIsDark()).toBe(true)
    expect(item('Dark')).toBeChecked()
    expect(item('Dark')).toHaveFocus()

    await userEvent.keyboard('{ArrowUp} ')
    expect(pageIsDark()).toBe(false)
    expect(saved()).toBe('light')
    expect(item('Light')).toBeChecked()
  })
})
