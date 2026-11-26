import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

const SRC = join(__dirname, '..')
const THEME = join(__dirname, 'theme.css')
const THIS_TEST = join(__dirname, 'theme.test.ts')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|oklch)\(/i
const BRAND_NAME = /sea[\s-]?green|marigold|coral|cerulean|raspberry|midnight|sea[\s-]?mist|\bslate\b|\bgr[ae]y\b/i

describe('colors are used by role', () => {
  test('no source file other than theme.css has a color value or a brand color name', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => path !== THEME && path !== THIS_TEST)
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${relative(SRC, path)}:${i + 1}` }))
          .filter(({ line }) => HEX.test(line) || COLOR_FUNCTION.test(line) || BRAND_NAME.test(line))
          .map(({ at, line }) => `${at}: ${line.trim()}`),
      )
    expect(offenders).toEqual([])
  })

  const theme = readFileSync(THEME, 'utf8')
  const role = (name: string) => new RegExp(`--color-${name}:\\s*[^;]+;`).test(theme)

  test('every stage has its role and tint', () => {
    for (const stage of ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']) {
      expect(role(`stage-${stage}`), stage).toBe(true)
      expect(role(`stage-${stage}-tint`), stage).toBe(true)
    }
  })

  test('every status has its role and tint', () => {
    for (const status of ['lead', 'qualified', 'customer']) {
      expect(role(`status-${status}`), status).toBe(true)
      expect(role(`status-${status}-tint`), status).toBe(true)
    }
  })

  test('the favicon, which can’t use the theme, has only the theme’s ink and primary colors', () => {
    const favicon = readFileSync(join(SRC, '..', 'public', 'favicon.svg'), 'utf8')
    const value = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]+)`, 'i'))![1].toLowerCase()
    const colors = new Set([...favicon.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([hex]) => hex.toLowerCase()))
    expect(colors).toEqual(new Set([value('ink'), value('primary')]))
  })

  test('the spec’s other roles are there', () => {
    for (const name of [
      'page',
      'panel',
      'ink',
      'ink-muted',
      'divider',
      'field',
      'focus',
      'link',
      'primary',
      'primary-tint',
      'alert',
      'alert-tint',
    ]) {
      expect(role(name), name).toBe(true)
    }
  })
})
