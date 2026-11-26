import { useLayoutEffect, useRef } from 'react'

/**
 * Dialogs here open from state rather than from a Radix trigger, so Radix doesn't know where
 * to send focus when they close. This remembers what had focus when the dialog opened, and
 * sends it back there. If that's gone, such as a row that was just deleted, focus goes to
 * the main area instead of getting lost.
 */
export function useReturnFocus(open: boolean) {
  const opener = useRef<Element | null>(null)
  // A layout effect runs before Radix's own effect moves focus inside the dialog.
  useLayoutEffect(() => {
    if (open) opener.current = openerOf(document.activeElement)
  }, [open])

  return (event: Event) => {
    event.preventDefault()
    const target = opener.current
    if (target instanceof HTMLElement && target.isConnected && target !== document.body) {
      target.focus()
    } else {
      document.getElementById('content')?.focus()
    }
  }
}

/** A menu's items are gone once it closes, so a dialog opened from one goes back to the
 *  button that opened the menu, which Radix names in the menu's aria-labelledby. */
function openerOf(element: Element | null): Element | null {
  if (element?.getAttribute('role') !== 'menuitem') return element
  const button = element.closest('[role="menu"]')?.getAttribute('aria-labelledby')
  return button ? document.getElementById(button) : null
}
