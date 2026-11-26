# Plan: dark mode

This plan builds the dark mode that `docs/spec.md` now describes, for the reasons in `intent.md` next to it. It refers to the spec's concerns by number, mainly concern 13 (dark mode colors) and concern 14 (the choice is kept in the browser), and doesn't repeat them.

Conventions for the build:

- No new dependencies. The switch is Radix UI's Switch, from the `radix-ui` package the app already has.
- Colors live only in `frontend/src/styles/theme.css`. Components never use Tailwind's `dark:` variant or check the mode to pick a color. A role's dark value is the only thing that changes.
- Every role keeps its light value exactly. New roles start with the value their components use today, so light mode doesn't change.
- Each phase ends with `npm run check` passing and the light-mode comparison (phase 0) still matching. That's a natural commit point, but the student makes the commits.
- `docs/STATUS.md` is updated at the end of each phase.

## Files that change

Nothing changes in the backend, the root `package.json`, the lock files or `.gitignore`, which already ignores `tmp/`.

### `frontend/`

| File | What changes |
|---|---|
| `index.html` | A few lines of classic inline script in `<head>`, before anything else loads. They read the saved choice, and if it's `dark`, set `data-theme="dark"` and `color-scheme: dark` on `<html>`. Anything else, or storage that throws, leaves light mode (concern 14). |
| `src/styles/theme.css` | Three new roles in `@theme`, each with today's light value: `raised` (white), `on-primary` (Midnight) and `logo` (Midnight). A dark block, `:root[data-theme='dark']` in `@layer base`, that sets every color role to its dark value from the spec, plus the dark shadows. |
| `src/styles/theme.test.ts` | The dark block's roles match the light ones, contrast holds in both modes, no `dark:` classes, and the favicon test reads the light block on purpose (see Proof). |
| `src/lib/colorMode.ts` (new) | `currentMode()` reads the mode from `<html>`, which the inline script already set. `setMode(mode)` applies it the same way as the inline script, then saves it, and ignores a storage error, so the switch still works for the session. It's the only code besides the inline script that knows the storage key, `accountable-mode`. |
| `src/lib/colorMode.test.ts` (new) | Tests `colorMode.ts`, and runs `index.html`'s inline script in jsdom (see Proof). |
| `src/app/DarkModeSwitch.tsx` (new) | A moon icon, the visible label "Dark mode" and a Radix Switch, 36 by 20px with a 16px knob. The track is `bg-field` when off and `bg-primary` when on, and the knob is `bg-panel`. The initial state comes from `currentMode()`, and a change calls `setMode()`. |
| `src/app/DarkModeSwitch.test.tsx` (new) | Its unit tests. |
| `src/app/AppShell.tsx` | The switch is pinned to the bottom of the sidebar (`mt-auto`), after the five sections. The logo circle uses `bg-logo` instead of `bg-ink`. The skip link uses `bg-raised`. |
| `src/app/AppShell.test.tsx` | The switch is in the sidebar, after the sections. |
| `src/components/Button.tsx` | Primary buttons use `text-on-primary` instead of `text-ink`. The icon button tooltip uses `bg-raised`. |
| `src/components/fields.tsx` | The select list and the picker's popover use `bg-raised`. |
| `src/components/Toaster.tsx` | Messages use `bg-raised`, and the comment no longer says "white". |
| `src/features/activities/ActivityDialog.tsx` | `DoneCheckbox`'s tick uses `text-on-primary`. This covers the timelines, the dashboard and the dialog, which all use it. |
| `src/features/activities/Timeline.tsx` | The activity menu uses `bg-raised`. |
| `src/features/dashboard/ChartTooltip.tsx` | Chart tooltips use `bg-raised`. |

Dialogs (`FormDialog.tsx`, `ConfirmDelete.tsx`), the charts and every badge already use roles that get a dark value, so they don't change. The favicon doesn't change.

### `e2e/`

| File | What changes |
|---|---|
| `dark-mode.spec.ts` (new) | The end-to-end tests for the switch and for what follows the mode (see Proof). |
| `accessibility.spec.ts` | Every page and dialog check runs in both modes. |
| `fixtures.ts` | `turnOnDarkMode(page)`: opens the dashboard, flips the switch and waits for `<html>` to be dark, so a test can then go to its page in dark mode through the real UI. |
| `screenshots.config.ts` (new) | Runs only `screenshots.ts`, with the main config's servers, data and clock. It stores the light-mode pictures in the git-ignored `tmp/light-baseline/`. It's separate from `npm test`, so CI never runs it. |
| `screenshots.ts` (new) | Two groups: "light mode is unchanged" and "screenshots for the docs" (see Order of work, phases 0 and 4). |

### `docs/`

| File | What changes |
|---|---|
| `changes/dark-mode/plan.md` | This plan |
| `changes/dark-mode/dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png`, `pipeline-dark.png` (new) | Success criterion 3, made by `e2e/screenshots.ts` |
| `STATUS.md` | Progress, how to run the screenshots, and the result of the light-mode comparison |
| `spec.md` | Already updated. It changes again only if a dark value is changed during phase 3, so the spec and `theme.css` always agree. |

## Order of work

### Phase 0: Record light mode as it is today

This comes before any other change, because the "before" pictures have to be of today's app.

1. Write `e2e/screenshots.config.ts` and the "light mode is unchanged" group in `e2e/screenshots.ts`. It uses `toHaveScreenshot` with `threshold: 0` and `maxDiffPixels: 0`, `fullPage: true`, and a style that hides `aside :has(> [role=switch])`. That matches nothing today and hides the switch later, so the switch is the one difference allowed. Its pictures:
   - every section: the dashboard, organizations, an organization, contacts, a contact, deals, a deal, the pipeline, and Page not found
   - the deal form open, the Stage select open, an activity's menu open, a picker open, a chart tooltip on hover, and the message after a save

   These cover every component that phase 1 touches.
2. Record the baseline with `npx playwright test -c e2e/screenshots.config.ts --grep "light mode is unchanged" --update-snapshots`.
3. Run it again twice without `--update-snapshots`. Both runs must match, which proves the comparison is stable before it's relied on. If one doesn't match, find the cause, such as a chart still animating or counts still loading, and fix the wait in `screenshots.ts`. Then record again.

### Phase 1: Theme tokens

1. Add `raised`, `on-primary` and `logo` to `@theme` with their light values.
2. Point the components at them: `on-primary` for primary buttons and the checkbox tick, `raised` for menus, the select list, the picker, tooltips, messages and the skip link, and `logo` for the logo circle. See the file table.
3. Add the dark block to `theme.css` with every value from the spec's "Colors in dark mode" table and the dark badge tints. Negotiation becomes Sea Mist with a Midnight tint, and the dark shadows and the overlay are set too.
4. Check how Tailwind builds `shadow-panel` and `shadow-lift` (risk 1), and fix it if they don't read the variables.
5. Extend `theme.test.ts`.
6. Run the light comparison. It must match, since nothing sets dark mode yet.

### Phase 2: Remember the choice, and the switch

1. Add the inline script to `index.html`, and `colorMode.ts` with its tests, including the test that runs the inline script.
2. Add `DarkModeSwitch` with its tests, and place it in `AppShell`.
3. Run the light comparison again. It must match, with the switch hidden.

### Phase 3: Dark mode in the browser

1. Write `e2e/dark-mode.spec.ts` and add dark mode to `accessibility.spec.ts`. Add `turnOnDarkMode` to the fixtures.
2. Go through every screen in dark mode at 1440 by 900 and at 1280 by 720, looking for what the tests can't judge:
   - panels against the page, and menus, lists and messages against panels
   - the dialog over its overlay, the date picker, and scrollbars
   - focus rings, hover on rows and buttons, and the sidebar's current section
   - the drop space while dragging a card, especially in New and Negotiation
   - every chart, including the funnel's Negotiation step and the tinted part of each stage column
   - a reload in dark mode, watching for a flash of light
3. Fix anything found in `theme.css` only, and update the spec's value to match. If a fix needs more than a new value, stop and ask.

### Phase 4: Proof and docs

1. Add the "screenshots for the docs" group to `e2e/screenshots.ts`. It takes full-page shots of the dashboard and the pipeline, with the switch showing, in light mode and then after `turnOnDarkMode`. It writes them to `docs/changes/dark-mode/`.
2. Run the light comparison one last time, and record the result in `docs/STATUS.md`.
3. Run `npm run check` and fix every failure.
4. Update `docs/STATUS.md`, and check that `docs/spec.md` matches what was built.

## Risks

1. **Tailwind may copy shadow values into the classes.** Tailwind v4 builds `shadow-*` classes by parsing the theme value, so `shadow-panel` may hold the light shadow itself rather than `var(--shadow-panel)`. If so, giving the shadows new values in the dark block does nothing. Phase 1 checks the CSS Chrome receives. If it's copied, the fix is a shadow color role, `--color-shadow` (light `rgb(7 59 76 / 0.06)`, dark `rgb(0 0 0 / 0.4)`), used inside both shadows, with a second role for the deeper one if the alphas need it. That keeps light mode's shadow the same and still lives only in `theme.css`.
2. **A flash before the CSS arrives.** In `npm run dev`, Vite adds the CSS from JavaScript, so for a moment the page has no styles at all. If the inline script set only `data-theme`, Chrome would draw its default white canvas first. Setting `color-scheme: dark` in the same script makes Chrome's default canvas dark, with no color value in `index.html`. The end-to-end test checks the mode is set before the app draws, and phase 3 checks a reload by eye.
3. **Two places know the storage key.** The inline script reads it, and `colorMode.ts` writes it. A unit test saves with `setMode('dark')` and then runs the inline script, so a mismatch fails.
4. **The inline script isn't covered by TypeScript or ESLint.** It stays under ten lines and is unit-tested by running it in jsdom with every case from concern 14.
5. **Light mode could change by accident.** A wrong value for a new role, or a class swapped on the wrong element, would show only in light-mode pictures. The phase 0 comparison catches it, and it runs at the end of every phase. It depends on the same Chrome, fonts and computer before and after, so it runs locally, never on CI. It also covers only the states it photographs, which is why phase 0 includes the dialog, menus, picker, tooltip and message.
6. **Black on black.** Anything that floats over a panel and still uses `bg-panel` will have no visible edge in dark mode, and axe doesn't check edges. The file table lists every floating layer found by searching for `shadow-lift`. Phase 3's walk through the screens is the check for any that were missed.
7. **Hover on dark fills.** Buttons darken on hover with `brightness-95`. On Midnight secondary buttons over black panels, that's hard to see. The spec doesn't set hover colors, so this is judged in phase 3. If it needs fixing, the fix goes in `theme.css` as a role, not as `dark:` classes on the button.
8. **Libraries with their own styles.** Sonner is used unstyled, and Recharts, Radix and cmdk take all their colors from the app's roles, so all four follow the mode. Chrome's date and time inputs follow `color-scheme`. The end-to-end tests check messages, tooltips, lists and `color-scheme` directly.
9. **The test run gets longer.** Running the accessibility checks in both modes roughly doubles that file's time, since each test reseeds. If CI gets close to its timeout, the dark run of a page can share one reseed with the light run, but no check is dropped.
10. **The dark values haven't been seen yet.** They come from a contrast script, not a mockup. Phase 3 is where they're judged, and any change keeps the spec, `theme.css` and the contrast unit test in step.

## Proof

How each success criterion in `intent.md` is shown:

1. `npm run check` passes, with every test below.
2. `e2e/dark-mode.spec.ts`: "the switch turns dark mode on and off, and is remembered after a reload".
3. The four PNGs in `docs/changes/dark-mode/`, made by `e2e/screenshots.ts`.
4. The light comparison in `e2e/screenshots.ts` matches pixel for pixel, with only the switch hidden. It runs at the end of every phase, and the final result is in `docs/STATUS.md`.

### Frontend unit tests (Vitest)

**`src/styles/theme.test.ts`**, added to the tests already there:

- The dark block sets every color role the light block has, and no role the light block lacks, so a mistyped name can't slip through.
- Text contrast in both modes, worked out from the values in `theme.css`:
  - ink, ink muted, link, primary text and alert text are at least 4.5:1 on the panel, the page and the raised surface
  - ink is at least 4.5:1 on every tint and on secondary
  - on-primary is at least 4.5:1 on primary, and on-fill on alert fill
- The field outline and the focus ring are at least 3:1 against the panel, the page and the raised surface, in both modes.
- In dark mode, Negotiation is Sea Mist and its tint is Midnight (concern 13).
- No source file uses a `dark:` class, and apart from tests, only `theme.css` and `colorMode.ts` mention `data-theme`.
- The existing favicon test reads ink and primary from the light block explicitly, not from whichever comes first.

**`src/lib/colorMode.test.ts`**

- `currentMode()` is light when `<html>` has no mode, and dark when it's marked dark.
- `setMode('dark')` marks `<html>` dark, sets `color-scheme: dark` and saves `dark`. `setMode('light')` undoes both and saves `light`.
- When storage throws, `setMode` still changes the mode.
- `index.html`'s inline script, run in jsdom:
  - it gives dark mode when `dark` is saved
  - it gives light mode when `light` is saved, when nothing is saved, when the value is anything else such as `purple`, and when reading storage throws
- After `setMode('dark')`, running the inline script on a fresh page gives dark mode, so the two agree on the key.

**`src/app/DarkModeSwitch.test.tsx`**

- It's a switch named "Dark mode", off when the page is light.
- It starts on when the page is already dark.
- Clicking it turns dark mode on and saves it, and clicking again turns it off.
- Space flips it when it has focus.

**`src/app/AppShell.test.tsx`**

- The sidebar has the Dark mode switch, after the five sections.

### End-to-end tests (Playwright with Chrome)

**`e2e/dark-mode.spec.ts`**

- Light is the default: with nothing saved, the page is light and the switch is off.
- The switch turns dark mode on and off, and is remembered after a reload (criterion 2):
  - flipping it makes the page background `#04232E` and the panels black, and the switch reads as on
  - after a reload the page is still dark and the switch is still on
  - flipping it back and reloading gives light mode
- A saved dark mode is set before the app first draws. An init script watches `#root` and records `<html>`'s mode when the app adds its first element, and it's already dark.
- The switch is on every section and on Page not found.
- The switch works from the keyboard. Tab reaches it after the five sections, Space flips it, and its role and name are "switch" and "Dark mode".
- Charts, dialogs and messages follow the mode. In dark mode:
  - a chart gridline uses the dark divider
  - the funnel's Negotiation step is Sea Mist
  - a chart tooltip, the Stage select's list and the message after saving a deal are Midnight
  - the deal dialog is black
  - `<html>`'s `color-scheme` is `dark`, so the date and time pickers follow
- Every color check above compares against the spec's values.

**`e2e/accessibility.spec.ts`**

- Every page and dialog check that's there today also runs in dark mode, after `turnOnDarkMode`. Axe's WCAG AA rules, including color contrast, must find nothing. This covers every section, the organization, contact, deal and activity forms, a form with its errors showing, a delete question and an open picker.

**The tests already there** all still pass unchanged, in light mode. This shows the switch and the new roles haven't changed how the app behaves.
