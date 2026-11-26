import { type Locator, type Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Presses Tab until the target has focus, as someone using only the keyboard would. */
async function tabTo(page: Page, target: Locator, { max = 120, back = false } = {}) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
  }
  throw new Error('Tab never reached it')
}

/** The spec's focus ring: 2px of Cerulean, 2px outside the edge. axe doesn't check it. */
async function expectFocusRing(target: Locator) {
  await expect(target).toHaveCSS('outline-style', 'solid')
  await expect(target).toHaveCSS('outline-width', '2px')
  await expect(target).toHaveCSS('outline-color', 'rgb(17, 138, 178)')
  await expect(target).toHaveCSS('outline-offset', '2px')
}

test('criterion 8: the skip link, the sidebar, a dialog, sorting and logging an activity, by keyboard only', async ({
  page,
}) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  // Through the sidebar to Organizations.
  const nav = page.getByRole('navigation', { name: 'Sections' })
  await tabTo(page, nav.getByRole('link', { name: 'Organizations' }), { back: true })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Organizations' })).toBeVisible()

  // Add an organization in its dialog, and focus goes back to the button that opened it.
  const add = page.getByRole('button', { name: 'Add organization' })
  await tabTo(page, add)
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Add organization' })
  await expect(dialog.getByLabel('Name')).toBeFocused()
  await page.keyboard.type('Keyboard Industries')
  await page.keyboard.press('Tab')
  await page.keyboard.type('keyboard.example')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(add).toBeFocused()
  await expect(page.getByRole('link', { name: 'Keyboard Industries' })).toBeVisible()

  // Escape closes a dialog, and focus goes back too.
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(add).toBeFocused()

  // Sort a table.
  const industry = page.getByRole('columnheader', { name: 'Industry' })
  await tabTo(page, industry.getByRole('button'))
  await page.keyboard.press('Enter')
  await expect(industry).toHaveAttribute('aria-sort', 'ascending')
  await page.keyboard.press('Enter')
  await expect(industry).toHaveAttribute('aria-sort', 'descending')

  // Find a contact and log an activity on them.
  await tabTo(page, nav.getByRole('link', { name: 'Contacts' }), { back: true })
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('searchbox', { name: 'Search contacts' }))
  await page.keyboard.type('grace')
  await tabTo(page, page.getByRole('link', { name: 'Grace Whitfield' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Grace Whitfield' })).toBeVisible()

  const form = page.getByRole('form', { name: 'Log activity' })
  await tabTo(page, form.getByLabel('Type'))
  await page.keyboard.press('Enter')
  // As someone watching the screen would, wait for the list before choosing from it.
  await expect(page.getByRole('option', { name: 'Note' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Call' })).toBeFocused()
  await expectFocusRing(page.getByRole('option', { name: 'Call' }))
  await page.keyboard.press('Enter')
  await expect(form.getByLabel('Type')).toHaveText('Call')
  await tabTo(page, form.getByLabel('Description'))
  await page.keyboard.type('Called about the autumn term.')
  await tabTo(page, form.getByRole('button', { name: 'Log activity' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Timeline' }).getByRole('listitem').first()).toContainText(
    'Called about the autumn term.',
  )
})

test('a delete question by keyboard: Cancel has focus, and focus goes back after', async ({ page }) => {
  await page.goto('/deals')
  const remove = page.getByRole('button', { name: 'Delete Cobalt Bank fraud analytics pilot' })
  await tabTo(page, remove)
  await page.keyboard.press('Enter')
  const question = page.getByRole('alertdialog')
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(question).toBeHidden()
  await expect(remove).toBeFocused()
})

test('a picker can be searched and chosen from by keyboard', async ({ page }) => {
  await page.goto('/deals')
  await tabTo(page, page.getByRole('button', { name: 'Add deal' }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Add deal' })
  await page.keyboard.type('Keyboard deal')
  const contact = dialog.getByRole('combobox', { name: /^Main contact/ })
  await tabTo(page, contact)
  await page.keyboard.press('Enter')
  await page.keyboard.type('okafor')
  // Focus stays in the search box, and the option Enter would choose shows the ring.
  await expectFocusRing(page.getByRole('option', { name: /^Daniel Okafor/ }))
  await page.keyboard.press('Enter')
  await expect(contact).toHaveText(/Daniel Okafor/)
  await expect(dialog.getByRole('combobox', { name: /^Organization/ })).toHaveText(/Cobalt Bank/)
  await expect(contact).toBeFocused()
})

test('an activity’s menu by keyboard: its items show the focus ring, and focus goes back to its button', async ({
  page,
}) => {
  await page.goto('/deals/16')
  const actions = page.getByRole('button', { name: /^Actions for this/ }).first()
  await tabTo(page, actions)
  await page.keyboard.press('Enter')
  const edit = page.getByRole('menuitem', { name: 'Edit' })
  await expect(edit).toBeFocused()
  await expectFocusRing(edit)
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: /^Edit / })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(actions).toBeFocused()

  // The same for its delete question, cancelled.
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
  await page.keyboard.press('Enter')
  const question = page.getByRole('alertdialog')
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(question).toBeHidden()
  await expect(actions).toBeFocused()
})
