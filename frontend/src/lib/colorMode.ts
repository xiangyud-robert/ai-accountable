// The theme choice, light, dark or system, kept in the browser (concern 14). index.html's script
// reads it under the same key before the app loads, so the page never flashes light, and keeps it
// on <html>. That script also follows the device's changes while the choice is System, reading the
// choice from <html>, so it follows a choice made here too, even when the browser won't save it.

export type Choice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'accountable-mode'
const CHOICE_MARK = 'data-theme-choice'
const DARK_DEVICE = '(prefers-color-scheme: dark)'

const isChoice = (value: string | null): value is Choice => value === 'light' || value === 'dark' || value === 'system'

/** The choice the page follows, as index.html's script or setChoice left it, and light if neither did. */
export function currentChoice(): Choice {
  const choice = document.documentElement.getAttribute(CHOICE_MARK)
  return isChoice(choice) ? choice : 'light'
}

/** Changes the mode at once and saves the choice. If the browser won't save it, the choice still
 *  holds until the page is reloaded. */
export function setChoice(choice: Choice) {
  document.documentElement.setAttribute(CHOICE_MARK, choice)
  showDark(choice === 'dark' || (choice === 'system' && matchMedia(DARK_DEVICE).matches))
  try {
    localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // Storage is turned off or full, so the choice lasts only for this visit.
  }
}

/** Marks the page dark, or light, as index.html's script does, and tells Chrome so its own parts,
 *  such as scrollbars and the date pickers, follow. */
function showDark(dark: boolean) {
  const html = document.documentElement
  if (dark) {
    html.setAttribute('data-theme', 'dark')
    html.style.colorScheme = 'dark'
  } else {
    html.removeAttribute('data-theme')
    html.style.removeProperty('color-scheme')
  }
}
