import { Toaster as Sonner, toast } from 'sonner'

/** White panels at the bottom right. Errors have an alert dot. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex w-[356px] items-center gap-2.5 rounded-card bg-panel px-4 py-3 text-sm text-ink shadow-lift',
        },
      }}
    />
  )
}

export const notify = {
  /** A short message confirming a save or delete, such as "Deal saved". */
  done: (message: string) => toast(message),
  failed: (message: string) => toast(message, { icon: <span aria-hidden className="size-2 rounded-full bg-alert" /> }),
}
