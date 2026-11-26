# Intent: dark mode

## Problem

Accountable only has a light mode, and some people prefer a dark screen.

## Proposed outcome

A dark mode with a toggle on every page, across every section. The toggle sits at the bottom of the sidebar, below the five sections, so it's in the same place on every page, including Page not found.

## Constraints

- Light mode stays the default, and the app remembers the choice.
- The choice is saved in the browser (localStorage), and the right mode is set before the page first draws, so it never flashes light first. R14 in spec.md changes to cover records only, not display settings like this one.
- Light mode looks exactly as it does today, apart from the toggle.
- Colors stay in one place, as tokens, with no scattered overrides.
- Text in dark mode meets the same contrast rules as spec.md.
- Charts, dialogs and messages follow the mode too.
- No new dependencies unless the plan makes the case for one.

## Not in this change

- Following the device's own dark mode setting.
- A layout for phones.

## Success criteria

1. npm run check passes.
2. A new end-to-end test proves that the toggle works and is remembered after a reload.
3. Screenshots of the dashboard and the pipeline in both modes are saved in docs/changes/dark-mode/.
4. Light-mode screenshots of every section, taken before and after the change, are compared pixel for pixel by a script. Only the toggle may differ. This is a one-off check whose result is reported, not a permanent test.
