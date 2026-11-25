# Plan: building the Accountable MVP

This plan builds what `docs/spec.md` describes, for the reasons in `docs/intent.md`. Read the spec first: this plan refers to its rules by number (R1 to R14) and its concerns by number, and doesn't repeat them. The stack is in `docs/TECH_STACK.md`.

Conventions for the build:

- Python packages are added with `uv add` (and `uv add --dev` for test tools), and Python commands run with `uv run`. Never `pip` or `python3`.
- Nothing outside the spec gets built: no global search, no extra filters, no dark mode.
- No emojis in code, output or logs.
- Each phase ends with `npm test` passing. That's a natural commit point, but the student makes the commits.
- `docs/STATUS.md` is updated at the end of each phase.

The structure is meant to carry the changes the course makes next: dark mode on Day 4, then Supabase, sign-in, "who added it" on each record and a Render deploy on Day 5. Five choices make those steps small, and none adds a layer of abstraction:

- **One database setting:** the database is named by `DATABASE_URL`, with SQLite as the default.
- **Migrations from the start:** Alembic creates and changes the tables, and runs on startup.
- **One transaction per request,** opened in the route, with every service function taking the connection as its first argument.
- **Feature folders in the frontend,** so a later module is one new folder.
- **Colors by role** in one theme file, so dark mode is a second set of values.

## Files that change

Everything here is new except `docs/STATUS.md` and `docs/spec.md`. `README.md` stays as it is. `.gitignore` already covers `node_modules/`, `.venv/`, `*.db` and the Playwright folders, so it doesn't change.

### The repo root

| File | What it's for |
|---|---|
| `package.json` | npm workspaces (`frontend`), the scripts `dev`, `test` and `seed`, and the dev dependencies `@playwright/test` and `@axe-core/playwright` |
| `package-lock.json` | Locks the npm packages |
| `pyproject.toml` | Python 3.12 (`requires-python = ">=3.12,<3.13"`), the backend dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `alembic`), the dev group (`pytest`, `httpx`), and the pytest settings (`testpaths = ["backend/tests"]`, plus `pythonpath = ["."]` so tests can import `backend` without installing it) |
| `uv.lock` | Locks the Python packages |
| `.python-version` | `3.12`, so uv picks or downloads the right Python |
| `alembic.ini` | For the Alembic command line only (`uv run alembic revision --autogenerate -m "..."`), pointing at `backend/migrations`. The app builds its own Alembic config in code, so it doesn't depend on the working folder. |

The root scripts:

- `"dev": "node scripts/dev.mjs"`
- `"test": "node scripts/test.mjs"`
- `"seed": "uv run python -m backend.seed"`

### `scripts/`

Plain Node with no dependencies, so they run before `npm install` has.

| File | What it's for |
|---|---|
| `scripts/setup.mjs` | Shared first-run setup. It checks for Node.js 24 or later and that `uv --version` runs, and if either is missing says how to get it. It runs `npm install` when `node_modules/` is missing or older than `package-lock.json`, then `uv sync`, which downloads Python 3.12 if needed. It prints one line before each slow step, such as "Installing packages (first run only)". |
| `scripts/dev.mjs` | Runs the setup, then checks ports 8000 and 5173 are free and says which one isn't. It starts the backend (`uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000`) and the frontend (`npm run dev --workspace frontend`), waits until both answer, then prints "Accountable is running at http://localhost:5173. Open it in Google Chrome." Ctrl+C stops both, including their child processes on Windows. |
| `scripts/test.mjs` | Runs the setup, then Vitest, pytest and Playwright one after another. It runs all three even if one fails, prints a summary line for each, and exits with 1 if any failed. |

On Windows, child processes start with `shell: true`, because `npm` and `uv` are `.cmd` files there, and they're stopped with `taskkill /pid <pid> /T /F`.

### `backend/`

A Python package at the repo root. `backend/main.py` has `create_app()` and a module-level `app = create_app()` for uvicorn. The tests call `create_app()` themselves, after setting their own `DATABASE_URL`.

| File | What it's for |
|---|---|
| `backend/__init__.py` | Marks the package |
| `backend/settings.py` | The one place that reads environment variables, each time it's asked, so tests can change them: `database_url()` (`DATABASE_URL`, by default `sqlite:///data/accountable.db`) and `fixed_today()` (`ACCOUNTABLE_TODAY`). Day 5's Supabase settings go here too. |
| `backend/clock.py` | `today()` and `now()` on the computer's local clock. If `ACCOUNTABLE_TODAY` is set, they read that date, at 12:00 noon for `now()`. Every other module asks this one for the date. |
| `backend/db.py` | Builds the engine from `settings.database_url()`, creating `data/` for the default SQLite file. For SQLite only, a connect event turns on `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`. `transaction(engine)` opens a connection with `engine.begin()`, so it commits on success and rolls back on an error. `migrate(engine)` runs Alembic's upgrade to the latest migration and says whether the database was new. |
| `backend/tables.py` | The six SQLAlchemy Core tables from the spec's data model, using SQLAlchemy's own column types. The foreign keys say what happens on delete: `SET NULL` for an organization, a deal's main contact and `won_deal_id`, and `CASCADE` for activities and history. It also has the indexes and a check that exactly one of an activity's `contact_id` and `deal_id` is set. Alembic compares its migrations with this. |
| `backend/migrations/env.py` | Alembic's environment. It takes the URL from `settings`, uses `tables.metadata` as the target, and sets `render_as_batch=True`, which SQLite needs for changing columns. |
| `backend/migrations/versions/0001_initial.py` | The first migration, made with `--autogenerate` and then read through. It creates the six tables and their indexes. |
| `backend/main.py` | Builds the FastAPI app and includes the routers. On startup it runs `migrate()`, and if the database was new, loads the sample data. It replaces FastAPI's validation errors with `{"errors": {"field": "message"}}`, using the spec's plain messages. |
| `backend/stages.py` | The six stages: key, name, order, usual probability, and whether they're open. `GET /api/stages` serves them, so the frontend never keeps its own copy. |
| `backend/schemas.py` | Pydantic models for every request and response, with the field rules from the data model and messages such as "Enter a name." |
| `backend/services/organizations.py` | Lists with counts, getting, adding, changing and deleting organizations |
| `backend/services/contacts.py` | The same for contacts, recording a status change whenever the status changes (R7) |
| `backend/services/deals.py` | The same for deals, plus `change_stage()`, which is the only place R3, R4 and R6 happen, and `move()` and the column positions for R5 |
| `backend/services/activities.py` | Logging, changing and deleting activities (R8), and marking follow-ups done |
| `backend/services/timeline.py` | The contact and deal timelines (R10), and the recent activity list |
| `backend/services/dashboard.py` | Every figure in the spec's "Dashboard figures" table, the funnel from concern 7, and the follow-up list (R9) |
| `backend/routers/*.py` | One router each for stages, organizations, contacts, deals, activities and the dashboard. The endpoints are the spec's API table. Each route checks its input, then runs one service call inside `with transaction(engine) as conn:`, so the commit happens before it replies. |
| `backend/seed.py` | The sample data generator. `build(today)` returns the rows, and `load(conn, today)` clears every table and inserts them, inside the caller's transaction, so it works while the app is running. Run as `python -m backend.seed`, it migrates the database if needed, loads the data and prints what it created. `--today YYYY-MM-DD` sets the date and `--large` adds 500 of each kind of record for speed checks. |
| `backend/tests/conftest.py` | Each test gets a temporary SQLite file as its `DATABASE_URL`, migrated once per session and copied for each test so it stays quick. Also `ACCOUNTABLE_TODAY=2026-06-15`, a test client from `create_app()`, and small factories for making records. |
| `backend/tests/test_*.py` | The backend tests listed under Proof |

Every service function takes the connection first, such as `change_stage(conn, deal_id, stage, ...)`. Routers, the seed and the tests all call them the same way. On Day 5 the signed-in user becomes one more argument where a service needs it.

### `frontend/`

Shared pieces live in `components/` and `lib/`. Everything else lives in a folder for its feature. A feature may use another feature's form or hooks directly, such as the pipeline using the deal form, and anything two features both need moves to `components/` or `lib/`. There are no index files that only re-export.

| File | What it's for |
|---|---|
| `frontend/package.json` | React, React Router, TanStack Query, TanStack Table, dnd-kit, Recharts, Radix UI, cmdk, React Hook Form, Zod, Tailwind CSS, lucide-react, sonner, date-fns and the three `@fontsource` packages. Dev: Vite, TypeScript, Vitest, React Testing Library and jsdom. Scripts `dev` and `test` (`vitest run`). |
| `frontend/vite.config.ts` | Port 5173 with `strictPort`, or the port in `ACCOUNTABLE_WEB_PORT`. It forwards `/api` to `http://127.0.0.1:` plus `ACCOUNTABLE_API_PORT`, 8000 by default, using `127.0.0.1` rather than `localhost`. Vitest uses jsdom and runs with `TZ=America/Los_Angeles`. |
| `frontend/tsconfig.json`, `frontend/index.html` | The usual Vite setup |
| `frontend/src/main.tsx` | Fonts, the query client and the router |
| `frontend/src/app/` | `App.tsx` (the routes from the spec), `AppShell.tsx` (the floating sidebar with counts) and `NotFound.tsx` |
| `frontend/src/styles/theme.css` | Tailwind, and the color roles from the spec, each mapped to its brand color, plus radii and shadows. This is the only file with color values in it. |
| `frontend/src/lib/api.ts` | `fetch` for the API. It turns a 422 into field errors and a network failure into the "Can't reach Accountable's server" state. It also holds the query client's rule that every successful change refetches all queries, which is cheap with hundreds of records and always right. |
| `frontend/src/lib/format.ts` | Money (`$12,500`, `$1.2M`), dates (`Nov 22, 2026`, with the year left out on cards when it's this year), timeline times ("Today, 2:30 PM") and due labels ("3 days overdue") |
| `frontend/src/lib/stages.ts` | `useStages()`, which loads the stages from `/api/stages`, and each stage's color role. Names, order and probabilities come only from the server. |
| `frontend/src/lib/types.ts` | Types for the API's JSON |
| `frontend/src/components/` | `PageHeader`, `Panel`, `Button`, `Badge` (stage, status, Late, due), `DataTable`, `FormDialog`, `ConfirmDelete`, the form fields (text, select, date, and a searchable `Picker` built on cmdk), `EmptyState`, `ErrorState` and `ChartTable` (a table of a chart's figures for screen readers) |
| `frontend/src/features/organizations/` | `OrganizationsPage`, `OrganizationPage`, `OrganizationForm` with its Zod schema, and `queries.ts` |
| `frontend/src/features/contacts/` | `ContactsPage` with the status filter, `ContactPage`, `ContactForm` and `queries.ts` |
| `frontend/src/features/deals/` | `DealsPage`, `DealPage`, `DealForm` and `queries.ts` |
| `frontend/src/features/activities/` | `Timeline`, `LogActivityForm`, `ActivityDialog` and `queries.ts` |
| `frontend/src/features/pipeline/` | `PipelinePage`, `Board` (dnd-kit for the mouse), `Column`, `DealCard`, `useKeyboardMove` (keyboard moves, with announcements in a live region), and `board.ts` |
| `frontend/src/features/dashboard/` | `DashboardPage`, `HeroRevenue` (main figure and line chart), `StatTile`, `WonBars`, `Funnel`, `PipelineByStage`, `FollowUps`, `RecentActivity`, `chartData.ts` (turns the dashboard response into each chart's data) and `queries.ts` |
| `frontend/src/**/*.test.ts(x)` | The frontend tests listed under Proof, next to the code they test |

`board.ts` holds the pipeline's pure functions. `moveDeal(deals, stages, id, toStage, index, today)` returns the deals after a move, applying R3's probability and close date rules and R5's positions, as the server will. It also works out the board and column totals (R1, R2).

Charts take their colors as `var(--color-...)` strings, so they follow the same roles as everything else.

### `e2e/`

| File | What it's for |
|---|---|
| `e2e/playwright.config.ts` | Uses `channel: 'chrome'` and one worker, since the tests share one database. Its `webServer` starts the backend on port 8100 and the frontend on port 5273 with `reuseExistingServer: false`, so a running copy of the app is never used. It sets `DATABASE_URL=sqlite:///e2e/.data/test.db` and `ACCOUNTABLE_TODAY=2026-06-15`. |
| `e2e/fixtures.ts` | Before each test, it reloads the sample data (`uv run python -m backend.seed --today 2026-06-15`, with the test database) and sets Chrome's clock to 2026-06-15 11:00 with `page.clock.setFixedTime`. During each test it collects console errors and fails the test if there are any. It also has helpers for axe checks and for dragging. |
| `e2e/*.spec.ts` | The end-to-end tests listed under Proof |

Chrome's fixed clock is an hour before the backend's noon, so a time the browser fills in as "now" is never later than the backend's now (R8).

### `docs/`

| File | What changes |
|---|---|
| `docs/STATUS.md` | How to install Node.js and uv on Mac, Linux and Windows, the three commands, where the data lives, and what's done |
| `docs/spec.md` | Already updated with this plan, so the two agree. The changes are listed below. |

The spec changes:

- Keyboard moves on the pipeline are our own code, sharing `moveDeal` with dragging, not dnd-kit's keyboard sensor (see Risks).
- `ACCOUNTABLE_TODAY` also fixes the backend's time, at noon.
- The database is named by `DATABASE_URL`, uses SQLAlchemy's own column types, and has Alembic migrations.
- Colors are used by role.

## Order of work

Eight phases, each building on the last. Each one lists what it delivers and the check that says it's done. Write the tests for a phase in that phase, and run them as you go.

### Phase 1: The skeleton and the one command

1. Write the root `package.json`. Then run `uv init --bare`, `uv add fastapi uvicorn sqlalchemy pydantic alembic` and `uv add --dev pytest httpx`, and add `.python-version` and the pytest settings.
2. Create the Vite React TypeScript app in `frontend/`, add it as a workspace, and set up the `src/app`, `src/components`, `src/lib` and `src/features` folders. Install the frontend libraries from the spec's Libraries table now, so `package-lock.json` settles early.
3. Write `scripts/setup.mjs`, `scripts/dev.mjs` and `scripts/test.mjs`.
4. Write `settings.py`, and a backend with `create_app()` and only `GET /api/stages`. Add a frontend page that fetches and lists the stages through the `/api` proxy.
5. Add one placeholder test for each runner (Vitest, pytest and Playwright, the last opening the page), so `npm test` exercises the whole chain.
6. Write the first version of `docs/STATUS.md`: the installs and the three commands.

**Done when:**

- In a fresh clone with `node_modules/` and `.venv/` deleted, `npm run dev` installs everything, prints the address, and the page in Chrome lists the six stages.
- Ctrl+C stops both servers, with nothing left on ports 8000 and 5173.
- `npm test` runs all three suites and passes, and exits with 1 when a test is made to fail on purpose.

### Phase 2: Database, rules and API

1. Write `clock.py`, `db.py`, `tables.py` and `stages.py`.
2. Run `uv run alembic init backend/migrations`, then edit `env.py` as described under Files that change. Generate `0001_initial.py` with `--autogenerate`, read it through, and run `migrate()` on startup.
3. Write `schemas.py`.
4. Write the services in this order: organizations, contacts, deals (with `change_stage()` and `move()`), activities, timeline, dashboard. Each function takes `conn` first.
5. Add the routers for every endpoint in the spec's API table, each with its one `transaction()` block. Add the 422 error format and 404s.
6. Write the backend tests for R1 to R14, the migrations, the dashboard figures and the API, as listed under Proof.

**Done when:** the backend tests pass, the migration test finds no difference between the migrations and `tables.py`, and every rule from R1 to R14 that the server enforces has at least one test that names it.

### Phase 3: Sample data and reset

1. Write `backend/seed.py` with hand-written lists of organizations, people, industries and kinds of work, and a fixed random seed (`random.Random(2026)`). Every date is counted in days from `today`.
2. Build exactly these numbers, which the tests check:
   - 15 organizations, two of them with no deals
   - 40 contacts: 16 leads, 10 qualified and 14 customers, two with no organization
   - 45 deals: 5 New, 5 Qualified, 5 Proposal, 4 Negotiation, 20 Won and 6 Lost
     - values from $5,000 to $150,000 in steps of $500
     - 3 open deals late
     - wins in at least 10 of the last 12 months
     - the losses from at least three different stages
   - stage history for every deal that fits its stage and dates, and a status change for each customer on their first win
   - 100 activities over the past 12 months, more of them recent
     - 20 with follow-ups: 5 overdue, 6 due in the next 7 days, 3 later and 6 done
3. Load the sample data on startup when `migrate()` reports a new database, and add `npm run seed`.

**Done when:**

- The seed tests pass.
- A fresh start shows the sample data through the API.
- `npm run seed` resets it while the app is running.

### Phase 4: App shell, brand and shared components

1. Write `theme.css`: the color roles from the spec, each mapped to its brand color, plus the radii and shadows. Import the three fonts from `@fontsource`.
2. Build `AppShell` to match mockup C: the floating sidebar, the tagline, record counts and the active pill. Add the routes, with an empty page in each feature folder, and `NotFound`.
3. Write `format.ts`, `stages.ts` and `api.ts`, and the shared components: `Panel`, `Button`, `Badge`, `DataTable`, `FormDialog`, `ConfirmDelete`, the fields, `Picker`, `EmptyState`, `ErrorState` and the message toasts. Components use only role names for color.
4. Add the skip link, the focus ring and the page landmarks.

**Done when:**

- The frontend tests for this phase pass, including the check that no color values sit outside `theme.css`.
- Every section opens from the sidebar with no console errors.
- The fonts load with the network turned off.

### Phase 5: Organizations, Contacts and Deals

1. Build the three list pages, with the spec's columns, search, sorting (pipeline order for stage), row counts, and Add, Edit and Delete. Build the contacts status filter, kept in the address.
2. Build the three forms, including the deal form's rules: the stage fills in its probability from `useStages()`, Won or Lost fills in today and locks the probability, the main contact fills in the organization, and only changed fields are sent.
3. Build the delete questions with their counts, and going back to the list after deleting from a record page (R12).
4. Build the three record pages, with their linked panels and "Add contact" and "Add deal" buttons that fill in the link.
5. Build `Timeline`, `LogActivityForm` and `ActivityDialog` in `features/activities/`, with the follow-up Done checkbox. The contact and deal pages both use them.
6. Write the frontend tests and the end-to-end tests for records, contacts and activities.

**Done when:** those tests pass, and adding, finding, sorting, editing and deleting each kind of record works by hand in Chrome.

### Phase 6: Pipeline

1. Build `board.ts` with its tests first, since the board's instant figures depend on it.
2. Build `Board`, `Column` and `DealCard` to match mockup C:
   - the white heading panels, with the expected-share bar on open columns
   - contact initials on the cards, and compact Won and Lost cards
   - Won and Lost columns 0.8 wide and open columns 1.2
3. Wire up dnd-kit for the mouse, with `@dnd-kit/sortable` in each column and each column also accepting drops, so a card can be dropped below the last one or into an empty column.
4. Moves are optimistic. A move updates the cached deals with `moveDeal` at once, calls `POST /api/deals/{id}/move`, puts the cards back with a message if that fails, and then refetches.
5. Build `useKeyboardMove`:
   - Space picks a card up.
   - Up and Down move it within its column.
   - Left and Right move it to the next column at the same position, or the last one.
   - Space drops it, and Escape puts it back.
   - Each step is announced.
   - Focus stays on the card after each move, by finding it again by its id.
6. Add the column Add deal buttons, which use the deal form from `features/deals/`, and the header figures.
7. Write the end-to-end tests for the pipeline.

**Done when:** those tests pass, and with 500 deals (`npm run seed -- --large`) a dragged card still follows the pointer smoothly.

### Phase 7: Dashboard

1. Write `chartData.ts` and its tests.
2. Build the dashboard to match mockup C:
   - `HeroRevenue`, with the main figure, the last 12 months, and a Recharts area chart with a flat wash
   - the three `StatTile`s
   - `WonBars`, a Recharts bar chart with the count on each bar
   - `Funnel`, Recharts' `FunnelChart` with `lastShapeType="rectangle"` and the labels in HTML beside it
   - `PipelineByStage`, two stacked Recharts bars per stage: the expected part solid and the rest in the tint
   - `FollowUps`, with due badges and Done
   - `RecentActivity`, grouped under Today, Yesterday and Earlier
3. Give each chart a one-line summary and a `ChartTable`.
4. Link the tiles and the pipeline visual to the Pipeline.
5. Write the end-to-end tests for the dashboard.

**Done when:** those tests pass, and each figure matches one worked out by hand from the sample data at the fixed date.

### Phase 8: The whole app, end to end

1. Write the end-to-end tests that cover the whole app: keyboard only, axe, reset, and speed with 500 of each record.
2. Compare each screen with `docs/mockups/c-focus.png`. Take Playwright screenshots of the dashboard and pipeline at 1440 by 900, and fix differences in layout, spacing and color.
3. Go through success criteria 1 to 9 in `docs/intent.md` one by one, and note any that a test doesn't cover.
4. Finish `docs/STATUS.md`.

**Done when:**

- `npm test` passes from a fresh clone.
- The screenshots match the mockup's look.
- `docs/STATUS.md` says how to run everything and what's done.

The hands-on check by a person (success criterion 9) comes after this, at the Test stage.

## Risks

The riskiest step is the pipeline (phase 6). Drag, keyboard, instant figures and saved positions all meet there, and so do R3 and R5. That's why `board.ts` and its tests come first in that phase.

1. **The one command on Windows.** Starting `npm` and `uv` and stopping a process tree work differently on Windows, and this plan is built on a Mac.
   - **Mitigation:** keep the scripts small, use `shell: true` and `taskkill /T` on Windows, and print the exact failing command when something goes wrong.
   - **Unverified until it runs on Windows.** Day 4's CI is the first chance to check it on another system.
2. **The first run needs the internet and takes time** (concern 2). uv may download Python, and npm downloads several hundred packages.
   - **Mitigation:** a line before each slow step, and a clear message if a download fails.
3. **Ports already in use.** Port 8000 in particular is often taken by other dev servers.
   - **Mitigation:** `dev.mjs` checks both ports first and names the busy one.
   - The tests use 8100 and 5273, so they run even while the app is open.
4. **SQLite ignores foreign keys unless asked**, and then the delete rules silently do nothing.
   - **Mitigation:** the connect event turns them on for every SQLite connection, and a test checks the pragma on a fresh connection, along with the R11 tests.
5. **Migrations drifting from `tables.py`.** Someone changes a table and forgets the migration, or the reverse.
   - **Mitigation:** a test runs every migration on an empty database and uses Alembic's `compare_metadata` to check the result matches `tables.py` exactly.
   - SQLite can't alter most columns in place, so `env.py` turns on Alembic's batch mode, which rebuilds the table instead.
6. **Stage rules drifting apart.** Dragging, the keyboard, the form and adding a deal all change stages.
   - **Mitigation:** on the server, everything goes through `change_stage()`. In the browser, only `board.ts` applies the rules, and only for the instant view before the server answers.
   - The end-to-end tests check the result after a reload, which is the server's view.
7. **Keyboard moves between columns.** dnd-kit's keyboard sensor moves by screen coordinates, and moving between columns needs a custom coordinate function of about 100 lines that's hard to test.
   - **Choice:** handle the keyboard ourselves with `useKeyboardMove`, using the same `moveDeal` the tests cover. dnd-kit still handles the mouse.
   - **Remaining risk:** losing focus when a card moves to another column and React remounts it. That's covered by finding the card again by its id, and tested.
8. **Dates off by one day.** `new Date('2026-06-15')` is midnight UTC, which is the day before in the Americas.
   - **Mitigation:** dates are only parsed with date-fns `parseISO`, which reads a date with no time as local, and never with `new Date(string)`.
   - Vitest runs in `America/Los_Angeles` to catch any slip, and the server sends dates as plain `YYYY-MM-DD`.
9. **Tests that pass or fail by chance.**
   - **Mitigation:** the backend's date and Chrome's clock are both fixed, the sample data is reloaded before each end-to-end test, and there's one worker.
   - Records made in the same test get the same time, so lists sort by time and then by id, newest first.
10. **Charts that don't match the mockup.** Recharts' funnel may not give the 2px gaps or the labels where mockup C has them.
    - **Mitigation:** try `FunnelChart` first. If it can't match, draw the five trapezoids as plain SVG, as the mockup does, which is about 30 lines.
    - Charts aren't rendered in Vitest, since jsdom can't measure them. `chartData.ts` is tested there, and the charts themselves in Chrome.
11. **Colors creeping back into components.** Each one-off hex value makes dark mode harder.
    - **Mitigation:** a Vitest check fails if any file other than `theme.css` contains a hex color or a brand color name.
    - If a chart can't take a `var(--color-...)` value somewhere, it reads the role's value with `getComputedStyle` instead.
12. **Speed with hundreds of records.** The Won column can get long.
    - **Mitigation:** cards are memoized and use dnd-kit's vertical list strategy.
    - The speed test seeds 500 of each kind of record. If it's slow, the first step is to memoize column totals. Then, if still needed, render only the visible cards in Won and Lost.
13. **Two sets of field checks** in Zod and Pydantic giving different answers.
    - **Mitigation:** the server's 422 messages are the ones shown. Zod only catches empty required fields and bad numbers before sending.
14. **Contrast slipping as components are built.**
    - **Mitigation:** the theme has only the spec's roles, and the end-to-end tests run axe's contrast and label checks on every page.
15. **Usage limits stopping the build.** It's a long build.
    - **Mitigation:** each phase leaves `npm test` passing, so the build can carry on from the last finished phase.

**Decided against:**

- **`concurrently` or `npm-run-all` for `npm run dev`:** they can't run before `npm install`, and the first run must work without it.
- **A FastAPI dependency with `yield` for the transaction:** when its cleanup runs, before or after the response is sent, has changed between FastAPI versions. A commit could then land after the browser has already refetched. A `with transaction()` block in each route always commits before it replies.
- **A test-only reset endpoint:** the tests reload data with the seed command instead, so the app has no test-only code.
- **Running the end-to-end tests against a built app:** the Vite dev server is closer to how the app is used and starts faster. Day 5's `npm start` brings the built app, served by FastAPI. Every API path already starts with `/api`, so the frontend can sit alongside it.
- **Totals and positions only from the server:** the board must change as soon as a card drops (intent), so the browser works them out first and the server's answer replaces them.
- **Server-side paging and search:** all rows load at once, which is fine for hundreds of records, as the intent's open questions allow.
- **Layers that cost now and are easy to add when needed:** an ORM or repository layer on top of Core, generic CRUD base classes, a dependency-injection container, API versioning, an API client generated from the OpenAPI schema, a monorepo tool, a state library beyond TanStack Query, and an empty package waiting for ERP. Moving files into an ERP area later is a mechanical change.

## Proof

`npm test` runs everything below and fails if any test fails. The backend's tests run at a fixed today of 2026-06-15. In the end-to-end tests, every test also fails on any console error, and starts from freshly loaded sample data.

### Backend unit tests (pytest, `backend/tests/`)

**`test_settings.py`**

- `DATABASE_URL` and `ACCOUNTABLE_TODAY` are read when asked, with SQLite in `data/` as the default.
- `ACCOUNTABLE_TODAY` fixes `today()`, and `now()` at noon. Without it, both use the local clock.

**`test_db.py`**

- Foreign keys and WAL are on for a new SQLite connection.
- `transaction()` commits on success and rolls back everything on an error. A move to Won that fails partway leaves the deal, its history and the contact unchanged.
- A new database is migrated and gets the sample data.
- A migrated database isn't reseeded, even with no rows in it.
- Data is still there after building a second app on the same file, which stands in for a restart.

**`test_migrations.py`**

- Running every migration on an empty database gives exactly the tables, columns, foreign keys and indexes in `tables.py`, with no difference from `compare_metadata`.
- Running them again does nothing.

**`test_deals_rules.py`**

- R1: late only for open deals with a close date before today, not on the close date itself.
- R2: expected revenue, and totals over open deals only.
- R3, a new stage:
  - records a stage change from and to the right stages
  - takes the usual probability unless the same save sets one
  - Won and Lost set today as the close date unless the same save sets one
  - Won makes the main contact a customer, with a status change linked to the deal
  - Won with a contact who is already a customer adds no status change
  - Won with no main contact changes no contact
  - moving out of Won keeps the close date and the contact's status (concern 8)
- R4:
  - a hand-set probability survives an edit that doesn't change the stage
  - a probability other than 100 for Won, or other than 0 for Lost, returns 422
- R5:
  - a new deal goes to the top of its column
  - moving within a column changes only positions, with no stage change recorded
  - moving between columns renumbers both columns from 0 with no gaps
  - an index past the end is clamped
  - a stage changed through `PATCH` puts the deal at the top of its new column
- R6: adding records "added at" its stage, and adding at Won or Lost applies R3.

**`test_contacts_rules.py`**

- R7: status starts as lead, and every change made by hand, in any direction, records a status change.
- An organization is optional.
- A badly formed email returns 422 with "Enter an email address like name@example.com."

**`test_activities.py`**

- R8: exactly one of contact or deal, or 422.
- R8: a time later than now returns 422, and a time a few seconds ago doesn't.
- Type, description and follow-up rules, and marking done and not done.

**`test_followups.py`**

- R9: overdue the day before today and not on today.
- R9: due today and up to 7 days ahead are included, and 8 days ahead isn't.
- R9: done follow-ups are left out.
- R9: the order is overdue oldest first, then the rest soonest first.

**`test_timeline.py`**

- R10: a deal's timeline has its activities and stage changes.
- R10: a contact's timeline adds the activities and stage changes of deals where they're the main contact, labelled with the deal, plus their status changes.
- Concern 10: changing a deal's main contact moves those entries to the new contact.
- Everything is newest first, with ties broken by id.
- Stage and status entries can't be edited or deleted.

**`test_deletes.py`**

- R11, an organization: its contacts and deals are kept with no organization.
- R11, a contact: their deals are kept with no main contact, and their activities and status changes are gone. Activities on their deals stay.
- R11, a deal: its activities and stage changes are gone, and a status change it caused stays, with `won_deal_id` empty.
- R11, an activity: only that one is gone.
- The list counts the delete questions use are correct.

**`test_dashboard.py`**

- Revenue and deals won this month and last month.
- The 12 months include this one, with $0 and 0 for months with nothing won.
- The open pipeline, its count and its expected revenue.
- Count, value and expected revenue for each open stage.
- The funnel (concern 7): a deal that skipped a stage still counts in it, a lost deal counts up to the stage it was lost from, a won deal counts in every stage, and the lost total.
- Recent activity: the 10 newest of all three kinds, in order.

**`test_api.py`**

- Every endpoint in the spec's API table answers with the documented shape.
- `GET /api/stages` gives the six stages in order with the spec's probabilities.
- 404 for a missing record.
- 422 for bad fields, as `{"errors": {"field": "message"}}`, with the spec's wording.
- `https://` is added to a website with no scheme.
- `PATCH` with only some fields changes only those.

**`test_seed.py`**

- The exact counts from phase 3, by kind, stage and status.
- Values are in range and in steps of $500.
- 3 late deals, and the follow-up spread (5, 6, 3 and 6).
- Wins in at least 10 of the last 12 months.
- Every main contact of a won deal is a customer.
- Stage histories fit each deal's stage.
- Two loads with the same today give the same rows, and a later today moves every date by the same number of days.
- Loading clears the data that was there before.

**`test_speed.py`**

- With 500 of each kind of record, each list endpoint and the dashboard answer in under 300ms.

### Frontend unit tests (Vitest, next to the code)

**`lib/format.test.ts`**

- Money and short money (`$12,500`, `$1.2M`, `$48K`, `$0`).
- Date formats, the year left out when it's this year, and "Today" and "Yesterday" times.
- Due labels: "1 day overdue", "Due today", "Due tomorrow", "Due in 4 days".
- All of it runs in `America/Los_Angeles`, with no day shifted.

**`styles/theme.test.ts`**

- No source file other than `theme.css` contains a hex color or a brand color name.
- Every stage and status has its role and tint.

**`features/pipeline/board.test.ts`**

- `moveDeal` within a column, between columns, to an empty column and past the end.
- Moving to Won or Lost sets today and 100% or 0%, and moving to an open stage sets its usual probability, all taken from the stages passed in.
- Positions are renumbered.
- Board and column totals for open deals only, and late flags after a move.

**`components/DataTable.test.tsx`**

- The search matches any column, ignoring case.
- A heading toggles the sort between ascending and descending, with `aria-sort`.
- The stage column sorts in pipeline order.
- The row count text, such as "12 of 36 deals".
- The message when nothing matches.

**`features/deals/DealForm.test.tsx`**

- Changing the stage fills in its usual probability.
- Won or Lost fills in today and locks the probability.
- Choosing a main contact fills in an empty organization and leaves a chosen one alone.
- Only changed fields are sent.
- The server's 422 messages appear under their fields.

**`components/ConfirmDelete.test.tsx`**

- The delete questions read as in the spec, and a sentence is left out when its count is zero.
- Cancel has focus.

**`features/pipeline/useKeyboardMove.test.tsx`**

- Space, the four arrows and Space again give the right moves.
- Escape puts the card back.
- Each step is announced in the spec's words.
- The card keeps focus after moving to another column.

**`features/activities/Timeline.test.tsx`**

- Each kind of entry shows its text.
- "On ..." labels for deal entries on a contact's timeline.
- Follow-up labels ("Follow up Nov 25", "Overdue since Nov 18", "Done").
- Edit and Delete only on activities.

**`features/contacts/ContactsPage.test.tsx`**

- The status filter and its counts.
- The filter reads from and writes to `?status=`, and works together with the search.

**`features/dashboard/chartData.test.ts`**

- The data for each chart is built from the dashboard response.
- Recent activity is grouped under Today, Yesterday and Earlier.

### End-to-end tests (Playwright with Chrome, `e2e/`)

Each one names the success criterion from `docs/intent.md` it proves.

**`first-run.spec.ts`**

- Criterion 1: the app opens on the dashboard.
- Every section shows sample data.
- The fonts are the brand's, loaded from the app with no request to Google.

**`organizations.spec.ts`**

- Criterion 2: add an organization, find it by searching, sort by each column, edit it and reload to see the change.
- Delete one that has contacts and deals: the question gives the counts, and afterwards they're still there with no organization.

**`contacts.spec.ts`**

- Criteria 2 and 3: add a lead, a qualified contact and a customer.
- The status filter, surviving a reload.
- A contact's page shows their organization and deals.
- Deleting a contact keeps their deals with no main contact.

**`deals.spec.ts`**

- Criteria 2 and 4: add, edit and delete a deal.
- Late deals show the Late badge in the table and on their page.
- Sorting by stage follows pipeline order.
- The deal form's probability and close date filling in.

**`pipeline-drag.spec.ts`**

- Criterion 4: drag a card to another column. Its stage and probability change in the deals table, and the board and column figures change before the server has answered (checked by holding the request back).
- Drag a card within its column, reload, and it's still where it was dropped.
- Drop a card below the last one, and into an empty column.
- Add a deal from a column's button, and it starts at that stage, at the top.
- A failed save puts the card back with a message (checked by failing the request).

**`pipeline-keyboard.spec.ts`**

- Criterion 8: move a card to another column and position with the keyboard only, reload, and it's still there.
- Escape cancels a move.
- The announcements appear in the live region.

**`activities.spec.ts`**

- Criterion 5: log a note on a contact, and a call with a follow-up on a deal.
- Both timelines are newest first.
- The deal's call is on its main contact's timeline too.
- A stage change adds "Moved from ... to ..." to the deal's timeline and to recent activity.
- The follow-up shows on the dashboard, and marking it done removes it.
- Editing and deleting an activity.

**`won.spec.ts`**

- Criteria 4, 5 and 6: drag a deal to Won.
- Its close date becomes today.
- Its main contact becomes a customer, with "Became a customer when ... was won" on their timeline.
- The dashboard's revenue and deals won this month go up by the deal's value and by one.
- Moving it back to Negotiation keeps the contact a customer.

**`dashboard.spec.ts`**

- Criterion 6: the tiles, the summary of each chart and the funnel figures match values worked out from the sample data at 2026-06-15.
- Overdue follow-ups come first.
- Each chart has its table for screen readers.

**`reset.spec.ts`**

- Criterion 2: change some records, run `npm run seed` against the test database, reload, and the sample data is back.

**`keyboard.spec.ts`**

- Criterion 8: with the keyboard only, use the skip link, move through the sidebar, add an organization in its dialog, sort a table and log an activity.
- Focus goes back to the button that opened a dialog.

**`accessibility.spec.ts`**

- Criteria 7 and 8: axe finds no contrast or label problems on every page and in every form dialog.

**`speed.spec.ts`**

- The intent's speed constraint: with `--large` sample data, each screen shows its data within a second of opening, and typing in a table's search keeps up.

The parts of the intent no automated test can prove get checked by a person at the Test stage: success criterion 7's "sharp, modern and professional" look, the comparison with mockup C, and criterion 9's hands-on run through every section.
