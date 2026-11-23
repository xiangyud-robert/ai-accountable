import { choose, columnText, expect, test } from './fixtures'

const number = (text: string) => Number(text.replace(/[$,%]/g, ''))

test('criterion 2: add an organization, find it, sort by each column, edit it and reload', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('button', { name: 'Add organization' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add organization' })
  await dialog.getByLabel('Name').fill('Tidewater Energy')
  await dialog.getByLabel(/^Website/).fill('tidewater.example')
  await dialog.getByLabel(/^Industry/).fill('Energy')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Organization saved')).toBeVisible()

  const table = page.getByRole('table', { name: 'Organizations' })
  await expect(table.getByRole('link', { name: 'Tidewater Energy' })).toBeVisible()
  await expect(page.getByText('16 organizations')).toBeVisible()

  // Find it by searching any part of any column, ignoring case.
  const search = page.getByRole('searchbox', { name: 'Search organizations' })
  await search.fill('TIDEWATER')
  await expect(page.getByText('1 of 16 organizations')).toBeVisible()
  await search.fill('energy')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await search.fill('')

  // Sort by each column, ascending then descending.
  for (const [header, numeric] of [
    ['Name', false],
    ['Industry', false],
    ['Website', false],
    ['Contacts', true],
    ['Open deals', true],
    ['Open value (USD)', true],
  ] as const) {
    const heading = table.getByRole('columnheader', { name: header, exact: true })
    for (const direction of ['ascending', 'descending']) {
      if (direction === 'ascending' && header === 'Name') {
        await expect(heading).toHaveAttribute('aria-sort', 'ascending')
      } else {
        await heading.getByRole('button').click()
      }
      await expect(heading).toHaveAttribute('aria-sort', direction)
      const values = (await columnText(table, header)).filter((v) => v !== '')
      const sorted = [...values].sort((a, b) =>
        numeric ? number(a) - number(b) : a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }),
      )
      expect(values).toEqual(direction === 'ascending' ? sorted : sorted.reverse())
    }
  }

  await page.getByRole('button', { name: 'Edit Tidewater Energy' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit organization' })
  await expect(edit.getByLabel('Name')).toHaveValue('Tidewater Energy')
  await edit.getByLabel(/^Industry/).fill('Utilities')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()

  await page.reload()
  const row = page.getByRole('row', { name: /Tidewater Energy/ })
  await expect(row).toContainText('Utilities')
  await expect(row).toContainText('tidewater.example')
})

test('deleting an organization asks first, with counts, and keeps its contacts and deals', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('button', { name: 'Delete Harbor Logistics' }).click()
  const question = page.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })
  await expect(question).toContainText('Its 3 contacts and 5 deals will be kept, with no organization.')
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await question.getByRole('button', { name: 'Delete organization' }).click()
  await expect(question).toBeHidden()
  await expect(page.getByText('Organization deleted')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Harbor Logistics' })).toHaveCount(0)

  await page.goto('/contacts')
  await expect(page.getByRole('row', { name: /Priya Raman/ })).toBeVisible()
  expect(await page.getByRole('row', { name: /Priya Raman/ }).locator('td').nth(1).innerText()).toBe('')

  await page.goto('/deals')
  const deal = page.getByRole('row', { name: /Harbor Logistics fleet analytics/ })
  await expect(deal).toBeVisible()
  expect(await deal.locator('td').nth(1).innerText()).toBe('')
  await expect(deal).toContainText('Priya Raman')
})

test('an organization’s page shows its contacts and deals, and adds them with the link filled in', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('link', { name: 'Cobalt Bank' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cobalt Bank' })).toBeVisible()
  const contacts = page.getByRole('region', { name: 'Contacts' })
  await expect(contacts.getByRole('link', { name: 'Daniel Okafor' })).toBeVisible()
  const deals = page.getByRole('region', { name: 'Deals' })
  await expect(deals.getByRole('link', { name: 'Cobalt Bank fraud analytics pilot' })).toBeVisible()

  await contacts.getByRole('button', { name: 'Add contact' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add contact' })
  await expect(dialog.getByRole('combobox', { name: /^Organization/ })).toHaveText(/Cobalt Bank/)
  await dialog.getByLabel('Name').fill('Rosa Diaz')
  await choose(dialog, 'Status', 'Qualified')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(contacts.getByRole('link', { name: 'Rosa Diaz' })).toBeVisible()

  await deals.getByRole('button', { name: 'Add deal' }).click()
  const dealDialog = page.getByRole('dialog', { name: 'Add deal' })
  await expect(dealDialog.getByRole('combobox', { name: /^Organization/ })).toHaveText(/Cobalt Bank/)
  await dealDialog.getByLabel('Name').fill('Cobalt Bank card analytics')
  await dealDialog.getByLabel('Value (USD)').fill('25000')
  await dealDialog.getByRole('button', { name: 'Save' }).click()
  await expect(deals.getByRole('link', { name: 'Cobalt Bank card analytics' })).toBeVisible()
})

test('deleting from an organization’s page goes back to the list', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('link', { name: 'Juniper Software' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const question = page.getByRole('alertdialog', { name: 'Delete Juniper Software?' })
  await expect(question).toContainText('Its 2 contacts will be kept, with no organization.')
  await question.getByRole('button', { name: 'Delete organization' }).click()
  await expect(page).toHaveURL('/organizations')
  await expect(page.getByText('14 organizations')).toBeVisible()
})

test('a website opens in a new tab', async ({ page }) => {
  await page.goto('/organizations')
  await page.getByRole('link', { name: 'Atlas Freight' }).click()
  await expect(page.getByRole('link', { name: 'atlasfreight.example' })).toHaveAttribute('target', '_blank')
})
