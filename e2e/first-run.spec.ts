import { expect, test } from './fixtures'

test('criterion 1: the app opens on the dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
})

test('every section opens from the sidebar', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sections' })
  for (const [section, path] of [
    ['Organizations', '/organizations'],
    ['Contacts', '/contacts'],
    ['Deals', '/deals'],
    ['Pipeline', '/pipeline'],
    ['Dashboard', '/'],
  ]) {
    await nav.getByRole('link', { name: section }).click()
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1, name: section })).toBeVisible()
  }
})

test('the sidebar shows how many records each list has', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await expect(nav.getByRole('link', { name: 'Organizations' })).toContainText('15')
  await expect(nav.getByRole('link', { name: 'Contacts' })).toContainText('40')
  await expect(nav.getByRole('link', { name: 'Deals' })).toContainText('45')
})

test('criterion 1: every section shows sample data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Revenue won in June')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Follow-ups' }).getByRole('listitem')).toHaveCount(11)
  await expect(page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem')).toHaveCount(10)

  for (const [path, table, rows] of [
    ['/organizations', 'Organizations', 15],
    ['/contacts', 'Contacts', 40],
    ['/deals', 'Deals', 45],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('table', { name: table }).locator('tbody tr')).toHaveCount(rows)
  }

  await page.goto('/pipeline')
  await expect(page.locator('[data-deal-id]')).toHaveCount(45)

  await page.goto('/contacts')
  await page.getByRole('link', { name: 'Priya Raman' }).click()
  await expect(page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').first()).toBeVisible()
})

test('an unknown address says the page was not found', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Go to the dashboard' }).click()
  await expect(page).toHaveURL('/')
})

test('the fonts are the brand’s, loaded from the app with no request to Google', async ({ page, context }) => {
  // Anything not served by the app itself fails, as it would with no internet connection.
  const outside: string[] = []
  await context.route(/^(?!http:\/\/127\.0\.0\.1).*/, (route) => {
    outside.push(route.request().url())
    return route.abort()
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  const loaded = await page.evaluate(async () => {
    // Each loads from the app's own files, or comes back empty if it can't be fetched.
    const load = async (font: string) => (await document.fonts.load(font)).map((face) => face.status)
    return {
      sans: await load('600 16px "Instrument Sans"'),
      serif: await load('400 17px "Instrument Serif"'),
      mono: await load('500 16px "JetBrains Mono"'),
      body: getComputedStyle(document.body).fontFamily,
    }
  })
  expect(loaded.body).toContain('Instrument Sans')
  for (const faces of [loaded.sans, loaded.serif, loaded.mono]) {
    expect(faces.length).toBeGreaterThan(0)
    expect(faces.every((status) => status === 'loaded')).toBe(true)
  }
  expect(outside).toEqual([])
})

test('a skip link comes first, and the page has its landmarks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})
