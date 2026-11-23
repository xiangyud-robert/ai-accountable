import { SENDS_A_422, choose, expect, pick, test } from './fixtures'

test('criteria 2 and 3: add a lead, a qualified contact and a customer', async ({ page }) => {
  await page.goto('/contacts')
  for (const [name, status] of [
    ['Rosa Diaz', 'Lead'],
    ['Amir Khan', 'Qualified'],
    ['Lena Vogel', 'Customer'],
  ]) {
    await page.getByRole('button', { name: 'Add contact' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add contact' })
    await dialog.getByLabel('Name').fill(name)
    await dialog.getByLabel(/^Email/).fill(`${name.split(' ')[0].toLowerCase()}@example.com`)
    await dialog.getByLabel(/^Job title/).fill('Buyer')
    await pick(dialog, 'Organization', 'Atlas Freight')
    await choose(dialog, 'Status', status)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(status)
  }
  await expect(page.getByText('43 contacts')).toBeVisible()

  await page.reload()
  const lena = page.getByRole('row', { name: /Lena Vogel/ })
  await expect(lena).toContainText('Atlas Freight')
  await expect(lena).toContainText('Customer')
})

test.describe(() => {
  test.use({ expectedConsole: [SENDS_A_422] })

  test('a bad email gets the server’s message under the field', async ({ page }) => {
  await page.goto('/contacts')
  await page.getByRole('button', { name: 'Add contact' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add contact' })
  await dialog.getByLabel('Name').fill('Rosa Diaz')
  await dialog.getByLabel(/^Email/).fill('rosa@')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Enter an email address like name@example.com.')).toBeVisible()
  await expect(dialog.getByLabel(/^Email/)).toBeFocused()
  })
})

test('criterion 3: the status filter, surviving a reload', async ({ page }) => {
  await page.goto('/contacts')
  const filter = page.getByRole('group', { name: 'Status' })
  await expect(filter.getByRole('button', { name: /^Leads/ })).toHaveText('Leads16')
  await expect(filter.getByRole('button', { name: /^Customers/ })).toHaveText('Customers14')
  await filter.getByRole('button', { name: /^Customers/ }).click()
  await expect(page).toHaveURL('/contacts?status=customer')
  await expect(page.getByText('14 contacts')).toBeVisible()

  await page.reload()
  await expect(filter.getByRole('button', { name: /^Customers/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('table', { name: 'Contacts' }).locator('tbody tr')).toHaveCount(14)

  await page.getByRole('searchbox', { name: 'Search contacts' }).fill('harbor')
  await expect(page.getByText('2 of 14 contacts')).toBeVisible()
})

test('criterion 3: a contact’s page shows their organization and deals', async ({ page }) => {
  await page.goto('/contacts')
  await page.getByRole('link', { name: 'Priya Raman' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Priya Raman' })).toBeVisible()
  await expect(page.getByText('Customer', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Harbor Logistics', exact: true })).toHaveAttribute('href', /\/organizations\/1$/)
  await expect(page.getByRole('link', { name: 'priya@harborlogistics.example' })).toHaveAttribute('href', 'mailto:priya@harborlogistics.example')
  const deals = page.getByRole('region', { name: 'Deals' })
  await expect(deals.getByRole('listitem')).toHaveCount(4)
  await expect(deals.getByRole('link', { name: 'Harbor Logistics fleet analytics' })).toBeVisible()
})

test('deleting a contact keeps their deals, with no main contact', async ({ page }) => {
  await page.goto('/contacts')
  await page.getByRole('link', { name: 'Priya Raman' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const question = page.getByRole('alertdialog', { name: 'Delete Priya Raman?' })
  await expect(question).toContainText(/Their 4 deals will be kept, with no main contact\. The \d+ activit(y|ies) logged on this contact will be deleted\./)
  await question.getByRole('button', { name: 'Delete contact' }).click()
  await expect(page).toHaveURL('/contacts')
  await expect(page.getByText('39 contacts')).toBeVisible()

  await page.goto('/deals')
  const deal = page.getByRole('row', { name: /Harbor Logistics fleet analytics/ })
  await expect(deal).toBeVisible()
  expect(await deal.locator('td').nth(2).innerText()).toBe('')
})
