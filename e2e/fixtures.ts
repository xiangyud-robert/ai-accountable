import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TODAY, testEnv } from './playwright.config'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Chrome's clock: 11:00 on the backend's fixed date, an hour before the backend's noon,
 *  so a time the browser fills in as now is never later than the backend's now (R8).
 *  The browser runs in America/Los_Angeles (see the config), which is UTC-7 in June. */
export const BROWSER_NOW = new Date(`${TODAY}T11:00:00-07:00`)

/** Replaces the test database's data with fresh sample data, as `npm run seed` does. */
export function reseed(extra: string[] = []) {
  const result = spawnSync('uv', ['run', 'python', '-m', 'backend.seed', '--today', TODAY, ...extra], {
    cwd: root,
    env: { ...process.env, ...testEnv },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) throw new Error(`Reseeding failed:\n${result.stdout}\n${result.stderr}`)
}

type Fixtures = {
  consoleProblems: string[]
  /** Console lines a test causes on purpose, such as the network error Chrome logs for a 422. */
  expectedConsole: RegExp[]
}

export const test = base.extend<Fixtures>({
  expectedConsole: [[], { option: true }],
  // Every test starts from freshly loaded sample data, with Chrome's clock fixed, and
  // fails on any console error or warning.
  consoleProblems: [
    async ({ page, expectedConsole }, use) => {
      reseed()
      await page.clock.setFixedTime(BROWSER_NOW)
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          problems.push(`${message.type()}: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
      await use(problems)
      const unexpected = problems.filter((line) => !expectedConsole.some((pattern) => pattern.test(line)))
      expect(unexpected, 'console errors and warnings').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Fails if axe finds any WCAG 2 A or AA problem, such as contrast or a missing label. */
export async function expectNoAxeProblems(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  if (include) builder = builder.include(include)
  const results = await builder.analyze()
  const problems = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  )
  expect(problems).toEqual([])
}

/** Drags with the mouse in small steps, the way a person does, so dnd-kit sees a drag.
 *  It drops on the top quarter of `to`, its middle, or just inside its bottom edge. */
export async function drag(page: Page, from: Locator, to: Locator, at: 'top' | 'middle' | 'bottom' = 'middle') {
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Nothing to drag, or nowhere to drop it')
  const x0 = start.x + start.width / 2
  const y0 = start.y + start.height / 2
  const x1 = end.x + end.width / 2
  const y1 = at === 'top' ? end.y + end.height / 4 : at === 'bottom' ? end.y + end.height - 6 : end.y + end.height / 2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move(x0 + 8, y0 + 8, { steps: 4 })
  await page.mouse.move(x1, y1, { steps: 16 })
  await page.mouse.move(x1, y1 + 1, { steps: 2 })
  await page.mouse.up()
}

/** Chooses an option in one of the app's selects (Stage, Status, Type). */
export async function choose(scope: Page | Locator, label: string, option: string) {
  const page = 'page' in scope ? scope.page() : scope
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Searches in one of the app's pickers (Organization, Main contact) and chooses a record. */
export async function pick(scope: Page | Locator, label: string, option: string) {
  const page = 'page' in scope ? scope.page() : scope
  await scope.getByRole('combobox', { name: new RegExp(`^${label}`) }).click()
  await page.locator('[cmdk-input]').fill(option)
  await page.getByRole('option', { name: new RegExp(`^${option}`) }).first().click()
}

/** The text in one column of a table, row by row. */
export async function columnText(table: Locator, header: string): Promise<string[]> {
  const headers = await table.getByRole('columnheader').allTextContents()
  const index = headers.findIndex((h) => h.trim() === header)
  if (index < 0) throw new Error(`No column called ${header}: ${headers.join(', ')}`)
  return table.locator('tbody tr').evaluateAll(
    (rows, i) => rows.map((row) => (row.children[i] as HTMLElement).innerText.trim()),
    index,
  )
}

/** Chrome logs every 422 reply as a console error. Tests that send bad fields on purpose expect it. */
export const SENDS_A_422 = /Failed to load resource: the server responded with a status of 422/
