import { Dialog } from 'radix-ui'
import type { FormEventHandler, ReactNode } from 'react'
import { Button } from './Button'
import { useReturnFocus } from './returnFocus'

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSubmit: FormEventHandler<HTMLFormElement>
  submitLabel?: string
  busy?: boolean
  children: ReactNode
}

/** A form in a 520px dialog over the overlay. Focus stays inside, Escape closes it, and
 *  focus goes back to whatever opened it. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  submitLabel = 'Save',
  busy,
  children,
}: FormDialogProps) {
  const returnFocus = useReturnFocus(open)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-48px)] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel bg-panel p-6 shadow-lift"
        >
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <form noValidate onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
            {children}
            <div className="mt-2 flex justify-end gap-2.5">
              <Dialog.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={busy}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
