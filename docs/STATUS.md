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
- `npm test` runs the frontend, backend and end-to-end tests, and fails if any test fails. It uses its own database and ports (8100 and 5273), so it works while the app is open.
- `npm run seed` replaces all the data with fresh sample data, dated from today. If the app is open, refresh the page to see it. `npm run seed -- --large` adds 500 of each kind of record, for checking speed.

The data lives in `data/accountable.db`, which git ignores. Deleting that file also resets to the sample data on the next start. Set `DATABASE_URL` to use another database.

## Done so far

- Plan: `docs/intent.md` agreed, after an interview on scope, users, constraints and success criteria.
- Design: `docs/spec.md` agreed, with mockup C, Focus, chosen from the three in `docs/mockups/`.
- Build: `docs/plan.md` written, then built in its eight phases. `npm test` passes, and also from a fresh copy of the repo with nothing installed: 68 Vitest tests, 153 pytest tests and 71 end-to-end tests in Chrome.
  1. The one command: `npm run dev` sets everything up on the first run, and `npm test` runs all three suites and reports each.
  2. The backend: SQLAlchemy Core tables, the Alembic migration `0001_initial` (run on startup), the rules R1 to R11 in `backend/services/`, and every endpoint in the spec's API table.
  3. The sample data in `backend/seed.py`, loaded when the database is new, and `npm run seed`, which works while the app is running.
  4. The app shell, the theme (`frontend/src/styles/theme.css`, the only file with color values, which a test checks), the bundled fonts and the shared components.
  5. Organizations, Contacts and Deals: lists, forms, delete questions, record pages and timelines.
  6. The pipeline: dragging with dnd-kit and moving with the keyboard, both through `board.ts`, with every figure changing as soon as a card drops.
  7. The dashboard, with every figure checked against one worked out from the deals and their histories.
  8. End-to-end tests of the whole app: keyboard only, axe on every page and dialog, reset, and speed with 500 of each record. The dashboard and pipeline were compared with mockup C at 1440 by 900, and checked at 1280 by 720.
- Compared again with mockup C in Chrome at 1440 by 900, measuring every panel, card and text style on the Dashboard and Pipeline. Fixed what differed: all 11 sample follow-ups now show before the list scrolls (it showed 8 and a half), text keeps the mockup's 1.45 line height at every size, the counts in panel subtitles and the sidebar use the mockup's font and weight, and the charts got the mockup's baseline, label sizes, point markers and spacing. The panels and cards now match the mockup's positions and sizes to the pixel, except the second row of dashboard panels, which is 5px shorter because the mockup's inline SVG charts leave a gap under them.
- Next: the Test stage, with someone using it end to end in Chrome (success criterion 9).

## Success criteria and their tests

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
- Two small files beyond the plan's list: `backend/errors.py` (the `NotFound` and `Invalid` errors the services raise) and `frontend/src/components/returnFocus.ts` (dialogs open from state, so it sends focus back to whatever opened them, or to the main area if that's gone).
- `db.migrate()` turns SQLite's foreign keys off while migrating, because a batch migration rebuilds a table by dropping the old one, and with them on that drop would cascade to activities and history.
- The migration's boolean default is `sa.false()` rather than the generated `sa.text('0')`, which Postgres would refuse.
- Timeline entries at the same moment put a status change above the stage change that caused it, then a stage change above an activity, then break ties by id.
- Chrome logs every 4xx and 5xx reply as a console error. The end-to-end tests fail on any console error, except where a test causes one on purpose (a 422 from bad fields, a 500 from a failed save) and says so. A record page stops its own query before deleting the record, so nothing asks for a record that's gone.
- Dragging with 545 deals on the board, measured in Chrome on an Apple Silicon Mac: in `npm run dev` most frames take 16.7ms and the 95th percentile is 33ms, with a few stalls of up to about 80ms when the card under the pointer changes; a production build is a steady 60fps. What's left is dnd-kit redrawing every sortable card, plus React's development-mode overhead. Rendering only the visible cards would remove it, but then Tab could no longer reach every card, so it isn't done.
- `npm test` fails on a test left with `.only` (Vitest's `allowOnly: false`, Playwright's `forbidOnly: true`), since otherwise it would quietly run just that test. `AGENTS.md` says to run it before calling work done.
- The speed tests time each screen opened from the sidebar and reloaded, not a brand-new browser fetching every file from the dev server for the first time, which takes about a second on its own. They don't record a Playwright trace, which nearly doubles a reload's time (about 930ms against 520ms for the Deals table with 545 rows).
- `Board.tsx` is imported with its extension, because on Mac and Windows `./Board` would find `board.ts` first.
- `theme.css` uses `@theme static`, because Tailwind 4 otherwise leaves out theme variables that no utility class uses, and the stage and status roles are used through `var(...)`.
