import { type Page } from '@playwright/test'
import {
  expect,
  expectNoAxeProblems,
  openUserMenu,
  PAGES,
  searchBox,
  searchResults,
  test,
  turnOnDarkMode,
} from './fixtures'

async function openAndCheck(page: Page, path: string, button: string, dialog: 'dialog' | 'alertdialog' = 'dialog') {
  await page.goto(path)
  await page.getByRole('button', { name: button, exact: true }).first().click()
  await expect(page.getByRole(dialog)).toBeVisible()
  await expectNoAxeProblems(page)
}

// Every check runs in both modes, since text meets AA contrast in both.
for (const mode of ['light', 'dark'] as const) {
  test.describe(`in ${mode} mode`, () => {
    if (mode === 'dark') test.beforeEach(async ({ page }) => turnOnDarkMode(page))

    for (const [name, path, heading] of PAGES) {
      test(`criteria 7 and 8: axe finds no problems on ${name}`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        await page.waitForLoadState('networkidle')
        await expectNoAxeProblems(page)
      })
    }

    test('axe finds no problems in the top bar’s search results, and with none found', async ({ page }) => {
      await page.goto('/')
      await searchBox(page).fill('ri')
      await expect(searchResults(page).getByRole('option').first()).toBeVisible()
      await expectNoAxeProblems(page)
      await searchBox(page).fill('zzz')
      await expect(page.getByRole('search')).toContainText('No organizations, contacts or deals match')
      await expectNoAxeProblems(page)
    })

    test('axe finds no problems in the open user menu', async ({ page }) => {
      await page.goto('/')
      await openUserMenu(page)
      await expectNoAxeProblems(page)
    })

    test('axe finds no problems in the organization form', async ({ page }) => {
      await openAndCheck(page, '/organizations', 'Add organization')
    })

    test('axe finds no problems in the contact form', async ({ page }) => {
      await openAndCheck(page, '/contacts', 'Add contact')
    })

    test('axe finds no problems in the deal form, with its errors showing', async ({ page }) => {
      await openAndCheck(page, '/deals', 'Add deal')
      await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('dialog').getByText('Enter a name.')).toBeVisible()
      await expectNoAxeProblems(page)
    })

    test('axe finds no problems in a delete question', async ({ page }) => {
      await openAndCheck(page, '/organizations', 'Delete Harbor Logistics', 'alertdialog')
    })

    test('axe finds no problems in the activity dialog, and with a picker open', async ({ page }) => {
      await page.goto('/deals/16')
      await page
        .getByRole('button', { name: /^Actions for this/ })
        .first()
        .click()
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoAxeProblems(page)

      await page.goto('/deals')
      await page.getByRole('button', { name: 'Add deal' }).click()
      await page
        .getByRole('dialog')
        .getByRole('combobox', { name: /^Organization/ })
        .click()
      await expect(page.locator('[cmdk-input]')).toBeFocused()
      await expectNoAxeProblems(page)
    })
  })
}
