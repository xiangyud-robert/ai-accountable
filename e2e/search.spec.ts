// Criterion 4: the top bar's search finds an organization, a contact and a deal by part of a
// name, in any case (R18, docs/specs/search.md).

import { type Page } from '@playwright/test'
import { expect, searchBox, searchResults, test } from './fixtures'

type Kind = 'Organizations' | 'Contacts' | 'Deals'
/** A group of results, whose heading may also give the total, as in "Deals, 5 of 13". */
const group = (page: Page, kind: Kind) => searchResults(page).getByRole('group', { name: new RegExp(`^${kind}`) })
/** A result in its group, by the start of its name. */
const result = (page: Page, kind: Kind, name: string) =>
  group(page, kind)
    .getByRole('option')
    .filter({ hasText: new RegExp(`^${name}`) })

async function openDashboard(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

test('R18: part of a name, in any case, finds an organization, a contact and a deal, each in its group with its second line', async ({
  page,
}) => {
  await openDashboard(page)
  await searchBox(page).fill('RI')

  const groups = searchResults(page).getByRole('group')
  await expect(groups).toHaveCount(3)
  await expect(groups.nth(0)).toHaveAccessibleName('Organizations')
  await expect(groups.nth(1)).toHaveAccessibleName('Contacts')
  await expect(groups.nth(2)).toHaveAccessibleName('Deals, 5 of 13')

  await expect(result(page, 'Organizations', 'Meridian Insurance')).toContainText('Financial services')
  await expect(result(page, 'Contacts', 'Priya Raman')).toContainText('Head of Operations, Harbor Logistics')
  await expect(result(page, 'Deals', 'Ridgeway Manufacturing quality analytics')).toContainText(
    'Ridgeway Manufacturing, Won, $145,000',
  )
  // The part that matches is in semibold, in the name's own case.
  await expect(result(page, 'Contacts', 'Priya Raman').locator('.font-semibold')).toHaveText('ri')

  // Choosing one opens its page, then clears the box and closes the list.
  await result(page, 'Contacts', 'Priya Raman').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Priya Raman' })).toBeVisible()
  await expect(page).toHaveURL('/contacts/1')
  await expect(searchBox(page)).toHaveValue('')
  await expect(searchResults(page)).toBeHidden()
})

test('R18: a group with more than 5 results says how many there are, and shows names that start with the search first', async ({
  page,
}) => {
  await openDashboard(page)
  await searchBox(page).fill('ri')
  await expect(group(page, 'Deals')).toHaveAccessibleName('Deals, 5 of 13')
  await expect(group(page, 'Deals').getByRole('option')).toHaveText([
    /^Ridgeway Manufacturing quality analytics/,
    /^Ridgeway Manufacturing shop floor dashboards/,
    /^Ridgeway Manufacturing support plan/,
    /^Ridgeway Manufacturing support plan renewal/,
    /^Atlas Freight driver app/,
  ])
})

test('no results says so', async ({ page }) => {
  await openDashboard(page)
  await searchBox(page).fill('zzz')
  await expect(page.getByRole('search')).toContainText('No organizations, contacts or deals match "zzz".')
  await expect(searchResults(page).getByRole('option')).toHaveCount(0)
})

test('with the keyboard: / reaches the box, Down and Enter open a result, and Escape closes and clears', async ({
  page,
}) => {
  await openDashboard(page)
  await page.keyboard.press('/')
  await expect(searchBox(page)).toBeFocused()
  await page.keyboard.type('cobalt bank')
  // The first result is highlighted as the list opens, and Down moves on to the next group.
  await expect(result(page, 'Organizations', 'Cobalt Bank')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(result(page, 'Deals', 'Cobalt Bank analytics training')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Cobalt Bank analytics training' })).toBeVisible()
  await expect(searchBox(page)).toHaveValue('')
  await expect(searchResults(page)).toBeHidden()

  // From this page too, once focus has left the box.
  await page.getByRole('heading', { level: 1, name: 'Cobalt Bank analytics training' }).click()
  await page.keyboard.press('/')
  await expect(searchBox(page)).toBeFocused()
  await page.keyboard.type('har')
  await expect(searchResults(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(searchResults(page)).toBeHidden()
  await expect(searchBox(page)).toHaveValue('')
  // A second Escape, in the empty box, leaves focus where it is.
  await page.keyboard.press('Escape')
  await expect(searchBox(page)).toBeFocused()
})

test('/ types itself in a field rather than moving to the search box', async ({ page }) => {
  await page.goto('/deals')
  const tableSearch = page.getByRole('searchbox', { name: 'Search deals' })
  await tableSearch.click()
  await page.keyboard.press('/')
  await expect(tableSearch).toHaveValue('/')
  await expect(searchBox(page)).not.toBeFocused()
})

test('clicking away closes the list and keeps the text, and coming back opens it again', async ({ page }) => {
  await openDashboard(page)
  await searchBox(page).fill('har')
  await expect(result(page, 'Organizations', 'Harbor Logistics')).toBeVisible()
  // The sidebar's tagline, which the list doesn't cover.
  await page.getByText('Every deal, accounted for').click()
  await expect(searchResults(page)).toBeHidden()
  await expect(searchBox(page)).toHaveValue('har')
  await searchBox(page).click()
  await expect(result(page, 'Organizations', 'Harbor Logistics')).toBeVisible()
})
