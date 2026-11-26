// The light or dark choice, kept in the browser (concern 14). index.html's script reads it under
// the same key and marks <html> the same way before the app loads, so the page never flashes light.

export type Mode = 'light' | 'dark'

const STORAGE_KEY = 'accountable-mode'

/** The mode the page is in, as index.html's script or setMode left it. */
export function currentMode(): Mode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** Changes the mode at once and saves it. If the browser won't save it, the mode still holds
 *  until the page is reloaded. */
export function setMode(mode: Mode) {
  const html = document.documentElement
  if (mode === 'dark') {
    html.setAttribute('data-theme', 'dark')
    html.style.colorScheme = 'dark'
  } else {
    html.removeAttribute('data-theme')
    html.style.removeProperty('color-scheme')
  }
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage is turned off or full, so the choice lasts only for this visit.
  }
}
