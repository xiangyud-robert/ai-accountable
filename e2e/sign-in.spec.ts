// Criterion 2, signed out: R15, the sign-in screen and staying signed in (docs/specs/sign-in.md).

import { type Page } from '@playwright/test'
import {
  DANA,
  expect,
  expectNoAxeProblems,
  PAGES,
  SIGNED_OUT,
  signIn,
  signOut,
  test,
  TOKEN,
  turnOnDarkMode,
} from './fixtures'

const WRONG = 'Wrong email or password.'
const ENDED = 'Your session has ended. Sign in again to carry on.'
const STAND_IN_PRINT =
  'On this computer, sign in as a sample teammate, such as dana.holt@example.com, with the password accountable.'
/** Chrome logs every 401 reply as a console error, as it does for a wrong password. */
const SENDS_A_401 = /Failed to load resource: the server responded with a status of 401/

const signInHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Sign in' })
const password = (page: Page) => page.getByLabel('Password', { exact: true })

/** Spoils the signature of the token the saved session holds, as a restart of the backend would,
 *  since its key for the stand-in's tokens is only in memory (risk 10). */
async function spoilSavedToken(page: Page) {
  const spoiled = await page.evaluate((source) => {
    const token = new RegExp(source)
    const keys = Object.keys(localStorage).filter((key) => token.test(localStorage.getItem(key) ?? ''))
    for (const key of keys) localStorage.setItem(key, localStorage.getItem(key)!.replace(token, '$1spoiled'))
    return keys.length
  }, TOKEN)
  expect(spoiled, 'saved sessions').toBe(1)
}

/** Holds back the stand-in's answer to signing in until the returned function is called. */
async function holdSignIn(page: Page) {
  let release = () => {}
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/stand-in/sign-in', async (route) => {
    await released
    await route.continue()
  })
  return release
}

async function signInWrongly(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill(DANA)
  await password(page).fill('not the password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(WRONG)).toBeVisible()
}

test.describe('signed out', () => {
  test.use({ storageState: SIGNED_OUT })

  test('R15: every page shows the sign-in screen, with no sidebar, top bar or data', async ({ page }) => {
    const asked: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) asked.push(request.url())
    })
    for (const [name, path, heading] of PAGES) {
      await page.goto(path)
      await expect(signInHeading(page), name).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 }), name).toHaveCount(1)
      await expect(page.getByRole('complementary'), name).toHaveCount(0)
      await expect(page.getByRole('navigation'), name).toHaveCount(0)
      await expect(page.getByRole('search'), name).toHaveCount(0)
      await expect(page.locator('body'), name).not.toContainText(heading)
    }
    expect(asked, 'requests to the API').toEqual([])
  })

  test('signing in on a deal’s address shows that deal', async ({ page }) => {
    await page.goto('/deals/12')
    await expect(signInHeading(page)).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
    await signIn(page, DANA)
    await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
    await expect(page).toHaveURL('/deals/12')
  })

  test('concern 18: the small print says how to sign in on this computer', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(STAND_IN_PRINT)).toBeVisible()
  })

  test('R15: every address under /api answers 401, even one that doesn’t exist', async ({ request }) => {
    for (const path of ['/api/deals', '/api/no-such-thing']) {
      const reply = await request.get(path)
      expect(reply.status(), path).toBe(401)
      expect(await reply.json(), path).toEqual({ detail: 'Sign in to carry on.' })
    }
  })

  test.describe('with a wrong password', () => {
    test.use({ expectedConsole: [SENDS_A_401] })

    test('the button says Signing in... and can’t be pressed, then the message shows and the password is cleared', async ({
      page,
    }) => {
      await page.goto('/')
      const release = await holdSignIn(page)
      await page.getByLabel('Email', { exact: true }).fill(DANA)
      await password(page).fill('not the password')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
      release()
      await expect(page.getByRole('alert')).toHaveText(WRONG)
      await expect(password(page)).toHaveValue('')
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
      await expect(signInHeading(page)).toBeVisible()
    })
  })
})

test('staying signed in: after a reload the person is still signed in, and the sign-in screen never flashed', async ({
  page,
}) => {
  await page.goto('/deals/12')
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
  // Notes what the page puts in #root as it loads: the sign-in screen, known by its Password
  // field, and the app, known by its sidebar's sections.
  await page.addInitScript(() => {
    const seen = { signInScreen: false, app: false }
    const has = (node: Node, selector: string) =>
      node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null)
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        seen.signInScreen ||= has(node, 'input[type="password"]')
        seen.app ||= has(node, 'nav[aria-label="Sections"]')
      }
    }).observe(document, { childList: true, subtree: true })
    Object.assign(window, { screensSeen: seen })
  })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
  const seen = await page.evaluate(() => (window as unknown as { screensSeen: unknown }).screensSeen)
  expect(seen).toEqual({ signInScreen: false, app: true })
})

test.describe('when the session ends or someone signs out', () => {
  test.use({ expectedConsole: [SENDS_A_401] })

  test('a session that ends while the app is open shows “Your session has ended”, and signing in again returns to the same page', async ({
    page,
  }) => {
    await page.goto('/deals/12')
    await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics fleet analytics' })).toBeVisible()
    await spoilSavedToken(page)
    // The organization's page asks the API for it, with the spoiled token.
    await page.getByRole('link', { name: 'Harbor Logistics', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText(ENDED)
    await expect(signInHeading(page)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0)

    await signIn(page, DANA)
    await expect(page.getByRole('heading', { level: 1, name: 'Harbor Logistics' })).toBeVisible()
    await expect(page).toHaveURL('/organizations/1')
  })

  test('concern 14: with dark saved, the sign-in screen is dark', async ({ page }) => {
    await turnOnDarkMode(page)
    await signOut(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(4, 35, 46)')
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
    await expect(page.getByRole('region', { name: 'Sign in' })).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  })

  for (const mode of ['light', 'dark'] as const) {
    test(`axe finds no problems on the sign-in screen in ${mode} mode, with and without its error`, async ({
      page,
    }) => {
      if (mode === 'dark') await turnOnDarkMode(page)
      else await page.goto('/')
      await signOut(page)
      await expectNoAxeProblems(page)
      await signInWrongly(page)
      await expectNoAxeProblems(page)
    })
  }
})
