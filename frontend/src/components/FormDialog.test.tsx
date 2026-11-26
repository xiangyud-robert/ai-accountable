import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FormEvent } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { FormDialog } from './FormDialog'

function renderDialog(props: Partial<Parameters<typeof FormDialog>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
  render(
    <FormDialog open onOpenChange={onOpenChange} title="Edit organization" onSubmit={onSubmit} {...props}>
      <label htmlFor="name">Name</label>
      <input id="name" defaultValue="Harbor Logistics" />
    </FormDialog>,
  )
  return { onOpenChange, onSubmit, dialog: screen.getByRole('dialog', { name: 'Edit organization' }) }
}

describe('FormDialog', () => {
  test('is named by its title and holds the form, with Cancel and Save', () => {
    const { dialog } = renderDialog()
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Harbor Logistics')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  test('Save submits the form, and so does Enter in a field', async () => {
    const { dialog, onSubmit, onOpenChange } = renderDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    await userEvent.type(within(dialog).getByLabelText('Name'), '{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('the submit button can say what it does, and is disabled while saving', () => {
    const { dialog } = renderDialog({ submitLabel: 'Log activity', busy: true })
    expect(within(dialog).getByRole('button', { name: 'Log activity' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  test('Cancel and Escape close it without submitting', async () => {
    const { dialog, onSubmit, onOpenChange } = renderDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    onOpenChange.mockClear()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('focus starts on the first field and stays inside', async () => {
    const { dialog } = renderDialog()
    const name = within(dialog).getByLabelText('Name')
    expect(name).toHaveFocus()
    await userEvent.tab()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.tab()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.tab()
    expect(name).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveFocus()
  })
})
