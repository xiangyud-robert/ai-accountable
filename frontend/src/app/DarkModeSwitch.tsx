import { Moon } from 'lucide-react'
import { Switch } from 'radix-ui'
import { useId, useState } from 'react'
import { currentMode, setMode } from '../lib/colorMode'

/** The Dark mode switch. It starts in the mode index.html's script set, and changes it at once. */
export function DarkModeSwitch({ className = '' }: { className?: string }) {
  const id = useId()
  const [dark, setDark] = useState(() => currentMode() === 'dark')

  const flip = (on: boolean) => {
    setMode(on ? 'dark' : 'light')
    setDark(on)
  }

  return (
    <div className={`flex h-[42px] items-center gap-3 px-3 ${className}`}>
      <Moon aria-hidden size={18} className="text-ink-muted" />
      <label htmlFor={id} className="font-medium">
        Dark mode
      </label>
      {/* A 36 by 20px pill with a 16px knob, which moves right when it's on. */}
      <Switch.Root
        id={id}
        checked={dark}
        onCheckedChange={flip}
        className="ml-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-field p-0.5 data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block size-4 rounded-full bg-panel data-[state=checked]:translate-x-4" />
      </Switch.Root>
    </div>
  )
}
