import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Toaster, notify } from './Toaster'

const messages = () => within(screen.getByRole('region', { name: /^Notifications/ })).queryAllByRole('listitem')
const message = (text: string) => messages().find((item) => item.textContent === text)

// The dot is the only thing that sets a failure apart, and it's hidden from screen readers,
// so the test finds it by its color.
const alertDot = (text: string) => message(text)!.querySelector('.bg-alert')

describe('Toaster', () => {
  test('messages are announced politely to screen readers', () => {
    render(<Toaster />)
    expect(screen.getByRole('region', { name: /^Notifications/ })).toHaveAttribute('aria-live', 'polite')
    expect(messages()).toEqual([])
  })

  test('a save or delete is confirmed with its message, and no dot', async () => {
    render(<Toaster />)
    notify.done('Deal saved')
    await waitFor(() => expect(message('Deal saved')).toBeDefined())
    expect(alertDot('Deal saved')).toBeNull()
  })

  test('a failure has the alert dot', async () => {
    const failure = 'Couldn’t save the move, so the card is back where it was.'
    render(<Toaster />)
    notify.failed(failure)
    await waitFor(() => expect(message(failure)).toBeDefined())
    expect(alertDot(failure)).not.toBeNull()
  })
})
