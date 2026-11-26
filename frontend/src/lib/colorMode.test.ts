import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { currentMode, setMode } from './colorMode'

const html = document.documentElement
const saved = () => localStorage.getItem('accountable-mode')

/** The classic script in index.html's head, which runs before the app loads. */
const INLINE_SCRIPT = (() => {
  const page = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8')
  const script = page.match(/<script>([\s\S]*?)<\/script>/)
  if (!script) throw new Error('index.html has no inline script')
  return script[1]
})()

/** A fresh page: <html> with no mode, then index.html's script. */
function loadPage() {
  html.removeAttribute('data-theme')
  html.removeAttribute('style')
  new Function(INLINE_SCRIPT)()
}

const colorScheme = () => html.style.colorScheme

describe('currentMode', () => {
  test('is light when <html> has no mode, and dark when it’s marked dark', () => {
    expect(currentMode()).toBe('light')
    setMode('dark')
    expect(currentMode()).toBe('dark')
  })
})

describe('setMode', () => {
  test('dark marks the page dark, tells Chrome, and saves it', () => {
    setMode('dark')
    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(colorScheme()).toBe('dark')
    expect(saved()).toBe('dark')
  })

  test('light undoes both, and saves it', () => {
    setMode('dark')
    setMode('light')
    expect(html).not.toHaveAttribute('data-theme')
    expect(colorScheme()).toBe('')
    expect(saved()).toBe('light')
  })

  test('still changes the mode when the browser won’t save it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    setMode('dark')
    expect(currentMode()).toBe('dark')
    expect(saved()).toBeNull()
  })
})

describe('index.html’s inline script', () => {
  test('gives dark mode when dark is saved', () => {
    localStorage.setItem('accountable-mode', 'dark')
    loadPage()
    expect(currentMode()).toBe('dark')
    expect(colorScheme()).toBe('dark')
  })

  test.each([
    ['light is saved', 'light'],
    ['the saved value is anything else', 'purple'],
  ])('gives light mode when %s', (_case, value) => {
    localStorage.setItem('accountable-mode', value)
    loadPage()
    expect(currentMode()).toBe('light')
    expect(colorScheme()).toBe('')
  })

  test('gives light mode when nothing is saved', () => {
    loadPage()
    expect(currentMode()).toBe('light')
  })

  test('gives light mode when reading storage throws', () => {
    localStorage.setItem('accountable-mode', 'dark')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied.', 'SecurityError')
    })
    expect(loadPage).not.toThrow()
    expect(currentMode()).toBe('light')
  })

  test('reads the choice setMode saves, so the two agree on the key', () => {
    setMode('dark')
    loadPage()
    expect(currentMode()).toBe('dark')
  })
})
