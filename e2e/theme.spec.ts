// Criterion 5: the theme choice in the user menu, Light, Dark or System, and dark mode's colors
// (docs/specs/light-and-dark.md).

import { type Page } from '@playwright/test'
import { expect, openUserMenu, PAGES, test, themeChoice, turnOnDarkMode, userMenu } from './fixtures'

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

const html = (page: Page) => page.locator('html')

const sidebar = (page: Page) => page.getByRole('complementary')

async function expectSurfaces(page: Page, colors: { page: string; panel: string }) {
  await expect(html(page)).toHaveCSS('background-color', colors.page)
  await expect(sidebar(page)).toHaveCSS('background-color', colors.panel)
  await expect(page.getByRole('region', { name: 'Deals won by month' })).toHaveCSS('background-color', colors.panel)
}

async function openDashboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

test('light is the default: with nothing saved, the page is light and Light is chosen', async ({ page }) => {
  await openDashboard(page)
  await openUserMenu(page)
  await expect(themeChoice(page, 'Light')).toBeChecked()
  await expect(themeChoice(page, 'Dark')).not.toBeChecked()
  await expect(themeChoice(page, 'System')).not.toBeChecked()
  await expectSurfaces(page, LIGHT)
})

test('criterion 5: choosing Dark makes the page dark at once, leaves the menu open, and is remembered after a reload', async ({
  page,
}) => {
  await openDashboard(page)
  await openUserMenu(page)
  await themeChoice(page, 'Dark').click()
  await expect(themeChoice(page, 'Dark')).toBeChecked()
  await expect(userMenu(page)).toBeVisible()
  await expectSurfaces(page, DARK)

  await page.reload()
  await expectSurfaces(page, DARK)
  await openUserMenu(page)
  await expect(themeChoice(page, 'Dark')).toBeChecked()

  await themeChoice(page, 'Light').click()
  await expectSurfaces(page, LIGHT)
  await page.reload()
  await expectSurfaces(page, LIGHT)
  await openUserMenu(page)
  await expect(themeChoice(page, 'Light')).toBeChecked()
})

test('criterion 5: System follows Chrome’s color scheme, and changes with it while the page is open', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await openDashboard(page)
  await openUserMenu(page)
  await themeChoice(page, 'System').click()
  await expect(themeChoice(page, 'System')).toBeChecked()
  await expectSurfaces(page, LIGHT)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expectSurfaces(page, DARK)
  await expect(html(page)).toHaveCSS('color-scheme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expectSurfaces(page, LIGHT)

  // Still System after a reload, on a dark device.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.reload()
  await expectSurfaces(page, DARK)
  await openUserMenu(page)
  await expect(themeChoice(page, 'System')).toBeChecked()
})

for (const [choice, device] of [
  ['Dark', 'light'],
  ['System', 'dark'],
] as const) {
  test(`concern 14: a saved ${choice}, on a ${device} device, is in place before the app first draws`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: device })
    await openDashboard(page)
    await openUserMenu(page)
    await themeChoice(page, choice).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
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
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    const seen = await page.evaluate(() => (window as unknown as { modeSeen: unknown }).modeSeen)
    expect(seen).toEqual({ body: { theme: 'dark', scheme: 'dark' }, app: { theme: 'dark', scheme: 'dark' } })
  })
}

test('the theme choice is in the user menu on every section and on Page not found', async ({ page }) => {
  for (const [name, path, heading] of PAGES) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading }), name).toBeVisible()
    await openUserMenu(page)
    for (const choice of ['Light', 'Dark', 'System'] as const) {
      await expect(themeChoice(page, choice), name).toBeVisible()
    }
    await page.keyboard.press('Escape')
  }
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

  test('the user menu is Midnight, as menus are in dark mode', async ({ page }) => {
    await page.goto('/')
    await openUserMenu(page)
    await expect(userMenu(page)).toHaveCSS('background-color', DARK.raised)
  })

  test('Chrome’s own parts, such as scrollbars and the date pickers, are told the page is dark', async ({ page }) => {
    await page.goto('/deals')
    await expect(html(page)).toHaveCSS('color-scheme', 'dark')
  })
})
