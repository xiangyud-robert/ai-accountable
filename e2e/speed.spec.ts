import { type Page } from '@playwright/test'
import { expect, reseed, searchBox, searchResults, test } from './fixtures'

// Recording a trace stores every file the page loads, which nearly doubles a reload's
// time. These tests time the app, so they don't record one.
test.use({ trace: 'off' })

// The spec promises each screen within a second on a typical laptop. These tests run the same
// on every machine, including GitHub's runner, which is two to three times slower than one, so
// they fail only past these limits, a guard against the app getting slower. Each prints its
// times, to compare with the promise.
const SCREEN_LIMIT_MS = 3000
const SEARCH_LIMIT_MS = 2000
// The top bar's search promises its results within half a second of the last key.
const TOP_BAR_SEARCH_LIMIT_MS = 1500

// The intent's speed constraint, with 500 more of each kind of record.
test.describe(() => {
  test.beforeEach(() => reseed(['--large']))

  /** Time from asking for a screen to its data being on it. */
  async function timed(open: () => Promise<unknown>, ready: () => Promise<void>) {
    const start = Date.now()
    await open()
    await ready()
    return Date.now() - start
  }

  // Each screen is timed twice: opened from the sidebar with the app already open, and
  // reloaded once the browser has the app's files. A brand-new browser fetching every file
  // from the dev server for the first time is the dev server starting up, not the screen.
  for (const [name, path, link, ready] of [
    [
      'organizations',
      '/organizations',
      'Organizations',
      (page: Page) =>
        expect(page.getByRole('table', { name: 'Organizations' }).locator('tbody tr').nth(500)).toBeAttached(),
    ],
    [
      'contacts',
      '/contacts',
      'Contacts',
      (page: Page) => expect(page.getByRole('table', { name: 'Contacts' }).locator('tbody tr').nth(500)).toBeAttached(),
    ],
    [
      'deals',
      '/deals',
      'Deals',
      (page: Page) => expect(page.getByRole('table', { name: 'Deals' }).locator('tbody tr').nth(500)).toBeAttached(),
    ],
    [
      'pipeline',
      '/pipeline',
      'Pipeline',
      (page: Page) => expect(page.locator('[data-deal-id]').nth(544)).toBeAttached(),
    ],
    [
      'dashboard',
      '/',
      'Dashboard',
      (page: Page) => expect(page.getByRole('region', { name: 'Follow-ups' })).toBeVisible(),
    ],
  ] as const) {
    test(`the ${name} screen shows its data within ${SCREEN_LIMIT_MS / 1000} seconds`, async ({ page }) => {
      await page.goto(path)
      await ready(page)
      await page.goto(path === '/' ? '/deals' : '/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const fromSidebar = await timed(
        () => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: link }).click(),
        () => ready(page),
      )
      const reloaded = await timed(
        () => page.reload(),
        () => ready(page),
      )
      console.log(`The ${name} screen: ${fromSidebar} ms from the sidebar, ${reloaded} ms reloaded`)
      expect(fromSidebar).toBeLessThan(SCREEN_LIMIT_MS)
      expect(reloaded).toBeLessThan(SCREEN_LIMIT_MS)
    })
  }

  test(`a record page shows its data within ${SCREEN_LIMIT_MS / 1000} seconds`, async ({ page }) => {
    await page.goto('/contacts')
    await expect(page.getByRole('table', { name: 'Contacts' }).locator('tbody tr').nth(500)).toBeAttached()
    const elapsed = await timed(
      () => page.getByRole('link', { name: 'Priya Raman' }).click(),
      () => expect(page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').first()).toBeVisible(),
    )
    console.log(`A record page: ${elapsed} ms`)
    expect(elapsed).toBeLessThan(SCREEN_LIMIT_MS)
  })

  test('typing in a table’s search keeps up', async ({ page }) => {
    await page.goto('/deals')
    await expect(page.getByRole('table', { name: 'Deals' }).locator('tbody tr').nth(500)).toBeAttached()
    const search = page.getByRole('searchbox', { name: 'Search deals' })
    await search.click()
    const start = Date.now()
    await page.keyboard.type('harbor logistics', { delay: 30 })
    await expect(search).toHaveValue('harbor logistics')
    await expect(page.getByText(/^\d+ of 545 deals$/)).toBeVisible()
    const elapsed = Date.now() - start
    // 16 keys at 30ms apart is about half a second, so the table has caught up within about
    // 1.5 seconds of the last.
    console.log(`The search: ${elapsed} ms from the first key to the filtered table`)
    expect(elapsed).toBeLessThan(SEARCH_LIMIT_MS)
    await expect(page.getByRole('table', { name: 'Deals' }).locator('tbody tr')).toHaveCount(5)
  })

  test(`the top bar's search shows its results within ${TOP_BAR_SEARCH_LIMIT_MS / 1000} seconds of the last key`, async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await searchBox(page).click()
    await page.keyboard.type('cobalt bank ', { delay: 30 })
    // Cobalt Bank and its 4 deals. The last key leaves only one of the deals, so a list with that
    // one result is the answer to the whole search.
    await expect(searchResults(page).getByRole('option')).toHaveCount(5)
    // Checked on every frame, since expect's retries are too far apart to time half a second.
    const start = Date.now()
    await page.keyboard.press('f')
    await page.waitForFunction(
      () => {
        const options = [...document.querySelectorAll('[role="search"] [role="option"]')]
        return options.length === 1 && options[0]!.textContent!.startsWith('Cobalt Bank fraud analytics pilot')
      },
      null,
      { polling: 'raf' },
    )
    const elapsed = Date.now() - start
    console.log(`The top bar's search: ${elapsed} ms from the last key to its results`)
    expect(elapsed).toBeLessThan(TOP_BAR_SEARCH_LIMIT_MS)
  })
})
