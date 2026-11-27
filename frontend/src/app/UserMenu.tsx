import { LogOut } from 'lucide-react'
import { DropdownMenu, Tooltip } from 'radix-ui'
import { signOut } from '../auth/session'
import { useMe } from '../auth/useMe'
import { ThemeChoice } from './ThemeChoice'

/** The initials button at the right of the top bar, and the user menu it opens
 *  (docs/specs/sign-in.md). */
export function UserMenu() {
  const { data: me } = useMe()
  if (!me) return null
  // Someone with no display name shows by their email (R16), so it shows only once.
  const hasDisplayName = me.name !== me.email

  return (
    // Not modal: a modal menu hides the rest of the page from screen readers while its links can
    // still take focus, which axe reports as aria-hidden-focus. Radix keeps Tab in the open menu.
    <DropdownMenu.Root modal={false}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {/* In the secondary button's colors, which change on hover as a secondary button's do.
              Its name ends with the initials it shows, so speech control can use them too
              (WCAG 2.5.3, label in name). */}
          <DropdownMenu.Trigger
            aria-label={`Account, ${me.name}, ${me.initials}`}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-[13px] font-semibold text-ink transition hover:brightness-(--secondary-hover-brightness)"
          >
            {me.initials}
          </DropdownMenu.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-control bg-raised px-2.5 py-1.5 text-xs font-medium text-ink shadow-lift"
          >
            {me.name}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 w-60 rounded-card bg-raised p-1 shadow-lift">
          <DropdownMenu.Label className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            {hasDisplayName && <p className="truncate text-xs text-ink-muted">{me.email}</p>}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-divider-raised" />
          <ThemeChoice />
          <DropdownMenu.Separator className="my-1 h-px bg-divider-raised" />
          <DropdownMenu.Item
            onSelect={() => void signOut()}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-sm data-[highlighted]:bg-page"
          >
            <LogOut aria-hidden size={16} className="text-ink-muted" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
