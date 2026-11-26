# Status

## Before you start

Install Node.js 24 or later (26 recommended), uv and Google Chrome. Nothing else is needed: the first run sets up the rest.

| | Node.js | uv |
|---|---|---|
| Mac | Download the LTS installer from [nodejs.org](https://nodejs.org), or `brew install node` | `curl -LsSf https://astral.sh/uv/install.sh \| sh`, or `brew install uv` |
| Linux | The LTS from [nodejs.org/en/download](https://nodejs.org/en/download), or your package manager | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Windows | Download the LTS installer from [nodejs.org](https://nodejs.org) | In PowerShell: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` |

Open a new terminal after installing, so it finds both.

## Commands

Run these in the repo's folder.

- `npm run dev` starts Accountable and prints the address to open in Chrome: http://localhost:5173. The first run installs the npm and Python packages (and Python 3.12 if needed), which needs the internet and takes a few minutes. Ctrl+C stops it.
- `npm test` runs the frontend, backend and end-to-end tests, and fails if any test fails or unit test coverage is under 80%. It uses its own database and ports (8100 and 5273), so it works while the app is open.
- `npm run check` runs gitleaks, Prettier, ESLint, ruff format, ruff check, tsc, ty and `npm test`, and fails if any of them fails. `npm run check:quick` is the same without the end-to-end tests. It needs gitleaks, installed once with `brew install gitleaks` on a Mac or `winget install -e --id Gitleaks.Gitleaks` on Windows.
- `npm run format` fixes the formatting, with Prettier for the frontend and ruff format for the backend.
- `npm run seed` replaces all the data with fresh sample data, dated from today. If the app is open, refresh the page to see it. `npm run seed -- --large` adds 500 of each kind of record, for checking speed.

The data lives in `data/accountable.db`, which git ignores. Deleting that file also resets to the sample data on the next start. Set `DATABASE_URL` to use another database.

## Done so far

- Plan: `docs/changes/mvp/intent.md` agreed, after an interview on scope, users, constraints and success criteria.
- Design: `docs/spec.md` agreed, with mockup C, Focus, chosen from the three in `docs/mockups/`.
- Build: `docs/changes/mvp/plan.md` written, then built in its eight phases. `npm test` passes, and also from a fresh copy of the repo with nothing installed: 68 Vitest tests, 153 pytest tests and 71 end-to-end tests in Chrome.
  1. The one command: `npm run dev` sets everything up on the first run, and `npm test` runs all three suites and reports each.
  2. The backend: SQLAlchemy Core tables, the Alembic migration `0001_initial` (run on startup), the rules R1 to R11 in `backend/services/`, and every endpoint in the spec's API table.
  3. The sample data in `backend/seed.py`, loaded when the database is new, and `npm run seed`, which works while the app is running.
  4. The app shell, the theme (`frontend/src/styles/theme.css`, the only file in `src/` with color values, which a test checks), the bundled fonts and the shared components.
  5. Organizations, Contacts and Deals: lists, forms, delete questions, record pages and timelines.
  6. The pipeline: dragging with dnd-kit and moving with the keyboard, both through `board.ts`, with every figure changing as soon as a card drops.
  7. The dashboard, with every figure checked against one worked out from the deals and their histories.
  8. End-to-end tests of the whole app: keyboard only, axe on every page and dialog, reset, and speed with 500 of each record. The dashboard and pipeline were compared with mockup C at 1440 by 900, and checked at 1280 by 720.
- Compared again with mockup C in Chrome at 1440 by 900, measuring every panel, card and text style on the Dashboard and Pipeline. Fixed what differed: all 11 sample follow-ups now show before the list scrolls (it showed 8 and a half), text keeps the mockup's 1.45 line height at every size, the counts in panel subtitles and the sidebar use the mockup's font and weight, and the charts got the mockup's baseline, label sizes, point markers and spacing. The panels and cards now match the mockup's positions and sizes to the pixel, except the second row of dashboard panels, which is 5px shorter because the mockup's inline SVG charts leave a gap under them.
- Next: the Test stage, with someone using it end to end in Chrome (success criterion 9).

## Review findings (Nov 24, 2026)

The `mvp` branch was reviewed against `docs/REVIEW.md`, with passes for bugs, security and the spec and plan. Everything found is fixed. Each line says what was wrong and what changed. The tests added for 1 to 4, 7 to 9, 18 and 19 were each run against the code from before the fix, and fail there. After the fixes `npm test` passes: 78 Vitest tests, 169 pytest tests and 74 end-to-end tests in Chrome.

Important:

1. A card dropped in the gap between two cards went to the bottom of its column, against R5. Now the card beside the gap, on the dragged card's side, takes the drop, so it lands between the two (`Board.tsx`). `pipeline-drag.spec.ts` drops into a gap moving up and moving down.
2. A second card move while the board was refetching replaced the board with "Can't reach Accountable's server". `cancelQueries` used `revert: false`, and TanStack Query counts a refetch cancelled that way as a failed one. It now uses the default, which puts back the data the refetch started from (`deals/queries.ts`). `pipeline-drag.spec.ts` holds every refetch back and moves a second card.
3. The deal form could save a different probability or close date than it showed, when one was typed back to the deal's own value after a stage change. With a new stage it now always sends both (`DealForm.tsx`, `DealForm.test.tsx`).
4. Select options, the activity menu's items and the picker's current option had no focus ring, only a 1.1:1 tint. They now show the 2px Cerulean ring (`fields.tsx`, `Timeline.tsx`), which `keyboard.spec.ts` checks.
5. Closing the terminal instead of pressing Ctrl+C left the backend and frontend running on Mac and Linux, so the next `npm run dev` stopped with "Port 8000 is already in use". `dev.mjs` now stops both on SIGHUP too. Checked by hand, with no automated test: after a SIGHUP both ports are free.

Bugs:

6. A failed move put back the whole board as it was before it, undoing any later move on screen. Now only its own card goes back (`putBack` in `board.ts`).
7. Empty values sorted first when a table was sorted descending. They're last both ways (`DataTable.tsx`).
8. The activity form's "When", left as it was, was the time the form appeared. It's now the time the activity is logged (`LogActivityForm.tsx`).
9. After a keyboard move, a later mouse drag pulled focus back to the card moved by keyboard. Using the mouse, or focusing something else, now stops that (`useKeyboardMove.ts`).
10. IDs too big for the database gave a 500. In the address they give a 404, like `abc`, and as a link a 422.
11. A website's 300-character limit was checked before `https://` was added. It's checked after.
12. `uv run alembic upgrade head` didn't turn SQLite's foreign keys off while migrating. It now does, with `db.migrate()`, through `db.foreign_keys_off()`.
13. On Windows, every run printed Node's DEP0190 warning. Commands now go to the shell as one line. This hasn't been tried on Windows yet.

Security:

14. The backend accepted any Host header, so a DNS-rebinding page could reach the API. It now answers only `localhost` and `127.0.0.1` (`TrustedHostMiddleware`).
15. Vite's defaults let a page on another localhost port use the API through the proxy and download `data/accountable.db` through `/@fs/`. It now allows no other origin (`server.cors: false`) and doesn't serve `*.db` files.
16. A website with any scheme, such as `javascript://`, was saved as it was. Only `http` and `https` are kept.

Spec and plan:

17. The concern 8 test couldn't tell a kept close date from one reset to today. It now wins the deal on another day.
18. The Delete buttons on record pages were secondary. They're Raspberry.
19. A dialog opened from an activity's menu sent focus to the main area. It goes back to the menu's button.
20. A record page that couldn't reach the server had no main heading. The message is now its heading.
21. A pipeline move showed no message. A saved one shows "Deal moved".
22. A timeline's "Overdue since" was worked out on the browser's clock. The backend now sends `follow_up_overdue` with each entry.
23. The migration tests ignored server defaults and CHECK constraints. They compare both now.
24. FastAPI's `/docs`, `/redoc` and `/openapi.json` are gone. `spec.md` now gives the length limits on website, industry, email, phone and job title, which the code already had.
25. The notes named two files beyond the plan's list, and there were more. They're all listed below now. The favicon can't use the theme, so a test checks that its two colors are the theme's ink and primary.
26. The spec contradicted itself in two places. `spec.md` now says that Open pipeline by stage shows each stage's count on hover and in the table for screen readers, as its Charts section and mockup C do. It also says the funnel counts a lost deal up to the furthest open stage it reached, and a deal moved back out of Won as open, as the code does.

## Harness (Nov 24, 2026)

- The docs are reorganized for future changes. `docs/spec.md` now describes the whole product as it stands, starting with the problem it solves, and doesn't rely on the intent. The MVP's intent and plan moved to `docs/changes/mvp/`. Each later change gets its own folder there, named after its branch. `AGENTS.md` says to read the spec first and only the current branch's folder. `docs/REVIEW.md` now flags code that the spec doesn't describe.
- Coding standards: `docs/STANDARDS.md` says how code is written here. `AGENTS.md` points to it, and `docs/REVIEW.md` has a pass that checks each change against it.
- `npm run check` (Nov 25, 2026), listed in `docs/TECH_STACK.md`, and run by `scripts/check.mjs` from the steps in `scripts/steps.mjs`. It passes: 374 Vitest tests (99.6% statements, 97.4% branches, 100% functions, 99.9% lines), 180 pytest tests (96%) and 74 end-to-end tests. Each check was also shown to fail on a planted problem. What the checks found was fixed without disabling any rule:
  - ESLint: React Hooks' ref rules (`returnFocus.ts` now notes the opener in a layout effect, `useKeyboardMove.ts` copies the latest values in one and calls `announce` from its key handler, `LogActivityForm.tsx` keeps its start values in state), `useWatch` instead of react-hook-form's `watch()`, `ContactDialog` and the pipeline's key handler split under complexity 15, and ARIA the a11y rules can see on the picker and the cards.
  - ty: routers declare `response_model` and return dicts; patch fields that may be left out but not null use Pydantic's `MISSING`, and a test checks null still gets a 422 for each; inserts use `.returning(...).scalar_one()`; the dashboard's tallies have TypedDicts.
  - Frontend unit coverage went from 54% to over 97% on every measure, with tests for every page and component. `test-utils.tsx` has shared record factories, table, details and chart helpers and `holdFetch`, and `lib/api.ts`'s `createQueryClient()` is used by the app and by tests that need its refetch rule. `test-setup.ts` dismisses toasts after each test, since sonner replays open ones to the next test's Toaster.
- gitleaks reads `.gitleaks.toml` by itself, which has no exceptions, so a committed `.env` fails the history scan. Only the files scan uses `.gitleaks-files.toml`, which allows the git-ignored `.env`.
- Found while writing the tests, not fixed yet: a successful pipeline move fetches the deals twice (the app's refetch after every change, then the move's own `onSettled`); a failed save's message differs from a successful one only by a red dot, which a screen reader doesn't hear; `DealForm`'s `onSaved` prop is never passed; `Panel` drops a subtitle given without a title.

## Success criteria and their tests

The MVP's success criteria, from `docs/changes/mvp/intent.md`.

| Criterion | Covered by | Not covered by a test |
|---|---|---|
| 1. One command, lands on the dashboard with sample data | `first-run.spec.ts`; the first run from nothing was checked by hand on a Mac | Windows and Linux, which haven't been tried yet |
| 2. Add, find, sort, edit, delete; kept after a refresh and a restart; reset | `organizations`, `contacts`, `deals` and `reset` specs; `test_db.py` for a restart | |
| 3. Status filter, linked records on each page | `contacts.spec.ts`, `organizations.spec.ts`, `ContactsPage.test.tsx` | |
| 4. Dragging changes stage and probability, places stay, figures change at once, late deals stand out | `pipeline-drag.spec.ts`, `won.spec.ts`, `deals.spec.ts`, `board.test.ts` | |
| 5. Timelines newest first, stage entries, deal activities on the main contact, follow-ups until done | `activities.spec.ts`, `test_timeline.py`, `test_followups.py` | |
| 6. Dashboard figures match, and follow a win and a new follow-up | `dashboard.spec.ts`, `won.spec.ts`, `activities.spec.ts`, `test_dashboard.py` | |
| 7. Sharp, modern, on brand; line chart, bar chart and pipeline visual | axe contrast checks, the theme test | Whether it looks sharp and professional: a person's judgment |
| 8. Everything by keyboard, AA contrast | `keyboard.spec.ts`, `pipeline-keyboard.spec.ts`, `accessibility.spec.ts` | Every single action by keyboard: the tests cover the main ones (dialogs, sorting, pickers, logging an activity, moving cards, delete questions) |
| 9. Someone has used it end to end in Chrome | | All of it, at the Test stage |

## Notes on the build

- The backend tests use `httpx2` rather than the plan's `httpx`, because Starlette 1.10's test client deprecates `httpx`.
- `package.json` denies `fsevents` its install script (it ships a prebuilt binary), which keeps npm 11's first install quiet.
- Files beyond the plan's list:
  - `backend/errors.py`: the `NotFound` and `Invalid` errors the services raise.
  - `backend/migrations/script.py.mako`: Alembic's template for new migrations.
  - `frontend/src/components/returnFocus.ts`: dialogs open from state, so it sends focus back to whatever opened them (the menu's button for a menu item), or to the main area if that's gone.
  - `frontend/src/components/Toaster.tsx` and `Details.tsx`: the messages, and the label and value pairs on record pages.
  - `frontend/src/lib/forms.ts`: sending only changed fields, and showing a 422's messages under their fields.
  - `frontend/src/features/activities/fields.tsx`, `contacts/ContactList.tsx`, `deals/DealList.tsx` and `dashboard/ChartTooltip.tsx`: pieces shared within or between those features.
  - `frontend/src/test-setup.ts` and `test-utils.tsx`: for the unit tests.
  - `frontend/src/components/ErrorState.test.tsx` and `features/activities/LogActivityForm.test.tsx`: tests added in the review.
  - `frontend/public/favicon.svg`: it can't use the theme's variables, so `theme.test.ts` checks that its two colors are the theme's.
- `db.migrate()` turns SQLite's foreign keys off while migrating, because a batch migration rebuilds a table by dropping the old one, and with them on that drop would cascade to activities and history.
- The migration's boolean default is `sa.false()` rather than the generated `sa.text('0')`, which Postgres would refuse.
- Timeline entries at the same moment put a status change above the stage change that caused it, then a stage change above an activity, then break ties by id.
- Chrome logs every 4xx and 5xx reply as a console error. The end-to-end tests fail on any console error, except where a test causes one on purpose (a 422 from bad fields, a 500 from a failed save) and says so. A record page stops its own query before deleting the record, so nothing asks for a record that's gone.
- Dragging with 545 deals on the board, measured in Chrome on an Apple Silicon Mac: in `npm run dev` most frames take 16.7ms and the 95th percentile is 33ms, with a few stalls of up to about 80ms when the card under the pointer changes; a production build is a steady 60fps. What's left is dnd-kit redrawing every sortable card, plus React's development-mode overhead. Rendering only the visible cards would remove it, but then Tab could no longer reach every card, so it isn't done.
- `npm test` fails on a test left with `.only` (Vitest's `allowOnly: false`, Playwright's `forbidOnly: true`), since otherwise it would quietly run just that test. `AGENTS.md` says to run it before calling work done.
- The speed tests time each screen opened from the sidebar and reloaded, not a brand-new browser fetching every file from the dev server for the first time, which takes about a second on its own. They don't record a Playwright trace, which nearly doubles a reload's time (about 930ms against 520ms for the Deals table with 545 rows).
- `Board.tsx` is imported with its extension, because on Mac and Windows `./Board` would find `board.ts` first.
- `theme.css` uses `@theme static`, because Tailwind 4 otherwise leaves out theme variables that no utility class uses, and the stage and status roles are used through `var(...)`.
