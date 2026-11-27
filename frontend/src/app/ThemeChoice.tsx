import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useId, useState } from 'react'
import { type Choice, currentChoice, setChoice } from '../lib/colorMode'

const CHOICES: { value: Choice; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

/** The theme choice, for inside a Radix DropdownMenu.Content: a "Theme" label over Light, Dark and
 *  System, announced as a group of three choices with the chosen one checked. Choosing one changes
 *  the mode at once and leaves the menu open, so the change can be seen. */
export function ThemeChoice() {
  const labelId = useId()
  const [chosen, setChosen] = useState(currentChoice)

  const choose = (value: string) => {
    const choice = value as Choice
    setChoice(choice)
    setChosen(choice)
  }

  return (
    <>
      <DropdownMenu.Label id={labelId} className="px-2.5 pt-2 pb-1 text-[13px] font-medium text-ink-muted">
        Theme
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup aria-labelledby={labelId} value={chosen} onValueChange={choose}>
        {CHOICES.map(({ value, label, Icon }) => (
          <DropdownMenu.RadioItem
            key={value}
            value={value}
            // Radix closes the menu after a choice unless this is prevented.
            onSelect={(event) => event.preventDefault()}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-sm data-[highlighted]:bg-page"
          >
            <Icon aria-hidden size={16} className="text-ink-muted" />
            {label}
            <DropdownMenu.ItemIndicator className="ml-auto">
              <Check aria-hidden size={16} />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  )
}
