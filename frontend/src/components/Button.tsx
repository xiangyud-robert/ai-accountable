import { Tooltip } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-ink hover:brightness-95',
  secondary: 'bg-secondary text-ink hover:brightness-95',
  danger: 'bg-alert-fill text-on-fill hover:brightness-95',
  ghost: 'text-ink hover:bg-page',
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; icon?: ReactNode }

export function Button({
  variant = 'secondary',
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control px-3.5 text-sm font-semibold transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

type IconButtonProps = ComponentProps<'button'> & {
  /** Read out by screen readers, such as "Edit Harbor Logistics". */
  label: string
  /** Shown on hover. The label is used if there's no tooltip. */
  tooltip?: string
}

/** A 32px square button with a label for screen readers and a tooltip. */
export function IconButton({ label, tooltip, className = '', children, type = 'button', ...props }: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type={type}
          aria-label={label}
          className={`inline-grid size-8 shrink-0 place-items-center rounded-control text-ink-muted transition hover:bg-page hover:text-ink ${className}`}
          {...props}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 rounded-control bg-panel px-2.5 py-1.5 text-xs font-medium text-ink shadow-lift"
        >
          {tooltip ?? label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
