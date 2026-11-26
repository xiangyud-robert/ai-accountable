import { type Page } from '@playwright/test'
import { expect, expectNoAxeProblems, test } from './fixtures'

const PAGES = [
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

for (const [name, path, heading] of PAGES) {
  test(`criteria 7 and 8: axe finds no problems on ${name}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectNoAxeProblems(page)
  })
}

async function openAndCheck(page: Page, path: string, button: string, dialog: 'dialog' | 'alertdialog' = 'dialog') {
  await page.goto(path)
  await page.getByRole('button', { name: button, exact: true }).first().click()
  await expect(page.getByRole(dialog)).toBeVisible()
  await expectNoAxeProblems(page)
}

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
