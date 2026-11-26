import { Command } from 'cmdk'
import { ChevronDown } from 'lucide-react'
import { Popover, Select } from 'radix-ui'
import { useState, type ComponentProps, type ReactNode, type Ref } from 'react'

const CONTROL =
  'h-9 w-full rounded-control border border-field bg-panel px-3 text-sm text-ink placeholder:text-ink-muted aria-[invalid=true]:border-alert disabled:bg-page disabled:text-ink-muted'

// A picker's option, with the focus ring when it's the one Enter would choose.
const PICKER_OPTION =
  'flex h-8 cursor-pointer items-center rounded-control px-2.5 text-sm data-[selected=true]:bg-page data-[selected=true]:outline-2 data-[selected=true]:outline-offset-2 data-[selected=true]:outline-focus'

type FieldProps = {
  id: string
  label: string
  optional?: boolean
  error?: string
  children: ReactNode
  className?: string
}

/** A visible label above the control, and its error below in the alert text color. */
export function Field({ id, label, optional, error, children, className = '' }: FieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
        {optional && <span className="font-normal text-ink-muted"> Optional</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-alert-text">
          {error}
        </p>
      )}
    </div>
  )
}

/** Links a control to its error, so screen readers read it out. */
export function described(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const
}

export function TextInput({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`${CONTROL} ${className}`} {...props} />
}

export function TextArea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea className={`${CONTROL} h-auto min-h-20 py-2 leading-normal ${className}`} {...props} />
}

type Option<T extends string | number> = { value: T; label: string; hint?: string }

type SelectFieldProps<T extends string> = {
  id: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  /** So the form can move focus here when it has an error. */
  ref?: Ref<HTMLButtonElement>
}

export function SelectField<T extends string>({
  id,
  value,
  onChange,
  options,
  disabled,
  invalid,
  describedBy,
  ref,
}: SelectFieldProps<T>) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <Select.Trigger
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${CONTROL} flex items-center justify-between gap-2 text-left`}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown aria-hidden size={16} className="text-ink-muted" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card bg-panel shadow-lift"
        >
          {/* The options take focus, and show the focus ring 2px outside their edge. The
              padding is on the viewport, which scrolls, so the ring isn't cut off. */}
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="flex h-8 cursor-pointer select-none items-center rounded-control px-2.5 text-sm data-[highlighted]:bg-page data-[state=checked]:font-semibold"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

type PickerProps = {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  options: Option<number>[]
  placeholder: string
  /** The choice for none, such as "No organization". */
  noneLabel: string
  invalid?: boolean
  describedBy?: string
  /** So the form can move focus here when it has an error. */
  ref?: Ref<HTMLButtonElement>
}

/** A picker you can search, for choosing one record out of hundreds. */
export function Picker({
  id,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  invalid,
  describedBy,
  ref,
}: PickerProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const popupId = `${id}-popup`

  const choose = (next: number | null) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={ref}
          id={id}
          type="button"
          role="combobox"
          // What Radix sets itself, written out so the lint can check the combobox has them.
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL} flex items-center justify-between gap-2 text-left`}
        >
          <span className={`truncate ${selected ? '' : 'text-ink-muted'}`}>{selected?.label ?? placeholder}</span>
          <ChevronDown aria-hidden size={16} className="shrink-0 text-ink-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id={popupId}
          aria-label={placeholder}
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-card bg-panel p-1.5 shadow-lift"
        >
          <Command
            label={placeholder}
            filter={(_value, search, keywords) =>
              (keywords ?? []).join(' ').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            {/* cmdk names the search box from the Command's label. */}
            <Command.Input placeholder="Search" className={CONTROL} />
            {/* Focus stays in the search box, so the option Enter would choose gets the focus
                ring itself. The list's padding, offset by its margin, keeps the ring in view. */}
            <Command.List className="-mx-1 max-h-60 overflow-y-auto p-1">
              <Command.Empty className="px-2.5 py-2 text-sm text-ink-muted">No matches.</Command.Empty>
              <Command.Item
                value="none"
                keywords={[noneLabel]}
                onSelect={() => choose(null)}
                className={`${PICKER_OPTION} text-ink-muted`}
              >
                {noneLabel}
              </Command.Item>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={String(option.value)}
                  keywords={[option.label, option.hint ?? '']}
                  onSelect={() => choose(option.value)}
                  className={`${PICKER_OPTION} gap-2`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ml-auto shrink-0 truncate text-xs text-ink-muted">{option.hint}</span>
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
