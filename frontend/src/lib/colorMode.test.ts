import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { type Choice, currentChoice, setChoice } from './colorMode'

const html = document.documentElement
const saved = () => localStorage.getItem('accountable-mode')

/** The mode the page shows: what theme.css styles, and what it tells Chrome. */
const shown = () => ({ theme: html.getAttribute('data-theme') ?? 'light', scheme: html.style.colorScheme })
const LIGHT = { theme: 'light', scheme: '' }
const DARK = { theme: 'dark', scheme: 'dark' }

/** The classic script in index.html's head, which runs before the app loads. */
const INLINE_SCRIPT = (() => {
  const page = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8')
  const script = page.match(/<script>([\s\S]*?)<\/script>/)
  if (!script) throw new Error('index.html has no inline script')
  return script[1]
})()

/** A fresh page: <html> with no mode or choice, then index.html's script. */
function loadPage() {
  for (const name of ['data-theme', 'data-theme-choice', 'style']) html.removeAttribute(name)
  new Function(INLINE_SCRIPT)()
}

/** The device's light or dark setting, as Chrome's matchMedia reports it, which the test can change
 *  while the page is open. Like Chrome, a change reaches every list matchMedia has given out. */
function fakeDevice() {
  let dark = false
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: dark)' && dark
    },
    addEventListener: (_type: 'change', listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) => listeners.delete(listener),
  }))
  return {
    turn(setting: 'light' | 'dark') {
      dark = setting === 'dark'
      listeners.forEach((listener) => listener())
    },
  }
}

const throwFromStorage = (method: 'getItem' | 'setItem') =>
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('Access is denied.', 'SecurityError')
  })

let device: ReturnType<typeof fakeDevice>
beforeEach(() => {
  device = fakeDevice()
})

describe('setChoice', () => {
  test.each([
    ['light', 'a light', LIGHT],
    ['light', 'a dark', LIGHT],
    ['dark', 'a light', DARK],
    ['dark', 'a dark', DARK],
    ['system', 'a light', LIGHT],
    ['system', 'a dark', DARK],
  ] as const)('%s on %s device applies at once, and is saved', (choice, setting, mode) => {
    device.turn(setting === 'a dark' ? 'dark' : 'light')
    setChoice('dark')
    setChoice(choice)
    expect(shown()).toEqual(mode)
    expect(currentChoice()).toBe(choice)
    expect(saved()).toBe(choice)
  })

  test('still works when the browser won’t save it', () => {
    throwFromStorage('setItem')
    device.turn('dark')
    setChoice('system')
    expect(shown()).toEqual(DARK)
    expect(currentChoice()).toBe('system')
    expect(saved()).toBeNull()
  })
})

describe('currentChoice', () => {
  test('is light when nothing has been chosen, even on a dark device', () => {
    device.turn('dark')
    expect(currentChoice()).toBe('light')
  })

  test('is the choice, not the mode it gives', () => {
    device.turn('dark')
    setChoice('system')
    expect(currentChoice()).toBe('system')
    expect(shown()).toEqual(DARK)
  })
})

describe('index.html’s inline script', () => {
  test.each([
    ['light', 'a dark', LIGHT],
    ['dark', 'a light', DARK],
    ['system', 'a light', LIGHT],
    ['system', 'a dark', DARK],
  ] as const)('with %s saved, on %s device, applies it before the app loads', (choice, setting, mode) => {
    device.turn(setting === 'a dark' ? 'dark' : 'light')
    localStorage.setItem('accountable-mode', choice)
    loadPage()
    expect(shown()).toEqual(mode)
    expect(currentChoice()).toBe(choice)
  })

  test.each([
    ['nothing is saved', null],
    ['the saved value is anything else', 'purple'],
    ['the saved value is in the wrong case', 'Dark'],
  ])('gives light, even on a dark device, when %s', (_case, value) => {
    device.turn('dark')
    if (value) localStorage.setItem('accountable-mode', value)
    loadPage()
    expect(shown()).toEqual(LIGHT)
    expect(currentChoice()).toBe('light')
  })

  test('gives light when reading storage throws', () => {
    localStorage.setItem('accountable-mode', 'dark')
    throwFromStorage('getItem')
    expect(loadPage).not.toThrow()
    expect(shown()).toEqual(LIGHT)
    expect(currentChoice()).toBe('light')
  })

  test('with System saved, follows the device as it changes while the page is open', () => {
    localStorage.setItem('accountable-mode', 'system')
    loadPage()
    device.turn('dark')
    expect(shown()).toEqual(DARK)
    device.turn('light')
    expect(shown()).toEqual(LIGHT)
  })

  test.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('with %s saved, ignores the device’s changes', (choice, mode) => {
    localStorage.setItem('accountable-mode', choice)
    loadPage()
    device.turn('dark')
    device.turn('light')
    device.turn('dark')
    expect(shown()).toEqual(mode)
  })

  test('follows the device after System is chosen in the app, and stops after Light or Dark is', () => {
    loadPage()
    setChoice('system')
    device.turn('dark')
    expect(shown()).toEqual(DARK)
    device.turn('light')
    expect(shown()).toEqual(LIGHT)

    setChoice('dark')
    device.turn('dark')
    device.turn('light')
    expect(shown()).toEqual(DARK)
  })

  test('when the browser won’t save, System chosen in the app follows the device until a reload', () => {
    throwFromStorage('getItem')
    throwFromStorage('setItem')
    loadPage()
    setChoice('system')
    device.turn('dark')
    expect(shown()).toEqual(DARK)
    device.turn('light')
    expect(shown()).toEqual(LIGHT)

    device.turn('dark')
    loadPage()
    expect(shown()).toEqual(LIGHT)
    expect(currentChoice()).toBe('light')
  })

  test.each(['light', 'dark', 'system'] satisfies Choice[])(
    'reads back %s as setChoice saves it, so the two agree on the key',
    (choice) => {
      device.turn('dark')
      setChoice(choice)
      loadPage()
      expect(currentChoice()).toBe(choice)
      expect(shown()).toEqual(choice === 'light' ? LIGHT : DARK)
    },
  )
})
