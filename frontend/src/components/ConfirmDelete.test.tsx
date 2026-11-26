import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import {
  ConfirmDelete,
  activityQuestion,
  contactQuestion,
  dealQuestion,
  organizationQuestion,
  type Question,
} from './ConfirmDelete'

const read = ({ title, detail }: Question) => (detail ? `${title} ${detail}` : title)

describe('the delete questions', () => {
  test('read as in the spec', () => {
    expect(read(organizationQuestion('Harbor Logistics', 3, 2))).toBe(
      'Delete Harbor Logistics? Its 3 contacts and 2 deals will be kept, with no organization.',
    )
    expect(read(contactQuestion('Priya Raman', 2, 5))).toBe(
      'Delete Priya Raman? Their 2 deals will be kept, with no main contact. The 5 activities logged on this contact will be deleted.',
    )
    expect(read(dealQuestion('Northwind analytics rollout', 4))).toBe(
      'Delete Northwind analytics rollout? The 4 activities logged on this deal and its stage history will be deleted.',
    )
    expect(read(activityQuestion('call'))).toBe('Delete this call?')
  })

  test('leave out a sentence when its count is zero', () => {
    expect(read(organizationQuestion('Harbor Logistics', 0, 2))).toBe(
      'Delete Harbor Logistics? Its 2 deals will be kept, with no organization.',
    )
    expect(read(organizationQuestion('Harbor Logistics', 1, 0))).toBe(
      'Delete Harbor Logistics? Its 1 contact will be kept, with no organization.',
    )
    expect(read(organizationQuestion('Harbor Logistics', 0, 0))).toBe('Delete Harbor Logistics?')
    expect(read(contactQuestion('Priya Raman', 0, 1))).toBe(
      'Delete Priya Raman? The 1 activity logged on this contact will be deleted.',
    )
    expect(read(contactQuestion('Priya Raman', 1, 0))).toBe(
      'Delete Priya Raman? Their 1 deal will be kept, with no main contact.',
    )
    expect(read(contactQuestion('Priya Raman', 0, 0))).toBe('Delete Priya Raman?')
    expect(read(dealQuestion('Northwind analytics rollout', 0))).toBe(
      'Delete Northwind analytics rollout? Its stage history will be deleted.',
    )
  })
})

describe('ConfirmDelete', () => {
  test('shows the question, and Cancel has focus', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDelete
        open
        onOpenChange={() => {}}
        question={organizationQuestion('Harbor Logistics', 3, 2)}
        confirmLabel="Delete organization"
        onConfirm={onConfirm}
      />,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Harbor Logistics?' })
    expect(dialog).toHaveAccessibleDescription('Its 3 contacts and 2 deals will be kept, with no organization.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    screen.getByRole('button', { name: 'Delete organization' }).click()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  test('with nothing more to say, the question has no description', () => {
    render(
      <ConfirmDelete
        open
        onOpenChange={() => {}}
        question={activityQuestion('call')}
        confirmLabel="Delete call"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('alertdialog', { name: 'Delete this call?' })).not.toHaveAccessibleDescription()
  })

  test('while deleting, the delete button is disabled, and Cancel still closes it', async () => {
    const onOpenChange = vi.fn()
    render(
      <ConfirmDelete
        open
        onOpenChange={onOpenChange}
        question={dealQuestion('Northwind analytics rollout', 0)}
        confirmLabel="Delete deal"
        onConfirm={() => {}}
        busy
      />,
    )
    expect(screen.getByRole('button', { name: 'Delete deal' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  })
})
