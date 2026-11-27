import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

const SRC = join(__dirname, '..')
const THEME = join(__dirname, 'theme.css')
const THIS_TEST = join(__dirname, 'theme.test.ts')
const COLOR_MODE = join(SRC, 'lib', 'colorMode.ts')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

/** Each line of a source file that matches, as "file:line: text", skipping the files given. */
function linesMatching(pattern: (line: string) => boolean, skip: (path: string) => boolean) {
  return sourceFiles(SRC)
    .filter((path) => !skip(path))
    .flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${relative(SRC, path)}:${i + 1}` }))
        .filter(({ line }) => pattern(line))
        .map(({ at, line }) => `${at}: ${line.trim()}`),
    )
}

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|oklch)\(/i
const BRAND_NAME = /sea[\s-]?green|marigold|coral|cerulean|raspberry|midnight|sea[\s-]?mist|\bslate\b|\bgr[ae]y\b/i

const theme = readFileSync(THEME, 'utf8')

/** The variables set in one block of theme.css, from its opening line to its closing brace. */
function variablesIn(opening: string) {
  const start = theme.indexOf(opening)
  if (start < 0) throw new Error(`theme.css has no ${opening}`)
  const block = theme.slice(start, theme.indexOf('}', start))
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim().toLowerCase()]),
  )
}

/** The color roles among them, without their --color- prefix. */
const colorRoles = (variables: Map<string, string>) =>
  new Map([...variables].filter(([name]) => name.startsWith('color-')).map(([name, value]) => [name.slice(6), value]))

const VARIABLES = { light: variablesIn('@theme static {'), dark: variablesIn(":root[data-theme='dark'] {") }
const MODES = { light: colorRoles(VARIABLES.light), dark: colorRoles(VARIABLES.dark) }

/** A #rrggbb color through CSS's brightness() filter, which scales each channel. */
function brightened(hex: string, amount: string) {
  const scale = parseFloat(amount) / 100
  return `#${[1, 3, 5]
    .map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * scale)))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}

/** WCAG's relative luminance of a #rrggbb color. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('colors are used by role', () => {
  test('no source file other than theme.css has a color value or a brand color name', () => {
    const offenders = linesMatching(
      (line) => HEX.test(line) || COLOR_FUNCTION.test(line) || BRAND_NAME.test(line),
      (path) => path === THEME || path === THIS_TEST,
    )
    expect(offenders).toEqual([])
  })

  test('no component picks a color by mode: no dark: classes, and only the theme and colorMode.ts know the mark', () => {
    const darkClasses = linesMatching(
      (line) => /(?:^|[\s'"`])dark:/.test(line),
      (path) => path === THIS_TEST,
    )
    expect(darkClasses).toEqual([])
    const knowTheMark = linesMatching(
      (line) => /data-theme|dataset\.theme/.test(line),
      (path) => path === THEME || path === COLOR_MODE || /\.test\.tsx?$|test-setup\.ts$|test-utils\.tsx$/.test(path),
    )
    expect(knowTheMark).toEqual([])
  })

  test('every stage has its role and tint', () => {
    for (const stage of ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']) {
      expect(MODES.light.has(`stage-${stage}`), stage).toBe(true)
      expect(MODES.light.has(`stage-${stage}-tint`), stage).toBe(true)
    }
  })

  test('every status has its role and tint', () => {
    for (const status of ['lead', 'qualified', 'customer']) {
      expect(MODES.light.has(`status-${status}`), status).toBe(true)
      expect(MODES.light.has(`status-${status}-tint`), status).toBe(true)
    }
  })

  test('the favicon, which can’t use the theme, has only light mode’s ink and primary colors', () => {
    const favicon = readFileSync(join(SRC, '..', 'public', 'favicon.svg'), 'utf8')
    const colors = new Set([...favicon.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([hex]) => hex.toLowerCase()))
    expect(colors).toEqual(new Set([MODES.light.get('ink'), MODES.light.get('primary')]))
  })

  test('the spec’s other roles are there', () => {
    for (const name of [
      'page',
      'panel',
      'raised',
      'ink',
      'ink-muted',
      'on-primary',
      'logo',
      'divider',
      'divider-raised',
      'field',
      'focus',
      'link',
      'primary',
      'primary-tint',
      'alert',
      'alert-tint',
    ]) {
      expect(MODES.light.has(name), name).toBe(true)
    }
  })
})

describe('dark mode', () => {
  test('sets every role light mode has, and no other', () => {
    expect([...MODES.dark.keys()].sort()).toEqual([...MODES.light.keys()].sort())
    const unknown = [...VARIABLES.dark.keys()].filter((name) => !VARIABLES.light.has(name))
    expect(unknown).toEqual([])
  })

  test('a secondary button’s hover changes it at least as much as in light mode', () => {
    const hoverChange = (mode: 'light' | 'dark') => {
      const resting = MODES[mode].get('secondary')!
      return contrast(resting, brightened(resting, VARIABLES[mode].get('secondary-hover-brightness')!))
    }
    expect(hoverChange('dark')).toBeGreaterThanOrEqual(hoverChange('light'))
  })

  test('concern 13: Negotiation is Sea Mist, with a Midnight tint', () => {
    expect(MODES.dark.get('stage-negotiation')).toBe('#cdd8db')
    expect(MODES.dark.get('stage-negotiation-tint')).toBe('#073b4c')
  })
})

describe.each(['light', 'dark'] as const)('contrast in %s mode', (mode) => {
  const color = (name: string) => {
    const value = MODES[mode].get(name)
    if (!value?.startsWith('#')) throw new Error(`${name} has no hex value in ${mode} mode`)
    return value
  }
  const SURFACES = ['panel', 'page', 'raised']
  const TINTS = [...MODES[mode].keys()].filter((name) => name.endsWith('-tint'))

  test.each(['ink', 'ink-muted', 'link', 'primary-text', 'alert-text'])(
    '%s is at least 4.5:1 on the panel, the page and the raised surface',
    (text) => {
      for (const surface of SURFACES) {
        expect(contrast(color(text), color(surface)), `on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  test('ink is at least 4.5:1 on every tint and on secondary', () => {
    expect(TINTS.length).toBeGreaterThan(10)
    for (const fill of [...TINTS, 'secondary']) {
      expect(contrast(color('ink'), color(fill)), `on ${fill}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('on-primary is at least 4.5:1 on primary, and on-fill on alert fill', () => {
    expect(contrast(color('on-primary'), color('primary'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(color('on-fill'), color('alert-fill'))).toBeGreaterThanOrEqual(4.5)
  })

  test('a menu’s divider shows on the raised surface at least as well as light mode’s divider on the panel', () => {
    const lightDivider = contrast(MODES.light.get('divider')!, MODES.light.get('panel')!)
    expect(contrast(color('divider-raised'), color('raised'))).toBeGreaterThanOrEqual(lightDivider)
  })

  test('the field outline and the focus ring are at least 3:1 on the panel, the page and the raised surface', () => {
    for (const edge of ['field', 'focus']) {
      for (const surface of SURFACES) {
        expect(contrast(color(edge), color(surface)), `${edge} on ${surface}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
