import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { currentMode, setMode } from '../lib/colorMode'
import { DarkModeSwitch } from './DarkModeSwitch'

const darkMode = () => screen.getByRole('switch', { name: 'Dark mode' })
const saved = () => localStorage.getItem('accountable-mode')

describe('DarkModeSwitch', () => {
  test('is a switch named Dark mode, off when the page is light', () => {
    render(<DarkModeSwitch />)
    expect(darkMode()).not.toBeChecked()
  })

  test('starts on when the page is already dark', () => {
    setMode('dark')
    render(<DarkModeSwitch />)
    expect(darkMode()).toBeChecked()
  })

  test('clicking it turns dark mode on and saves it, and clicking again turns it off', async () => {
    render(<DarkModeSwitch />)
    await userEvent.click(darkMode())
    expect(darkMode()).toBeChecked()
    expect(currentMode()).toBe('dark')
    expect(saved()).toBe('dark')

    await userEvent.click(darkMode())
    expect(darkMode()).not.toBeChecked()
    expect(currentMode()).toBe('light')
    expect(saved()).toBe('light')
  })

  test('Space flips it when it has focus', async () => {
    render(<DarkModeSwitch />)
    darkMode().focus()
    await userEvent.keyboard(' ')
    expect(darkMode()).toBeChecked()
    expect(currentMode()).toBe('dark')
  })
})
