// Criterion 3: every record and activity shows who added it (R17), with the sample data's
// teammates (docs/specs/sample-data.md).

import { type Page } from '@playwright/test'
import { DANA, expect, JOEL, SIGNED_OUT, signIn, signOut, test } from './fixtures'

const lastChanged = (page: Page) => page.getByText(/^Last changed by /)

async function open(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

test('R17: an organization, a contact and a deal each show who added them and who last changed them', async ({
  page,
}) => {
  for (const [path, heading, added, changed] of [
    [
      '/organizations/1',
      'Harbor Logistics',
      'Added by Joel Abara on Apr 21, 2025',
      'Last changed by Dana Holt on Sep 23, 2025',
    ],
    [
      '/contacts/1',
      'Priya Raman',
      'Added by Joel Abara on May 1, 2025',
      'Last changed by Nora Lindqvist on Jul 16, 2025',
    ],
    [
      '/deals/12',
      'Harbor Logistics fleet analytics',
      'Added by Dana Holt on May 1, 2026',
      'Last changed by Dana Holt on Jun 13, 2026',
    ],
  ]) {
    await open(page, path, heading)
    await expect(page.getByText(added, { exact: true }), heading).toBeVisible()
    await expect(page.getByText(changed, { exact: true }), heading).toBeVisible()
  }
})

test('R17: a record no one has changed since it was added shows only who added it', async ({ page }) => {
  await open(page, '/organizations/2', 'Brightline Retail')
  await expect(page.getByText('Added by Dana Holt on Apr 22, 2025', { exact: true })).toBeVisible()
  await expect(lastChanged(page)).toHaveCount(0)
})

test.describe('two people on one browser', () => {
  test.use({ storageState: SIGNED_OUT })

  test('R17: a record Joel adds shows “Added by Joel Abara”, and once Dana edits it, “Last changed by Dana Holt”', async ({
    page,
  }) => {
    await page.goto('/organizations')
    await signIn(page, JOEL)
    await page.getByRole('button', { name: 'Add organization' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add organization' })
    await dialog.getByLabel('Name').fill('Tidewater Energy')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('link', { name: 'Tidewater Energy' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Tidewater Energy' })).toBeVisible()
    await expect(page.getByText('Added by Joel Abara on Jun 15, 2026', { exact: true })).toBeVisible()
    await expect(lastChanged(page)).toHaveCount(0)

    // Joel signs out, and Dana signs in on the same page.
    await signOut(page)
    await signIn(page, DANA)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Edit organization' })
    await edit.getByLabel(/^Industry/).fill('Energy')
    await edit.getByRole('button', { name: 'Save' }).click()
    await expect(edit).toBeHidden()
    await expect(page.getByText('Added by Joel Abara on Jun 15, 2026', { exact: true })).toBeVisible()
    await expect(page.getByText('Last changed by Dana Holt on Jun 15, 2026', { exact: true })).toBeVisible()
  })
})

test('an activity logged on a contact shows who logged it in the timeline', async ({ page }) => {
  await open(page, '/contacts/6', 'Grace Whitfield')
  const form = page.getByRole('form', { name: 'Log activity' })
  await form.getByLabel('Description').fill('Sent the welcome pack.')
  await form.getByRole('button', { name: 'Log activity' }).click()
  const newest = page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').first()
  await expect(newest).toContainText('Sent the welcome pack.')
  await expect(newest).toContainText('Today, 11:00 AM, by Dana Holt')
})

test('the dashboard’s follow-ups and recent activity show who logged each', async ({ page }) => {
  await open(page, '/', 'Dashboard')
  const item = (region: string, text: string) =>
    page.getByRole('region', { name: region }).getByRole('listitem').filter({ hasText: text })

  // Every follow-up is an activity, so each says who logged it.
  const followUps = page.getByRole('region', { name: 'Follow-ups' }).getByRole('listitem')
  await expect(followUps).toHaveCount(11)
  for (const followUp of await followUps.all()) {
    await expect(followUp).toContainText(/by (Dana Holt|Joel Abara|Nora Lindqvist|Wes Moreno)/)
  }
  await expect(item('Follow-ups', 'Chase the signed order form')).toContainText('by Nora Lindqvist')
  await expect(item('Follow-ups', 'Send revised pricing for a 3-year term')).toContainText('by Joel Abara')

  await expect(item('Recent activity', 'Walked through the fleet analytics proposal')).toContainText('by Wes Moreno')
  await expect(item('Recent activity', 'Sent the onboarding checklist to Grace.')).toContainText('by Joel Abara')
})
