import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  /** A line above the title, in the accent font, such as the dashboard's date. */
  eyebrow?: string
  /** The page's main action on the right, such as "Add deal". */
  actions?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, eyebrow, actions, children }: PageHeaderProps) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <title>{`${title} - Accountable`}</title>
      <div className="min-w-0">
        {eyebrow && <p className="font-serif text-[22px] leading-[1.1] text-ink-muted">{eyebrow}</p>}
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.01em]">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </header>
  )
}
