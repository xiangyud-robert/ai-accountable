import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DANAS_SESSION, TODAY, testEnv } from './playwright.config'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Chrome's clock: 11:00 on the backend's fixed date, an hour before the backend's noon,
 *  so a time the browser fills in as now is never later than the backend's now (R8).
 *  The browser runs in America/Los_Angeles (see the config), which is UTC-7 in June. */
export const BROWSER_NOW = new Date(`${TODAY}T11:00:00-07:00`)

/** Runs a command in the repo against the tests' own database, and waits for it. npm and uv
 *  are .cmd files on Windows, so they need a shell there, and a shell takes one command line
 *  (passing the arguments separately is deprecated, DEP0190). No argument has a space. */
export function runCommand(command: string, args: string[]) {
  const windows = process.platform === 'win32'
  return spawnSync(windows ? [command, ...args].join(' ') : command, windows ? [] : args, {
    cwd: root,
    env: { ...process.env, ...testEnv },
    encoding: 'utf8',
    shell: windows,
  })
}

/** Replaces the test database's data with fresh sample data, as `npm run seed` does. */
export function reseed(extra: string[] = []) {
  const result = runCommand('uv', ['run', 'python', '-m', 'backend.seed', '--today', TODAY, ...extra])
  if (result.status !== 0) throw new Error(`Reseeding failed:\n${result.stdout}\n${result.stderr}`)
}

/** Anything not served by this computer, such as Supabase. Addresses with no host, such as
 *  `data:`, don't count. */
function isOffThisComputer(url: string) {
  const { protocol, hostname } = new URL(url)
  return (protocol === 'http:' || protocol === 'https:') && hostname !== '127.0.0.1'
}

/** A session's token as the browser keeps it, with its signature as the last part. */
export const TOKEN = String.raw`(eyJ[\w-]*\.[\w-]+\.)[\w-]+`

/** Dana's token, from the session the setup project saved, which every test starts with. */
function danasToken() {
  const session = JSON.parse(readFileSync(DANAS_SESSION, 'utf8')) as {
    origins: { localStorage: { value: string }[] }[]
  }
  const saved = session.origins
    .flatMap((origin) => origin.localStorage)
    .find(({ value }) => new RegExp(TOKEN).test(value))
  if (!saved) throw new Error(`No session token in ${DANAS_SESSION}`)
  return saved.value
}

type Fixtures = {
  consoleProblems: string[]
  /** Console lines a test causes on purpose, such as the network error Chrome logs for a 422. */
  expectedConsole: RegExp[]
  offMachineRequests: string[]
  /** For asking the backend directly, signed in as Dana (R15). */
  api: APIRequestContext
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
  // Fails any test whose page asks for anything off this computer, which proves the app never
  // reaches Supabase (risk 13). It only listens, so it doesn't slow the requests it watches.
  offMachineRequests: [
    async ({ context }, use) => {
      const requests: string[] = []
      context.on('request', (request) => {
        if (isOffThisComputer(request.url())) requests.push(request.url())
      })
      await use(requests)
      expect(requests, 'requests off this computer').toEqual([])
    },
    { auto: true },
  ],
  api: async ({ playwright }, use) => {
    const api = await playwright.request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${danasToken()}` } })
    await use(api)
    await api.dispose()
  },
})

export { expect }

/** The stand-in's password for every sample teammate (concern 18). */
export const STAND_IN_PASSWORD = 'accountable'

export const DANA = 'dana.holt@example.com'
export const JOEL = 'joel.abara@example.com'

/** For `test.use({ storageState: SIGNED_OUT })`, in tests that start with no one signed in. */
export const SIGNED_OUT = { cookies: [], origins: [] }

/** Signs in as a sample teammate on the sign-in screen the page is showing, and waits for the app. */
export async function signIn(page: Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(STAND_IN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
}

/** Every section and Page not found: a name for the test, its address and its main heading. */
export const PAGES = [
  ['the dashboard', '/', 'Dashboard'],
  ['the organizations', '/organizations', 'Organizations'],
  ['an organization', '/organizations/1', 'Harbor Logistics'],
  ['the contacts', '/contacts', 'Contacts'],
  ['a contact', '/contacts/1', 'Priya Raman'],
  ['the deals', '/deals', 'Deals'],
  ['a deal', '/deals/12', 'Harbor Logistics fleet analytics'],
  ['the pipeline', '/pipeline', 'Pipeline'],
  ['a missing page', '/no-such-page', 'Page not found'],
] as const

/** The top bar's search box, which finds any organization, contact or deal (R18). */
export const searchBox = (page: Page) => page.getByRole('search').getByRole('combobox', { name: 'Search', exact: true })

/** The list of results that opens below the search box. */
export const searchResults = (page: Page) => page.getByRole('search').getByRole('listbox')

/** The initials button at the right of the top bar, which opens the user menu. Its name ends with
 *  the initials it shows, since a name has to include the text on screen (WCAG 2.5.3). */
export const initialsButton = (page: Page, name = 'Dana Holt', initials = 'DH') =>
  page.getByRole('button', { name: `Account, ${name}, ${initials}`, exact: true })

/** The user menu, once it's open. */
export const userMenu = (page: Page) => page.getByRole('menu')

/** One of the theme choices in the open user menu. */
export const themeChoice = (page: Page, choice: 'Light' | 'Dark' | 'System') =>
  userMenu(page).getByRole('menuitemradio', { name: choice, exact: true })

/** Opens the user menu from the initials button, whoever is signed in. */
export async function openUserMenu(page: Page) {
  await page.getByRole('button', { name: /^Account, / }).click()
  await expect(userMenu(page)).toBeVisible()
}

/** Signs out with the user menu, which shows the sign-in screen. */
export async function signOut(page: Page) {
  await openUserMenu(page)
  await userMenu(page).getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
}

/** Chooses Dark in the user menu, from the dashboard, so the next page a test opens is dark.
 *  Each test starts with nothing saved, so in light mode. */
export async function turnOnDarkMode(page: Page) {
  await page.goto('/')
  await openUserMenu(page)
  await themeChoice(page, 'Dark').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(userMenu(page)).toBeHidden()
}

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
 *  It drops on the top quarter of `to`, its middle, just inside its bottom edge, or in the
 *  8px gap just above it, between it and the card before. */
export async function drag(
  page: Page,
  from: Locator,
  to: Locator,
  at: 'top' | 'middle' | 'bottom' | 'gap above' = 'middle',
) {
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Nothing to drag, or nowhere to drop it')
  const x0 = start.x + start.width / 2
  const y0 = start.y + start.height / 2
  const x1 = end.x + end.width / 2
  const y1 = {
    top: end.y + end.height / 4,
    middle: end.y + end.height / 2,
    bottom: end.y + end.height - 6,
    'gap above': end.y - 4,
  }[at]
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
  await page
    .getByRole('option', { name: new RegExp(`^${option}`) })
    .first()
    .click()
}

/** The text in one column of a table, row by row. */
export async function columnText(table: Locator, header: string): Promise<string[]> {
  const headers = await table.getByRole('columnheader').allTextContents()
  const index = headers.findIndex((h) => h.trim() === header)
  if (index < 0) throw new Error(`No column called ${header}: ${headers.join(', ')}`)
  return table
    .locator('tbody tr')
    .evaluateAll((rows, i) => rows.map((row) => (row.children[i] as HTMLElement).innerText.trim()), index)
}

/** Chrome logs every 422 reply as a console error. Tests that send bad fields on purpose expect it. */
export const SENDS_A_422 = /Failed to load resource: the server responded with a status of 422/
