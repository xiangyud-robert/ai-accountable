import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { ConfirmDelete, organizationQuestion } from './ConfirmDelete'
import { FormDialog } from './FormDialog'

/** A page's main area, where focus goes when what opened a dialog is gone. */
function Main({ children }: { children: React.ReactNode }) {
  return (
    <main id="content" tabIndex={-1}>
      {children}
    </main>
  )
}

/** An Edit button that opens a form, as on a list page. */
function EditButton({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <Main>
      <button type="button" onClick={() => setOpen(true)}>
        Edit Harbor Logistics
      </button>
      <FormDialog open={open} onOpenChange={setOpen} title="Edit organization" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="name">Name</label>
        <input id="name" />
      </FormDialog>
    </Main>
  )
}

/** A row whose Delete button goes once the delete is confirmed. */
function DeletableRow() {
  const [deleted, setDeleted] = useState(false)
  const [asking, setAsking] = useState(false)
  return (
    <Main>
      {!deleted && (
        <button type="button" onClick={() => setAsking(true)}>
          Delete Harbor Logistics
        </button>
      )}
      <ConfirmDelete
        open={asking}
        onOpenChange={setAsking}
        question={organizationQuestion('Harbor Logistics', 0, 0)}
        confirmLabel="Delete organization"
        onConfirm={() => {
          setDeleted(true)
          setAsking(false)
        }}
      />
    </Main>
  )
}

/** An activity's menu, whose Edit item opens a form, as on a timeline. */
function ActivityMenu() {
  const [editing, setEditing] = useState(false)
  return (
    <Main>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>Actions for this call</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={() => setEditing(true)}>Edit</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <FormDialog open={editing} onOpenChange={setEditing} title="Edit call" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="description">Description</label>
        <input id="description" />
      </FormDialog>
    </Main>
  )
}

describe('closing a dialog returns focus', () => {
  test('to the button that opened it, after Cancel or Escape', async () => {
    render(<EditButton />)
    const edit = screen.getByRole('button', { name: 'Edit Harbor Logistics' })
    await userEvent.click(edit)
    expect(screen.getByLabelText('Name')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(edit).toHaveFocus())

    await userEvent.click(edit)
    expect(screen.getByLabelText('Name')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(edit).toHaveFocus())
  })

  test('to the main area when the button is gone, such as a deleted row', async () => {
    render(<DeletableRow />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Harbor Logistics' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete organization' }))
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Delete Harbor Logistics' })).not.toBeInTheDocument()
  })

  test('to the main area when nothing had focus as it opened', async () => {
    render(<EditButton startOpen />)
    expect(screen.getByRole('dialog', { name: 'Edit organization' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  })

  test('to the menu’s button, for a dialog opened from an item in a menu', async () => {
    render(<ActivityMenu />)
    const actions = screen.getByRole('button', { name: 'Actions for this call' })
    await userEvent.click(actions)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Edit call' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(actions).toHaveFocus())
  })
})
