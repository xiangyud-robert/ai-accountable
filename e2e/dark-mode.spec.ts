import { type Page } from '@playwright/test'
import { expect, PAGES, test, turnOnDarkMode } from './fixtures'

// The spec's values (Look and feel), as Chrome reports them.
const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}
const LIGHT = { page: rgb('#F0F4F5'), panel: rgb('#FFFFFF') }
const DARK = {
  page: rgb('#04232E'),
  panel: rgb('#000000'),
  raised: rgb('#073B4C'), // Midnight
  divider: rgb('#1A3540'),
  negotiation: rgb('#CDD8DB'), // Sea Mist
}

const darkMode = (page: Page) => page.getByRole('switch', { name: 'Dark mode' })
const html = (page: Page) => page.locator('html')
const sidebar = (page: Page) => page.getByRole('complementary')

async function expectSurfaces(page: Page, colors: { page: string; panel: string }) {
  await expect(html(page)).toHaveCSS('background-color', colors.page)
  await expect(sidebar(page)).toHaveCSS('background-color', colors.panel)
  await expect(page.getByRole('region', { name: 'Deals won by month' })).toHaveCSS('background-color', colors.panel)
}

test('light is the default: with nothing saved, the page is light and the switch is off', async ({ page }) => {
  await page.goto('/')
  await expect(darkMode(page)).not.toBeChecked()
  await expectSurfaces(page, LIGHT)
})

test('criterion 2: the switch turns dark mode on and off, and is remembered after a reload', async ({ page }) => {
  await page.goto('/')
  await darkMode(page).click()
  await expect(darkMode(page)).toBeChecked()
  await expectSurfaces(page, DARK)

  await page.reload()
  await expect(darkMode(page)).toBeChecked()
  await expectSurfaces(page, DARK)

  await darkMode(page).click()
  await expect(darkMode(page)).not.toBeChecked()
  await page.reload()
  await expect(darkMode(page)).not.toBeChecked()
  await expectSurfaces(page, LIGHT)
})

test('concern 14: a saved dark mode is set before the app first draws', async ({ page }) => {
  await turnOnDarkMode(page)
  // Notes <html>'s mode when <body> appears, before which nothing can draw, and when the app puts
  // its first element on the page. A mode the app set itself would be missing at the first.
  await page.addInitScript(() => {
    const seen: Record<string, { theme: string | null; scheme: string }> = {}
    const note = (moment: string) => {
      const html = document.documentElement
      seen[moment] ??= { theme: html.getAttribute('data-theme'), scheme: html.style.colorScheme }
    }
    const observer = new MutationObserver(() => {
      if (document.body) note('body')
      if (document.getElementById('root')?.firstElementChild) {
        note('app')
        observer.disconnect()
      }
    })
    observer.observe(document, { childList: true, subtree: true })
    Object.assign(window, { modeSeen: seen })
  })
  await page.reload()
  await expect(darkMode(page)).toBeChecked()
  const seen = await page.evaluate(() => (window as unknown as { modeSeen: unknown }).modeSeen)
  expect(seen).toEqual({ body: { theme: 'dark', scheme: 'dark' }, app: { theme: 'dark', scheme: 'dark' } })
})

test('the switch is in the sidebar on every section and on Page not found', async ({ page }) => {
  for (const [name, path, heading] of PAGES) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading }), name).toBeVisible()
    await expect(sidebar(page).getByRole('switch', { name: 'Dark mode' }), name).toBeVisible()
  }
})

test('the switch works from the keyboard: Tab reaches it after the five sections, and Space or Enter flips it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  const sections = page.getByRole('navigation', { name: 'Sections' })
  for (const name of ['Dashboard', 'Organizations', 'Contacts', 'Deals', 'Pipeline']) {
    await page.keyboard.press('Tab')
    await expect(sections.getByRole('link', { name: new RegExp(`^${name}`) })).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(darkMode(page)).toBeFocused()

  await page.keyboard.press('Space')
  await expect(darkMode(page)).toBeChecked()
  await expect(html(page)).toHaveCSS('background-color', DARK.page)
  await page.keyboard.press('Enter')
  await expect(darkMode(page)).not.toBeChecked()
  await expect(html(page)).toHaveCSS('background-color', LIGHT.page)
})

test('a secondary button darkens on hover in light mode, and lightens in dark mode, where darkening barely shows', async ({
  page,
}) => {
  const edit = page.getByRole('button', { name: 'Edit', exact: true })
  await page.goto('/deals/12')
  await edit.hover()
  await expect(edit).toHaveCSS('filter', 'brightness(0.95)')

  await turnOnDarkMode(page)
  await page.goto('/deals/12')
  await edit.hover()
  await expect(edit).toHaveCSS('filter', 'brightness(1.25)')
})

test.describe('in dark mode', () => {
  test.beforeEach(async ({ page }) => turnOnDarkMode(page))

  test('the charts use the dark roles: the divider for gridlines, Sea Mist for Negotiation, Midnight tooltips', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('.recharts-cartesian-grid-horizontal line').first()).toHaveCSS('stroke', DARK.divider)

    const funnel = page.getByRole('region', { name: 'Sales funnel' })
    const negotiation = funnel.locator('.recharts-funnel-trapezoid path').nth(3)
    await expect(negotiation).toHaveCSS('fill', DARK.negotiation)

    const wonBars = page.getByRole('region', { name: 'Deals won by month' }).locator('.recharts-surface')
    await wonBars.hover({ position: { x: 120, y: 150 } })
    const tooltip = page.locator('.recharts-tooltip-wrapper > div').filter({ hasText: 'Deals won' })
    await expect(tooltip).toHaveCSS('background-color', DARK.raised)
  })

  test('the deal dialog is black, the Stage list and the message after saving are Midnight', async ({ page }) => {
    await page.goto('/deals')
    await page.getByRole('button', { name: 'Add deal' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add deal' })
    await expect(dialog).toHaveCSS('background-color', DARK.panel)

    await dialog.getByLabel('Stage', { exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCSS('background-color', DARK.raised)
    await page.getByRole('option', { name: 'Qualified', exact: true }).click()

    await dialog.getByLabel('Name').fill('Atlas Freight yard management')
    await dialog.getByLabel('Value (USD)').fill('42,500')
    await dialog.getByRole('button', { name: 'Save' }).click()
    const message = page.locator('[data-sonner-toast]').filter({ hasText: 'Deal saved' })
    await expect(message).toHaveCSS('background-color', DARK.raised)
  })

  test('Chrome’s own parts, such as scrollbars and the date pickers, are told the page is dark', async ({ page }) => {
    await page.goto('/deals')
    await expect(html(page)).toHaveCSS('color-scheme', 'dark')
  })
})
