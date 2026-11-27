import { choose, columnText, expect, pick, test } from './fixtures'

const ORDER = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

test('criteria 2 and 4: add, edit and delete a deal', async ({ page }) => {
  await page.goto('/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add deal' })
  await dialog.getByLabel('Name').fill('Atlas Freight yard management')
  await pick(dialog, 'Main contact', 'Ines Duarte')
  await expect(dialog.getByRole('combobox', { name: /^Organization/ })).toHaveText(/Atlas Freight/)
  await choose(dialog, 'Stage', 'Qualified')
  await dialog.getByLabel('Value (USD)').fill('42,500')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Deal saved')).toBeVisible()

  const row = page.getByRole('row', { name: /Atlas Freight yard management/ })
  await expect(row).toContainText('Qualified')
  await expect(row).toContainText('$42,500')
  await expect(row).toContainText('25%')
  await expect(row).toContainText('Jul 15, 2026')

  await page.getByRole('button', { name: 'Edit Atlas Freight yard management' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit deal' })
  await edit.getByLabel('Probability (%)').fill('40')
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await page.reload()
  await expect(page.getByRole('row', { name: /Atlas Freight yard management/ })).toContainText('40%')

  await page.getByRole('button', { name: 'Delete Atlas Freight yard management' }).click()
  const question = page.getByRole('alertdialog', { name: 'Delete Atlas Freight yard management?' })
  await expect(question).toContainText('Its stage history will be deleted.')
  await question.getByRole('button', { name: 'Delete deal' }).click()
  await expect(page.getByRole('row', { name: /Atlas Freight yard management/ })).toHaveCount(0)
  await expect(page.getByText('45 deals')).toBeVisible()
})

test('criterion 4: late deals show the Late badge in the table and on their page', async ({ page }) => {
  await page.goto('/deals')
  const table = page.getByRole('table', { name: 'Deals' })
  await expect(table.getByText('Late', { exact: true })).toHaveCount(3)
  const late = page.getByRole('row', { name: /Quarry & Co finance reporting setup/ })
  await expect(late).toContainText('Late')
  await late.getByRole('link', { name: 'Quarry & Co finance reporting setup' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quarry & Co finance reporting setup' })).toBeVisible()
  await expect(page.getByText('Late', { exact: true })).toBeVisible()
  await expect(page.getByText('Expected close')).toBeVisible()
})

test('sorting by stage follows pipeline order, then close date', async ({ page }) => {
  await page.goto('/deals')
  const table = page.getByRole('table', { name: 'Deals' })
  const heading = table.getByRole('columnheader', { name: 'Stage' })
  await expect(heading).toHaveAttribute('aria-sort', 'ascending')
  const stages = await columnText(table, 'Stage')
  expect(stages).toEqual([...stages].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)))
  expect(new Set(stages).size).toBe(6)

  await heading.getByRole('button').click()
  await expect(heading).toHaveAttribute('aria-sort', 'descending')
  const reversed = await columnText(table, 'Stage')
  expect(reversed[0]).toBe('Lost')
  expect(reversed.at(-1)).toBe('New')
})

test('the deal form fills in the probability and close date', async ({ page }) => {
  await page.goto('/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add deal' })
  await expect(dialog.getByLabel('Probability (%)')).toHaveValue('10')
  await expect(dialog.getByLabel('Close date')).toHaveValue('2026-07-15')
  await choose(dialog, 'Stage', 'Proposal')
  await expect(dialog.getByLabel('Probability (%)')).toHaveValue('50')
  await choose(dialog, 'Stage', 'Won')
  await expect(dialog.getByLabel('Probability (%)')).toHaveValue('100')
  await expect(dialog.getByLabel('Probability (%)')).toHaveAttribute('readonly', '')
  await expect(dialog.getByLabel('Close date')).toHaveValue('2026-06-15')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('a closed deal’s page says Closed', async ({ page }) => {
  await page.goto('/deals')
  await page.getByRole('link', { name: 'Ridgeway Manufacturing quality analytics' }).click()
  await expect(page.getByText('Closed', { exact: true })).toBeVisible()
  await expect(page.getByText('Jun 13, 2026', { exact: true })).toBeVisible()
})
