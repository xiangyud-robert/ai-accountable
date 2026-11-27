// The setup project: signs in as Dana once, through the sign-in screen, and saves the session,
// which every test then starts with (see the config).

import { DANA, expect, signIn, test } from './fixtures'
import { DANAS_SESSION } from './playwright.config'

test('sign in as Dana', async ({ page }) => {
  await page.goto('/')
  await signIn(page, DANA)
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.context().storageState({ path: DANAS_SESSION })
})
