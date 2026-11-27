// The initials button and the user menu: who's signed in, the theme and Sign out
// (docs/specs/sign-in.md).

import { type Page } from '@playwright/test'
import {
  expect,
  initialsButton,
  JOEL,
  openUserMenu,
  searchBox,
  signIn,
  signOut,
  test,
  themeChoice,
  TOKEN,
  turnOnDarkMode,
  userMenu,
} from './fixtures'

async function openDeal(page: Page) {
  await page.goto('/deals/12')
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
}

test('R16: the initials button shows DH, its tooltip gives the name, and the menu shows Dana’s name and email', async ({
  page,
}) => {
  await openDeal(page)
  await expect(initialsButton(page)).toHaveText('DH')
  await expect(initialsButton(page)).toHaveAttribute('aria-haspopup', 'menu')
  await initialsButton(page).hover()
  await expect(page.getByRole('tooltip')).toHaveText('Dana Holt')

  await initialsButton(page).click()
  await expect(userMenu(page)).toContainText('Dana Holt')
  await expect(userMenu(page)).toContainText('dana.holt@example.com')
  await expect(userMenu(page).getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
})

test('the menu works from the keyboard: Tab reaches it after the search box, Up and Down move, Enter chooses, Escape goes back', async ({
  page,
}) => {
  await openDeal(page)
  await searchBox(page).focus()
  await page.keyboard.press('Tab')
  await expect(initialsButton(page)).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(userMenu(page)).toBeVisible()
  await expect(themeChoice(page, 'Light')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(themeChoice(page, 'Dark')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(themeChoice(page, 'Dark')).toBeChecked()
  await page.keyboard.press('ArrowDown')
  await expect(themeChoice(page, 'System')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(userMenu(page).getByRole('menuitem', { name: 'Sign out' })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(themeChoice(page, 'System')).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(userMenu(page)).toBeHidden()
  await expect(initialsButton(page)).toBeFocused()

  // Space and Down open it too.
  for (const key of ['Space', 'ArrowDown']) {
    await page.keyboard.press(key)
    await expect(userMenu(page), key).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(userMenu(page), key).toBeHidden()
    await expect(initialsButton(page), key).toBeFocused()
  }
})

test('Sign out shows the sign-in screen with nothing from the session left, and Joel then sees his own initials and name', async ({
  page,
}) => {
  await openDeal(page)
  await signOut(page)
  await expect(page).toHaveURL('/deals/12')
  // The sign-in screen's small print names dana.holt@example.com, so that's not checked here.
  for (const text of ['Harbor Logistics', 'Dana Holt', 'DH']) {
    await expect(page.locator('body'), text).not.toContainText(text)
  }
  const tokensKept = await page.evaluate(
    (source) => Object.values(localStorage).filter((value) => new RegExp(source).test(value)).length,
    TOKEN,
  )
  expect(tokensKept, 'tokens kept in local storage').toBe(0)

  await signIn(page, JOEL)
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
  await expect(initialsButton(page, 'Joel Abara', 'JA')).toHaveText('JA')
  await openUserMenu(page)
  await expect(userMenu(page)).toContainText('Joel Abara')
  await expect(userMenu(page)).toContainText('joel.abara@example.com')
})

test('concern 14: the theme choice stays after signing out, for whoever signs in next', async ({ page }) => {
  await turnOnDarkMode(page)
  await signOut(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('region', { name: 'Sign in' })).toHaveCSS('background-color', 'rgb(0, 0, 0)')

  await signIn(page, JOEL)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await openUserMenu(page)
  await expect(themeChoice(page, 'Dark')).toBeChecked()
})
