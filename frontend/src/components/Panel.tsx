import { useId, type ReactNode } from 'react'

type PanelProps = {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** A white, rounded panel with a soft shadow and no outline. */
export function Panel({ title, subtitle, action, children, className = '' }: PanelProps) {
  const id = useId()
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`min-w-0 rounded-panel bg-panel px-6 py-[22px] shadow-panel ${className}`}
    >
      {(title || action) && (
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={id} className="text-base font-semibold">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
