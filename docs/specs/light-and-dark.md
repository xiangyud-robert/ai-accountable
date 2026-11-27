# Light and dark mode

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

13. **Dark mode colors.** The brand gives dark mode a `#04232E` page with black panels and cards, Sea Mist as ink, and Sea Green and Marigold lightened for text. Against black, every full-strength brand color passes 3:1 except Midnight, at 1.7:1. So in dark mode:
    - Negotiation is Sea Mist, the brand's ink on dark, just as Midnight is its ink on light. Its tint is Midnight.
    - Menus, lists, tooltips and messages, which open on top of black panels, are Midnight. Black on black would show no edge, and shadows barely show on a dark page. Panels, cards, the sidebar and dialogs stay black.
    - Dialogs sit over Midnight at 70%, which dims what's behind them toward Midnight, so the black dialog stands out from the black panels under it.
    - Primary buttons and ticked checkboxes keep Midnight text on Sea Green, since Sea Mist on Sea Green would be about 1.3:1.
    - The logo mark keeps its Midnight circle and Sea Green dot, matching the favicon, which can't change with the mode.
14. **The theme choice is kept in the browser.** It's a setting for this screen, not a record, so it's saved in the browser's local storage, one of the two things the browser keeps (R14). That way the page is in the right mode before anything draws, and a dark page never flashes light while the app loads, the sign-in screen included.
    - The choice is Light, Dark or System. System follows the device's light or dark setting, and changes with it while the app is open, such as when the device turns dark in the evening.
    - It's saved as `light`, `dark` or `system`, so choosing Light saves `light`. If nothing is saved, or the saved value isn't exactly one of those three, in lower case, the app is in light mode.
    - The choice belongs to the browser: it stays after signing out, and applies to whoever signs in on that browser next.
    - If the browser won't save it, the choice still works until the page is reloaded.
    - Another open tab changes when it's next loaded.
    - Switching happens at once, with no message. The few things that already animate on hover, such as the dashboard's tiles and the buttons, take their usual 150ms to change.

## How it fits together

- **Light or dark:** the theme file holds a light and a dark value for each color role. A few lines at the top of `index.html` read the saved choice and, for System, the device's setting, and mark the page as dark before anything draws (concern 14). With System, the page also listens for the device's setting to change. The page tells Chrome which mode it's in, so Chrome's own parts, such as scrollbars and the date and time pickers, follow it.
- **The choice on the page:** the same lines keep the choice on `<html>`, as `data-theme-choice`, and the app changes it there when someone chooses in the menu. Only these lines listen for the device's setting, and they read the choice from `<html>` each time it changes, so System keeps following the device after it's chosen in the menu, even when the browser won't save it.

## Colors

**Colors in dark mode,** from the brand's dark surfaces (concern 13). Each contrast ratio is measured against the black panels, the page and the raised Midnight surface, in that order.

| Role | Value | Use |
|---|---|---|
| Page | `#04232E` | Page background (1.3:1 against the panels) |
| Panel | `#000000` | Panels, cards, the sidebar, dialogs and inputs |
| Raised | `#073B4C`, Midnight | Menus, select lists, pickers, tooltips, messages and the skip link (1.7:1 against the panels, 1.35:1 against the page) |
| Ink | `#CDD8DB`, Sea Mist | Main text (14.4:1, 11.2:1, 8.3:1) |
| Ink muted | `#9DB1B8` | Secondary text (9.4:1, 7.3:1, 5.4:1) |
| Link | `#4FB6D9` | Cerulean lightened, for links (9.0:1, 7.0:1, 5.2:1) |
| Primary text | `#51E2BC` | Sea Green lightened, as text (13.0:1, 10.1:1, 7.5:1) |
| Alert text | `#F47E9A` | Raspberry lightened, for late dates, overdue labels and error messages (8.3:1, 6.5:1, 4.8:1) |
| Secondary | `#073B4C`, Midnight | Secondary buttons, with Sea Mist text (8.3:1) |
| Divider | `#1A3540` | Lines between table rows, chart gridlines |
| Divider raised | `#04232E`, the page | Lines between groups in a menu on the raised surface (1.35:1 against Midnight). The divider would be 1.07:1 there, and lost. |
| Overlay | Midnight at 70% | Behind dialogs |
| Chart wash | Sea Green at 18% | The line chart's area |

These keep their light-mode values, and pass on the dark surfaces:

- Sea Green, Marigold, Coral, Cerulean, Raspberry and Grey as fills, dots and chart marks. Cerulean is the lowest, at 5.3:1 against the panels and 4.1:1 against the page.
- Cerulean as the focus ring (5.3:1, 4.1:1, 3.0:1).
- The field outline (6.3:1, 4.9:1, 3.6:1).
- Primary buttons, Sea Green with Midnight text (6.4:1), and the Raspberry fill with white text (5.1:1).

Badge backgrounds in dark mode are a 30% shade of each color over black, with Sea Mist text (7.5 to 9.1:1): Sea Green `#024030`, Marigold `#4C3A15`, Coral `#4A2A20` and grey `#2B3133`. Cerulean `#073747` and Raspberry `#601C2C` are a 40% shade, since at 30% they'd match the page. Negotiation's tint is Midnight `#073B4C`.

## Components

- **The theme choice:** in the user menu, under a "Theme" label in Slate, in the labels' size, three items: Light with a sun icon, Dark with a moon icon and System with a monitor icon. The icons are in Slate, and the chosen one has a check mark on its right. Choosing one changes the mode at once and leaves the menu open, so the change can be seen.

## Layout

- The **theme choice** is in the user menu, under the initials at the right of the top bar (`docs/specs/sign-in.md`). The top bar is on every page once signed in, including Page not found, so the choice is too. The sidebar holds only the wordmark and the five sections.

## Keyboard and accessibility

- **Theme choice:** reached with Up and Down in the user menu. Enter or Space chooses one, and a screen reader announces the three as a group of choices, such as "System, checked".

## Testing hooks

- The choice is saved in local storage under `accountable-mode`. Only the lines in `index.html` and `src/lib/colorMode.ts` know that name.
- The browser saves the theme choice for each address separately, so the tests' copy of the app on port 5273 keeps its own choice and never changes the app on 5173. Each end-to-end test starts with nothing saved, so in light mode.
- The tests of System set Chrome's own light or dark setting, through Playwright's color scheme, and change it while the page is open. Chrome reports the change at its next frame, so the tests wait for the page to follow it rather than reading it once.
