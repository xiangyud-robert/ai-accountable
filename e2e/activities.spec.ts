import { type Page } from '@playwright/test'
import { API_PORT } from './playwright.config'
import { choose, expect, test } from './fixtures'

const timeline = (page: Page) => page.getByRole('list', { name: 'Timeline' }).getByRole('listitem')
const entry = (page: Page, text: string) => timeline(page).filter({ hasText: text })

async function openContact(page: Page, name: string) {
  await page.goto('/contacts')
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function openDeal(page: Page, name: string) {
  await page.goto('/deals')
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** The timeline's texts on screen match the server's, whose times run newest first. */
async function expectNewestFirst(page: Page, path: string) {
  const record = await (await page.request.get(`http://127.0.0.1:${API_PORT}/api${path}`)).json()
  const times: string[] = record.timeline.map((e: { at: string }) => e.at)
  expect(times).toEqual([...times].sort().reverse())
  const texts = await timeline(page).locator('p').first().allTextContents()
  expect(texts.length).toBeGreaterThan(0)
  const shown = await timeline(page).evaluateAll((items) => items.map((li) => li.querySelector('p')!.textContent))
  expect(shown).toEqual(record.timeline.map((e: { text: string }) => e.text))
}

test('criterion 5: log a note on a contact', async ({ page }) => {
  await openContact(page, 'Grace Whitfield')
  const form = page.getByRole('form', { name: 'Log activity' })
  await expect(form.getByLabel('When')).toHaveValue('2026-06-15T11:00')
  await form.getByLabel('Description').fill('Asked about pricing for the summer term.')
  await form.getByRole('button', { name: 'Log activity' }).click()
  await expect(page.getByText('Activity logged')).toBeVisible()

  await expect(timeline(page).first()).toContainText('Asked about pricing for the summer term.')
  await expect(timeline(page).first()).toContainText('Today, 11:00 AM')
  await expect(form.getByLabel('Description')).toHaveValue('')
  const id = page.url().split('/').pop()
  await expectNewestFirst(page, `/contacts/${id}`)
})

test('criterion 5: a call with a follow-up on a deal, also on its main contact’s timeline', async ({ page }) => {
  await openDeal(page, 'Northwind Health analytics rollout')
  const form = page.getByRole('form', { name: 'Log activity' })
  await choose(form, 'Type', 'Call')
  await form.getByLabel('Description').fill('Call with Elena about the rollout plan.')
  await form.getByLabel(/^Follow-up date/).fill('2026-06-18')
  await form.getByRole('button', { name: 'Log activity' }).click()

  const call = timeline(page).first()
  await expect(call).toContainText('Call with Elena about the rollout plan.')
  await expect(call).toContainText('Follow up Jun 18')
  await expect(call.getByRole('checkbox', { name: 'Done' })).not.toBeChecked()
  const id = page.url().split('/').pop()
  await expectNewestFirst(page, `/deals/${id}`)

  await page.getByRole('link', { name: 'Elena Petrova' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Elena Petrova' })).toBeVisible()
  const onContact = entry(page, 'Call with Elena about the rollout plan.')
  await expect(onContact).toContainText('On Northwind Health analytics rollout')
  await expect(timeline(page).first()).toContainText('Call with Elena about the rollout plan.')
})

test('criterion 5: a stage change adds "Moved from ... to ..." to the deal’s timeline and recent activity', async ({ page }) => {
  await openDeal(page, 'Northwind Health analytics rollout')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit deal' })
  await choose(dialog, 'Stage', 'Proposal')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(timeline(page).first()).toContainText('Moved from Negotiation to Proposal')
  await expect(timeline(page).first()).toContainText('Today, 12:00 PM')
  await expect(page.getByText('Proposal', { exact: true }).first()).toBeVisible()

  await page.goto('/')
  const recent = page.getByRole('region', { name: 'Recent activity' }).getByRole('listitem').first()
  await expect(recent).toContainText('Moved from Negotiation to Proposal')
  await expect(recent).toContainText('Northwind Health analytics rollout')
  await expect(recent).toContainText('12:00 PM')
})

test('criteria 5 and 6: a new follow-up shows on the dashboard, and marking it done removes it', async ({ page }) => {
  await openContact(page, 'Kofi Mensah')
  const form = page.getByRole('form', { name: 'Log activity' })
  await choose(form, 'Type', 'Email')
  await form.getByLabel('Description').fill('Send Kofi the customs integration brief')
  await form.getByLabel(/^Follow-up date/).fill('2026-06-17')
  await form.getByRole('button', { name: 'Log activity' }).click()
  await expect(timeline(page).first()).toContainText('Send Kofi the customs integration brief')

  await page.goto('/')
  const followUps = page.getByRole('region', { name: 'Follow-ups' })
  await expect(followUps).toContainText('5 overdue, 7 due in the next 7 days')
  const item = followUps.getByRole('listitem').filter({ hasText: 'Send Kofi the customs integration brief' })
  await expect(item).toContainText('Due in 2 days')
  await expect(item.getByRole('link', { name: 'Kofi Mensah' })).toBeVisible()

  await item.getByRole('checkbox', { name: 'Done' }).click()
  await expect(page.getByText('Follow-up done')).toBeVisible()
  await expect(item).toHaveCount(0)
  await expect(followUps).toContainText('5 overdue, 6 due in the next 7 days')

  // Marked done from the dashboard, it shows as done in the timeline.
  await openContact(page, 'Kofi Mensah')
  await expect(entry(page, 'Send Kofi the customs integration brief').getByRole('checkbox', { name: 'Done' })).toBeChecked()
})

test('a follow-up can be marked done and not done in the timeline', async ({ page }) => {
  await openDeal(page, 'Brightline Retail POS integration')
  const redlines = entry(page, 'Send the contract redlines')
  await expect(redlines).toContainText('Follow up Jun 16')
  await redlines.getByRole('checkbox', { name: 'Done' }).click()
  await expect(redlines.getByRole('checkbox', { name: 'Done' })).toBeChecked()
  await expect(redlines).not.toContainText('Follow up Jun 16')
  await page.reload()
  await expect(entry(page, 'Send the contract redlines').getByRole('checkbox', { name: 'Done' })).toBeChecked()
  await entry(page, 'Send the contract redlines').getByRole('checkbox', { name: 'Done' }).click()
  await expect(entry(page, 'Send the contract redlines')).toContainText('Follow up Jun 16')
})

test('an overdue follow-up says so', async ({ page }) => {
  await openDeal(page, 'Sable Hotels booking engine rollout')
  await expect(entry(page, 'Chase the signed order form')).toContainText('Overdue since Jun 6')
})

test('editing and deleting an activity', async ({ page }) => {
  await openDeal(page, 'Brightline Retail POS integration')
  const redlines = entry(page, 'Send the contract redlines')
  await redlines.getByRole('button', { name: 'Actions for this email' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit email' })
  await expect(dialog.getByLabel('Description')).toHaveValue('Send the contract redlines')
  await dialog.getByLabel('Description').fill('Send the contract redlines to Marcus')
  await choose(dialog, 'Type', 'Call')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Activity saved')).toBeVisible()

  const edited = entry(page, 'Send the contract redlines to Marcus')
  await expect(edited).toBeVisible()
  await edited.getByRole('button', { name: 'Actions for this call' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const question = page.getByRole('alertdialog', { name: 'Delete this call?' })
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await question.getByRole('button', { name: 'Delete call' }).click()
  await expect(page.getByText('Activity deleted')).toBeVisible()
  await expect(entry(page, 'Send the contract redlines to Marcus')).toHaveCount(0)
})

test('stage and status entries have no edit or delete', async ({ page }) => {
  await openContact(page, 'Priya Raman')
  const added = entry(page, 'Added at New').first()
  await expect(added).toBeVisible()
  await expect(added.getByRole('button')).toHaveCount(0)
  const became = entry(page, 'Became a customer when')
  await expect(became).toBeVisible()
  await expect(became.getByRole('button')).toHaveCount(0)
})
