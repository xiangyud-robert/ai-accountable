import { AlertDialog } from 'radix-ui'
import { plural } from '../lib/format'
import type { ActivityType } from '../lib/types'
import { Button } from './Button'
import { useReturnFocus } from './returnFocus'

export type Question = { title: string; detail: string }

// The delete questions (R11). A sentence about linked records is left out when its count is zero.

export function organizationQuestion(name: string, contacts: number, deals: number): Question {
  const kept = [contacts && plural(contacts, 'contact'), deals && plural(deals, 'deal')].filter(Boolean)
  return {
    title: `Delete ${name}?`,
    detail: kept.length ? `Its ${kept.join(' and ')} will be kept, with no organization.` : '',
  }
}

export function contactQuestion(name: string, deals: number, activities: number): Question {
  const sentences = []
  if (deals) sentences.push(`Their ${plural(deals, 'deal')} will be kept, with no main contact.`)
  if (activities) {
    sentences.push(`The ${plural(activities, 'activity', 'activities')} logged on this contact will be deleted.`)
  }
  return { title: `Delete ${name}?`, detail: sentences.join(' ') }
}

export function dealQuestion(name: string, activities: number): Question {
  return {
    title: `Delete ${name}?`,
    detail: activities
      ? `The ${plural(activities, 'activity', 'activities')} logged on this deal and its stage history will be deleted.`
      : 'Its stage history will be deleted.',
  }
}

export function activityQuestion(type: ActivityType): Question {
  return { title: `Delete this ${type}?`, detail: '' }
}

type ConfirmDeleteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: Question
  /** Says what it deletes, such as "Delete organization". */
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
}

/** Asks before deleting. Cancel is the default button, and has focus. */
export function ConfirmDelete({ open, onOpenChange, question, confirmLabel, onConfirm, busy }: ConfirmDeleteProps) {
  const returnFocus = useReturnFocus(open)
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <AlertDialog.Content
          // With no detail there's no description, and Radix needs telling so.
          {...(question.detail ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={returnFocus}
          className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-panel bg-panel p-6 shadow-lift"
        >
          <AlertDialog.Title className="text-lg font-semibold">{question.title}</AlertDialog.Title>
          {question.detail && (
            <AlertDialog.Description className="mt-2 text-ink-muted">{question.detail}</AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2.5">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button variant="danger" disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
