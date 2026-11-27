# Plan: sign-in, search and a user menu

This plan builds what `docs/spec.md` now describes for the reasons in `intent.md` next to it: signing in, a shared database on Supabase, who added each record, the team's time zone, search, the user menu and the deploy to Render. It refers to the spec's rules and concerns by number and doesn't repeat them. The detail is in `docs/specs/sign-in.md`, `search.md`, `platform.md`, `records.md`, `sample-data.md` and `light-and-dark.md`.

Conventions for the build:

- Three phases, in order: sign-in and the database, then search, then the user menu. Each phase ends with `npm run check` passing. That's a natural commit point, but the student makes the commits.
- The files are split into nine parts, A to I. No file is in two parts, so the parts in one phase can each be built by a different agent at the same time. A part with work in a later phase picks it up when that phase starts.
- Parts build against each other through the interfaces listed under Files that change, so one part can start before the part it uses is finished.
- Part I, the docs, belongs to whoever runs the build. Each part tells them what it built and, for each new test, what it broke to see the test fail (AGENTS.md). Part I writes that in `docs/STATUS.md` at the end of each phase.
- The person does a few things no agent can: setting up the Supabase project, filling in `.env`, which a hook keeps agents out of, and creating the Render service. Order of work says when.

New dependencies, and why each is needed:

| Dependency | Why |
|---|---|
| `@supabase/supabase-js` (frontend) | Signs in, keeps the session in the browser and renews the token before it runs out. Doing that by hand against Supabase's REST API, with the renewal timing and keeping tabs in step, is what `docs/TECH_STACK.md` says not to hand-roll. The spec already lists it. |
| `psycopg[binary]` (backend) | SQLAlchemy needs a driver to reach Postgres. The binary wheels need no libpq installed on Mac, Windows or Render. The spec already lists it. |
| `pyjwt[crypto]` (backend) | Checks Supabase's signed tokens against the project's public keys, and its `PyJWKClient` fetches and keeps those keys. It also signs the stand-in's tokens. The spec already lists it. |
| `tzdata` (backend) | Python's `zoneinfo` reads the operating system's time zone files, and Windows has none, so `Europe/London` would fail there. `tzdata` is the fallback the Python docs recommend. It's added to the spec's Libraries table in phase 1. |

## Files that change

Nothing changes in `.github/workflows/ci.yml`, `lefthook.yml`, `eslint.config.js`, `README.md`, `frontend/src/styles/theme.css`, the first migration (`0001_initial.py`) or `.claude/agents/reviewer.md`. CI still needs no secrets.

### Interfaces between parts

These are fixed before the parts start, so each can build against the others.

**The API** is as the spec describes. Where the spec leaves the JSON open, it's this:

- A person, in `created_by` and `updated_by`: `{ "id": "…", "name": "Dana Holt", "initials": "DH" }`, or `null` for a record from before sign-in.
- `GET /api/me`: `{ "id", "name", "email", "initials", "timezone" }`. `timezone` is `null` when `ACCOUNTABLE_TIMEZONE` isn't set, and the browser then uses its own zone, which for `npm run dev` is the same computer's.
- `POST /api/stand-in/sign-in` gives `{ "access_token": "…", "expires_at": 1764200000 }`. A stand-in token lasts 12 hours, with no renewal.
- A timeline entry for an activity, and each dashboard follow-up, has `created_by`. Stage and status changes have `created_by: null`.
- `GET /api/search?q=har`:
  ```json
  {
    "organizations": { "total": 2, "results": [{ "id": 1, "name": "Harbor Logistics", "industry": "Logistics" }] },
    "contacts": { "total": 1, "results": [{ "id": 4, "name": "…", "job_title": "…", "organization_name": "…" }] },
    "deals": { "total": 12, "results": [{ "id": 12, "name": "…", "organization_name": "…", "stage": "proposal", "value": 48000 }] }
  }
  ```
  The frontend builds each result's second line from these fields, leaving out any that are empty.
- Without a valid token: 401 with `{ "detail": "Sign in to carry on." }`.

**In the backend:**

- `backend/teammates.py` (part B): `TEAMMATES`, the four made-up teammates, each with a fixed `id`, `email` and `display_name`. The ids are UUIDs that start with zeros, such as `00000000-0000-4000-8000-000000000001`, so they can't be the same as a real Supabase user's. Part A's stand-in signs in only these.
- `backend/auth.py` (part A): `CurrentUser`, the dependency every route uses to get the person.
- `db.migrate(engine, on_new=None)` (part A) calls `on_new(conn)` inside the migration's own transaction when the database was new. `main.py` passes the sample data's `seed.load`, whose signature doesn't change (part B).

**In the frontend:**

- `src/lib/teamTime.ts` (part D): `setTeamZone(zone: string | null)`, `teamNow(): Date` and `teamTodayISO(): string`. Part C calls `setTeamZone` with `/api/me`'s zone before the app first draws.
- `src/auth/session.ts` (part C): `useSession()` and `signOut()`. `src/auth/useMe.ts` (part C): `useMe()`, the signed-in person. Part E's user menu uses all three.
- `src/lib/types.ts` (part D): the `Person` type, and `created_by` and `updated_by` on every record type.
- `src/app/ThemeChoice.tsx` (part F): `<ThemeChoice />`, the "Theme" label and the Light, Dark and System items, for inside a Radix `DropdownMenu.Content`. Part E's user menu puts it in place.

### Part A: Backend (phases 1 and 2)

| File | What changes |
|---|---|
| `pyproject.toml`, `uv.lock` | `psycopg[binary]`, `pyjwt[crypto]` and `tzdata`, added with `uv add` |
| `backend/settings.py` | Reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ACCOUNTABLE_STAND_IN`, `ACCOUNTABLE_TIMEZONE` and `RENDER_EXTERNAL_HOSTNAME`, each when it's asked for, as it does today |
| `backend/clock.py` | Today and now in the team's zone (concern 16), or the computer's own zone without one. Now stays a time with no zone attached, on the team's clock, since that's how times are stored. `ACCOUNTABLE_TODAY` still fixes today, with noon in the team's zone as now. Reading the real clock goes through one small function the tests can replace. |
| `backend/db.py` | A `postgresql://` URL, as Supabase gives it, uses psycopg (SQLAlchemy would otherwise pick psycopg2). `pool_pre_ping`, so a connection the pooler dropped while Render slept is replaced. `migrate()` takes `on_new` (see Interfaces), so on Postgres the first start's tables and sample data are saved together or not at all. |
| `backend/tables.py` | The users table. `created_by` and `updated_by` on organizations, contacts, deals and activities, nullable, linking to users, each with an index. |
| `backend/migrations/versions/0002_sign_in.py` (new) | Adds the users table and the four pairs of columns and their indexes. On Postgres, it turns on row-level security, with no policies, for every table, `alembic_version` included (concern 17). That's the one place besides SQLite's PRAGMAs that sends SQL as text, since SQLAlchemy has no construct for it. Table names come from the metadata, quoted by the dialect. |
| `backend/auth.py` (new) | The check that runs before every route (R15). It's a middleware, not a FastAPI dependency (risk 5), and refuses any `/api` address without a valid token, apart from the stand-in's sign-in when the stand-in is on. Supabase tokens are checked against the project's public keys, fetched once with `PyJWKClient`: the algorithm must be one the key allows, never HS256 or none, and the issuer, `aud` and `role` must be `authenticated`, the expiry checked, and the user not anonymous. The stand-in's tokens are HS256, signed with a key the backend makes when it starts and keeps only in memory. Only one of the two kinds is accepted, depending on how the backend started. Expiry uses the real clock, never `backend.clock` (risk 6). It also has `CurrentUser`. |
| `backend/services/users.py` (new) | Adds or updates the signed-in person in users (concern 19), writing only when their email or name changed, with an insert that does nothing if the row is already there, so two first requests at once can't clash (risk 8). How a person shows (R16): their name, with a display name of only spaces counting as none, cut to 120 characters, and their initials. |
| `backend/routers/me.py` (new) | `GET /api/me` and `POST /api/stand-in/sign-in`. The stand-in takes any teammate's email, in any case, with the password `accountable`, and refuses anything else with "Wrong email or password." |
| `backend/main.py` | Refuses to start, with a message, as concern 18 says, and for a time zone name that isn't one (concern 16). Adds `auth`'s middleware inside the host check. Allows `RENDER_EXTERNAL_HOSTNAME` as a host. Serves the built frontend from `frontend/dist` when it's there: its files as they are, and the app's page for any other address not under `/api`. An unknown `/api` address stays a JSON 404. Includes the `me` router, and in phase 2 the `search` router. |
| `backend/schemas.py` | `Person`. `created_by` and `updated_by` on the organization, contact and deal rows and on activities, and `created_by` on timeline entries and follow-ups. `Me`, the stand-in's sign-in body and its reply. In phase 2, the search reply. Bodies still refuse any field they don't take, so a body with `created_by` is a 422. |
| `backend/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py` | Each route that changes something takes `CurrentUser` and passes the person's id to the service |
| `backend/services/organizations.py`, `contacts.py`, `deals.py`, `activities.py` | They take `by`, the person's id, and set `created_by` and `updated_by` as R17 says. `change_stage()` and `set_status()` take `by` too, so a stage change made any way, and a won deal making its contact a customer, record whoever moved the deal. Moving within a column and the renumbering stay as they are, changing neither. The lists and pages join users for each person's name and initials. |
| `backend/services/timeline.py`, `dashboard.py` | Activities in timelines, recent activity and follow-ups show who logged them |
| `backend/services/search.py` (new, phase 2) | R18 and concern 21. It reads the id and name of every organization, contact and deal, then folds the case with Python's `str.lower()`, matches, sorts and counts in Python, so it works the same on SQLite and Postgres. Only the top 5 of each kind get their second line's fields from the database. The search is stripped of spaces first, so `%` and `_` match only themselves. |
| `backend/routers/search.py` (new, phase 2) | `GET /api/search`, with `q` up to 200 characters |
| `backend/tests/conftest.py` | Every test runs with the stand-in on, `ACCOUNTABLE_TIMEZONE` set to `America/Los_Angeles`, and `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `RENDER_EXTERNAL_HOSTNAME` removed, whatever the shell has. Any attempt to open a network connection fails the test, which proves no test reaches Supabase. `client` is signed in as Dana with a stand-in token, and `signed_out_client` isn't. The `Make` factories pass `by`. A key pair made once per session stands in for Supabase's keys (see Testing hooks in `sign-in.md`). |
| `backend/tests/test_settings.py`, `test_db.py`, `test_migrations.py`, `test_api.py`, `test_speed.py` | Changed and extended. See Proof. |
| `backend/tests/test_auth.py`, `test_sign_in_wall.py`, `test_people.py`, `test_me.py`, `test_who.py`, `test_startup.py`, `test_one_server.py`, `test_clock.py` (new) | See Proof |
| `backend/tests/test_search.py` (new, phase 2) | See Proof |

### Part B: Sample data (phase 1)

| File | What changes |
|---|---|
| `backend/teammates.py` (new) | Dana Holt, Joel Abara, Nora Lindqvist and Wes Moreno, with their fixed ids and `example.com` emails |
| `backend/seed.py` | Loads the four teammates into users. Gives every record and activity `created_by` and `updated_by` as `sample-data.md` says: Dana about 40%, Joel 25%, Nora 20% and Wes 15%, a deal's activities mostly by whoever added the deal, and about one in five last changed by someone else. With `--large`, the same spread. The same every time, from the seeded random generator it already uses. On Postgres, after loading, it sets each table's id sequence to the highest id, since the rows are inserted with their ids (risk 2). `main()` refuses a database that isn't SQLite, with a message (concern 15). |
| `backend/tests/test_seed.py` | See Proof |

### Part C: Frontend sign-in (phase 1)

| File | What changes |
|---|---|
| `frontend/package.json`, `package-lock.json` | `@supabase/supabase-js` |
| `frontend/vite.config.ts` | Two build-time constants, the Supabase URL and publishable key, taken from `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` only for `vite build`. The dev server and Vitest always get them empty, so they always use the stand-in (risk 13). |
| `frontend/src/auth/config.ts` (new) | Declares the two constants, and says which sign-in to use: Supabase when both are set, the stand-in otherwise |
| `frontend/src/auth/supabase.ts` (new) | Signs in, out and keeps the session with Supabase's client. Turns its errors into the sign-in screen's two messages. |
| `frontend/src/auth/standIn.ts` (new) | The same for the stand-in: posts to `/api/stand-in/sign-in`, keeps the token in local storage and drops it on sign-out. It never checks the expiry itself, and leaves that to the backend's 401 (risk 6). |
| `frontend/src/auth/session.ts` (new) | One session for the app, from whichever of the two is in use: checking, signed out (with the reason, if it ended) or signed in. `signOut()`, and ending the session on a 401, both clear the query cache, so nothing from the session stays in memory. |
| `frontend/src/auth/useMe.ts` (new) | `GET /api/me`, and the `Me` type |
| `frontend/src/auth/SessionGate.tsx` (new) | While checking, only the page's background. Signed out, the sign-in screen. Signed in, it waits for `/api/me`, calls `setTeamZone`, then shows the app at the address that was opened. |
| `frontend/src/auth/SignInScreen.tsx` (new) | The sign-in screen as `sign-in.md` describes it, with the stand-in's small print when the stand-in is in use, and "Your session has ended. Sign in again to carry on." when it ended |
| `frontend/src/auth/*.test.ts(x)` (new) | See Proof |
| `frontend/src/lib/api.ts`, `api.test.ts` | Each request sends `Authorization: Bearer …` with the session's token. A 401 ends the session. `api.ts` takes the token and the 401 handler from `session.ts` through a small setter, so the two files don't import each other. |
| `frontend/src/main.tsx` | Wraps the router in `SessionGate` |

### Part D: Frontend people and time zone (phase 1)

| File | What changes |
|---|---|
| `frontend/src/lib/teamTime.ts`, `teamTime.test.ts` (new) | The team's zone, and `teamNow()`, a `Date` whose local fields read the team's clock, worked out with `Intl.DateTimeFormat` and no new dependency. Without a zone, the browser's own. Times from the API need no change, since they're already on the team's clock and are read and shown in the same local zone (risk 9). |
| `frontend/src/lib/format.ts`, `format.test.ts` | Every `now` default is `teamNow()`, and `todayISO()` is the team's today. The comment at the top says so. |
| `frontend/src/lib/types.ts` | `Person`, and `created_by` and `updated_by` on every record type, timeline entry and follow-up. Its comment says times are on the team's clock. |
| `frontend/src/test-utils.tsx` | The row factories get `created_by` and `updated_by`, and there's a `person()` factory |
| `frontend/src/components/AddedBy.tsx`, `AddedBy.test.tsx` (new) | "Added by Dana Holt on Nov 12, 2026" and "Last changed by Joel Abara on Nov 20, 2026" (R17), the second left out until the record has been changed, and nothing for a record from before sign-in |
| `frontend/src/features/organizations/OrganizationPage.tsx`, `contacts/ContactPage.tsx`, `deals/DealPage.tsx`, and their tests | `AddedBy` at the end of the details |
| `frontend/src/features/activities/Timeline.tsx`, `Timeline.test.tsx` | "Today, 2:30 PM, by Dana Holt" for activities, nothing for stage and status changes. `teamNow()` in place of `new Date()`. |
| `frontend/src/features/dashboard/FollowUps.tsx`, `RecentActivity.tsx`, and their tests | Who logged each activity, and `teamNow()` |
| `frontend/src/features/activities/fields.tsx`, `pipeline/DealCard.tsx`, `pipeline/Board.tsx`, `deals/DealForm.tsx`, `deals/DealList.tsx`, `deals/queries.ts`, and their tests | `teamNow()` and `teamTodayISO()` in place of the browser's clock, for late cards, the forms' defaults and timeline labels |

### Part E: Frontend top bar, search and user menu (phases 2 and 3)

| File | What changes |
|---|---|
| `frontend/src/app/TopBar.tsx`, `TopBar.test.tsx` (new, phase 2) | The top bar from `look.md`, a labelled search area with the search box on the left. In phase 3, the user menu on the right. |
| `frontend/src/app/AppShell.tsx`, `AppShell.test.tsx` | Phase 2: the top bar above each page, 24px over the page header. Phase 3: the Dark mode switch comes out, so the sidebar holds only the wordmark and the five sections. |
| `frontend/src/features/search/SearchBox.tsx`, `SearchBox.test.tsx` (new, phase 2) | The search box, its results list and its keyboard use, as `search.md` says, with cmdk, which is told not to filter or sort, since the server already has (risk 11). `/` focuses it unless focus is in a field. The number of results is announced. |
| `frontend/src/features/search/queries.ts`, `types.ts` (new, phase 2) | `useSearch(q)` with TanStack Query, keeping the last results showing while the next ones load. A late reply for an older search can't replace a newer one, since each search has its own key. The reply's type. |
| `frontend/src/features/search/highlight.ts`, `highlight.test.ts` (new, phase 2) | Splits a name around the matching part, for the semibold. Where the browser's and Python's case folding disagree, the name shows without it (risk 12). |
| `frontend/src/app/UserMenu.tsx`, `UserMenu.test.tsx` (new, phase 3) | The initials button and the user menu from `sign-in.md`, with Radix's DropdownMenu: the name and email, `<ThemeChoice />` and Sign out, which calls `signOut()` |

### Part F: Frontend theme choice (phase 3)

| File | What changes |
|---|---|
| `frontend/index.html` | The inline script also takes `system`, following the device's setting through `matchMedia`. It keeps the choice on `<html>`, and listens for the device's setting to change, applying it while the choice is System. Living in the inline script, that covers the sign-in screen too, and works when the browser won't save (concern 14). |
| `frontend/src/lib/colorMode.ts`, `colorMode.test.ts` | The choice is light, dark or system. `currentChoice()` and `setChoice()` replace `currentMode()` and `setMode()`, and apply System the same way as the inline script. Still the only code besides the inline script that knows the storage key. |
| `frontend/src/app/ThemeChoice.tsx`, `ThemeChoice.test.tsx` (new) | The "Theme" label in Slate, and Light, Dark and System as a radio group with the sun, moon and monitor icons and a check mark on the chosen one. Choosing one changes the mode at once and leaves the menu open. |
| `frontend/src/app/DarkModeSwitch.tsx`, `DarkModeSwitch.test.tsx` | Deleted, at the same time as part E takes the switch out of `AppShell.tsx` |

### Part G: End-to-end tests (phases 1, 2 and 3)

| File | What changes |
|---|---|
| `e2e/playwright.config.ts` | The backend gets `ACCOUNTABLE_STAND_IN=1` and `ACCOUNTABLE_TIMEZONE=America/Los_Angeles`, and both servers have `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` removed even if the shell has them. A setup project signs in once through the sign-in screen and saves the session to `e2e/.auth/dana.json`, which the tests start with. |
| `e2e/sign-in.setup.ts` (new) | Signs in as Dana through the sign-in screen |
| `e2e/fixtures.ts` | Any request to a host other than 127.0.0.1 fails the test, which proves the app never reaches Supabase. `signIn(page, email)` for tests that sign in themselves, and `SIGNED_OUT` for tests that start signed out. In phase 3, `turnOnDarkMode` chooses Dark in the user menu. |
| `e2e/screenshots.config.ts` | Uses the sign-in setup too, so the dark mode change's screenshots still run |
| `.gitignore` | `e2e/.auth/` |
| `e2e/sign-in.spec.ts`, `people.spec.ts`, `time-zone.spec.ts` (new, phase 1) | See Proof |
| `e2e/search.spec.ts` (new, phase 2), `speed.spec.ts`, `keyboard.spec.ts`, `accessibility.spec.ts` | See Proof |
| `e2e/user-menu.spec.ts` (new, phase 3), `dark-mode.spec.ts`, renamed `theme.spec.ts` | See Proof |

### Part H: Running it and Render (phase 1)

| File | What changes |
|---|---|
| `scripts/env.mjs` (new) | Reads `.env` with Node's own `util.parseEnv`, with no new dependency. A setting already set in the shell wins. |
| `scripts/dev.mjs` | Takes only `ACCOUNTABLE_TIMEZONE` from `.env`, sets `ACCOUNTABLE_STAND_IN=1`, and removes `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from both servers' settings (concern 15). It counts the backend as started when it answers at all, since `/api/stages` now answers 401 (risk 7). |
| `scripts/start.mjs` (new) | `npm start`: reads `.env`, stops with a message naming any of the four settings that's missing, makes sure the stand-in is off, runs the first-run setup, builds the frontend with the Supabase settings, then runs one uvicorn on 127.0.0.1:8000 and prints the address once it answers. Ctrl+C stops it. |
| `package.json` | `"start": "node scripts/start.mjs"` |
| `render.yaml` (new) | One free web service in the region nearest the Supabase project. The build installs the npm and Python packages and builds the frontend. The start runs uvicorn on `0.0.0.0:$PORT` with proxy headers, since Render's proxy handles HTTPS. Sets `ACCOUNTABLE_TIMEZONE` and `PYTHON_VERSION` (a 3.12 release), and lists `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` with `sync: false`, so Render asks for them and they're never in the file. No health check path, so Render's own check doesn't trip the host check. |

### Part I: Docs (every phase)

| File | What changes |
|---|---|
| `docs/changes/multi-user/plan.md` | This plan |
| `docs/STATUS.md` | Progress after each phase, what each new test broke to fail, how to run `npm start` and what goes in `.env`, setting up Supabase and Render, the slowest unit tests' times, and the results of the criterion 1 and 6 checks |
| `docs/TECH_STACK.md` | The app runs on Render against Supabase, as well as locally on SQLite |
| `docs/specs/sign-in.md` | The stand-in token's 12 hours. `/api/me`'s `timezone` is empty without `ACCOUNTABLE_TIMEZONE`. The Supabase project needs asymmetric JWT signing keys (risk 4). The e2e tests' saved session. |
| `docs/specs/search.md` | A second line leaves out what a record doesn't have, such as a contact with no job title |
| `docs/specs/platform.md` | `tzdata` in Libraries. `npm start`'s Supabase project needs asymmetric JWT signing keys. Anything else the build settles that the spec doesn't say yet. |
| `docs/spec.md` | Only if the summary, the areas or the index change |
| `.claude/agents/ui-check.md` | Phase 1: sign in through the stand-in as `dana.holt@example.com`. Phase 3: the theme is in the user menu, and System is a third mode to leave as it was found. |

## Order of work

### Phase 1: Sign-in and the database

Parts A, B, C, D, G and H work at the same time, and part I keeps the docs.

1. **The person sets up Supabase,** at any point in the phase, since only step 7 needs it:
   - turn off sign-ups
   - check, under JWT Keys, that the project signs with an asymmetric key, and switch from the legacy secret if it doesn't (risk 4)
   - add one person, with a `display_name` in their user metadata
   - put `DATABASE_URL` (the session pooler's string, port 5432), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ACCOUNTABLE_TIMEZONE` in `.env`

   Part I looks up the project's region and tells part H, for `render.yaml`.
2. **Part A** builds in this order, so the others can join up early:
   1. settings, `clock.py` and its tests
   2. `tables.py`, the migration and `db.py`
   3. `auth.py`, `users.py`, `me.py` and the checks in `main.py`. From here, the stand-in's sign-in works and every other route needs a token, which parts C and G need.
   4. R17 in the services, routers and schemas, then timelines and the dashboard
   5. serving the built frontend
3. **Part B** adds `teammates.py` first, since part A's stand-in reads it, then the rest of `seed.py`.
4. **Parts C and D** work against the interfaces, with `fetch` mocked in their unit tests, and join up with part A once step 2.3 is done. Part D searches `src/features/` and `src/lib/` for every use of the browser's clock first, so none is missed.
5. **Part H** changes `dev.mjs` first, since every test run needs it, then `start.mjs` and `render.yaml`.
6. **Part G** changes the config and fixtures first. Then every existing e2e test has to pass, signed in, with no change to the test itself. That's the "everything works as before" half of criterion 2. Then it writes the three new spec files.
7. **Criterion 6, run by the person:** `npm start` against Supabase, then the checklist under Proof. This is the first time the real database, the real sign-in and row-level security are used, so problems found here go back to parts A, B or C before the phase ends.
8. Part I changes `ui-check.md` to sign in through the stand-in, then asks `ui-check` to look at the sign-in screen and the record pages' "Added by" lines, in light and dark mode.
9. `npm run check` passes. Part I updates `docs/STATUS.md`, the spec files listed for part I and `docs/TECH_STACK.md`.

### Phase 2: Search

Parts A, E and G work at the same time.

1. **Part A** writes `services/search.py`, `routers/search.py`, the reply's schema and the tests, and adds `GET /api/search` to the speed tests with `--large` data.
2. **Part E** adds the top bar to the app shell, then the search box against the API's shape, with `fetch` mocked, then joins up with part A.
3. **Part G** writes `search.spec.ts`, adds the search to `speed.spec.ts`, extends the Tab order in `keyboard.spec.ts` and adds the open results list to `accessibility.spec.ts`, in both modes.
4. Part I asks `ui-check` to look at the top bar and the results list in light and dark mode.
5. `npm run check` passes, and part I updates the docs.

### Phase 3: The user menu

Parts E, F and G work at the same time.

1. **Part F** changes `colorMode.ts` and the inline script, with their tests, then `ThemeChoice`.
2. **Part E** adds the user menu to the top bar, with `<ThemeChoice />` in it. Then, together with part F, it takes out the Dark mode switch: part E from `AppShell.tsx` and part F by deleting its files. Until then, both controls work.
3. **Part G** writes `user-menu.spec.ts`, renames `dark-mode.spec.ts` to `theme.spec.ts` and moves it to the menu, changes `turnOnDarkMode`, and adds the open menu to `accessibility.spec.ts` and the initials button to the Tab order.
4. Part I asks `ui-check` to go through every page in Light, Dark and System, signed in through the stand-in.
5. The person runs criterion 6's checklist again with `npm start`, now with the menu's items, including Sign out.
6. `npm run check` passes. Part I updates `docs/STATUS.md` and `ui-check.md`, then checks that the spec describes everything that was built.

After phase 3 comes Deploy, as `AGENTS.md` says: the review, `docs/IMPROVE.md`, then the merge. The person then creates the Render service from `render.yaml`, enters its three settings and opens its `onrender.com` address.

## Risks

1. **Code the tests can't run.** The tests use SQLite only, so row-level security, the id sequences, the psycopg driver and the pooler run only against Supabase. The unit tests check what they can without connecting: the engine's driver for a `postgresql://` URL, and that the migration's list of tables for row-level security is every table in `tables.py` plus `alembic_version`. Criterion 6's checklist (see Proof) is the real test, and it runs before phase 1 ends, while the code is fresh.
2. **Postgres's id sequences.** The sample data is inserted with its ids, so on Postgres each table's sequence stays at 1, and the first record anyone adds would fail as a duplicate. `seed.load` sets each sequence to the highest id. Criterion 6's checklist adds a record right after the first start to prove it.
3. **The token check is the lock on the team's data.** The usual mistakes are accepting a token signed with HS256 when only the public key is known, accepting `none`, skipping the issuer or audience, and taking the person from the request instead of the token. `test_auth.py` has a test for each, and the person comes only from `CurrentUser`. The stand-in can never be on with Supabase: the backend refuses to start (concern 18), and its key exists only in memory.
4. **The Supabase project's signing key.** The backend has no secret, so it can check only tokens signed with an asymmetric key, which it gets from `SUPABASE_URL/auth/v1/.well-known/jwks.json`. A project still on the legacy shared secret would refuse everyone. Step 1 checks it. Step 7 also checks whether that address needs the publishable key as an `apikey` header, and `auth.py` sends it if it does.
5. **"Before anything else is checked."** FastAPI reads the body and matches the route before it runs a dependency, so a dependency would give a 422 for broken JSON, a 405 for a wrong method and a 404 for an unknown address to someone signed out. The check is a middleware for that reason. It runs its database work in the thread pool so it doesn't hold up other requests. `test_sign_in_wall.py` sends all those cases signed out, and goes through every route the app has, so a new route can't miss the check.
6. **Two clocks.** `ACCOUNTABLE_TODAY` fixes the backend's clock to 2026-06-15, and the e2e tests fix Chrome's. Token expiry has to use the real clock, or every token would look expired, or never expire. `auth.py` uses `time.time()`, and the stand-in's frontend leaves expiry to the backend.
7. **Startup checks that wait for `/api/stages`.** That now answers 401. `dev.mjs` would wait its full 120 seconds and fail, so it counts any answer. Playwright already counts a 401 as started.
8. **Someone's first two requests at once** would both try to add them to users, and one would fail. The insert does nothing if the row is already there, using SQLite's and Postgres's own "on conflict" through SQLAlchemy, and `test_people.py` makes two first requests.
9. **The team's clock in the browser.** `teamNow()` gives a `Date` whose local fields read the team's clock, so date-fns keeps working unchanged. In the one hour a year that the browser's own zone skips, it can be an hour out. Every place that used the browser's clock has to use it, and a unit test fails if `new Date()` with no arguments appears in `src/features/` or `src/lib/format.ts`. Times are stored on the team's clock, so changing `ACCOUNTABLE_TIMEZONE` later would shift every time already stored. `docs/STATUS.md` says to set it once.
10. **The stand-in's sessions end when the backend restarts,** since its key is only in memory. On this computer, the next request then shows "Your session has ended." That's acceptable, and an e2e run uses one backend throughout.
11. **cmdk filters and sorts by itself.** Left to it, it would reorder the server's results and drop some. `SearchBox` turns both off, and a unit test checks that the order is the server's.
12. **Case folding in two places.** The backend folds with Python's `lower()`, and the highlight uses the browser's `toLowerCase()`. They agree for nearly every letter. Where they don't, the result is still found, just shown without the semibold.
13. **The Supabase settings reaching a test.** If the dev server or Vitest saw them, the frontend would sign in with Supabase. The build-time constants are set only for `vite build`, `dev.mjs` and the Playwright config remove the settings, the backend refuses to start with the stand-in and `SUPABASE_URL` together, and the e2e fixture fails any request off this computer. Criterion 1's manual check runs `npm run check` with the settings in `.env`, in the shell and with Wi-Fi off.
14. **Two sign-ins in the frontend.** The e2e tests use only the stand-in, so the Supabase sign-in is unit tested, with Supabase's client mocked at its edge, and then used for real in criterion 6's checklist.
15. **Search time grows with the records.** It reads every name of the three kinds for each search. With 500 of each, that's well inside half a second, and the speed tests hold it there. Thousands of records are out of scope for now (`docs/spec.md`).
16. **Render.** The service needs Node, to build the frontend, as well as Python 3.12 and uv. Phase 1 checks that Render's Python runtime has Node 24 or later, set with `NODE_VERSION`. It also checks whether uv is there or needs installing in the build command. On the free plan the first visit after 15 minutes takes about a minute, and the backend reaches Supabase through the session pooler, since Render can't use IPv6.
17. **Every unit test under a second.** The keys the tests use are elliptic-curve keys made once per session, which takes about a millisecond. The public keys are never fetched over the network, and the search box tests use fake timers. Part I records the slowest tests from `pytest --durations=10` and Vitest's report in `docs/STATUS.md`.
18. **More Tab stops.** The search box and the initials button come between the sidebar and the page. The keyboard tests reach their targets with `tabTo`, so they keep working, and phase 2 and 3 add the new order to them.
19. **No Sign out until phase 3.** The button arrives with the menu, so between phases 1 and 3 the branch has no way to sign out on screen. Phase 1's tests of a session ending spoil the saved token, which doesn't need the button.

## Proof

How each success criterion in `intent.md` is shown:

1. `npm run check` passes. The backend tests fail on any network connection, and the e2e tests fail on any request off this computer. The person also runs `npm run check` three times, since agents can't read `.env`: with the four settings in `.env`, with them exported in the shell, and with Wi-Fi off. Part I records the results in `docs/STATUS.md`.
2. `test_sign_in_wall.py` and `sign-in.spec.ts` for signed out. Every existing test passing, signed in and unchanged, for "everything works as before".
3. `test_who.py`, `test_seed.py` and `people.spec.ts`.
4. `test_search.py` and `search.spec.ts`.
5. `colorMode.test.ts`, `ThemeChoice.test.tsx` and `theme.spec.ts`.
6. The person runs this checklist with `npm start` against Supabase, and part I records the results in `docs/STATUS.md`:
   - it stops, naming the setting, when one is missing from `.env`
   - the sign-in screen shows the normal small print, with no stand-in
   - the person added in Supabase signs in and sees the sample data, with their display name in the menu (from phase 3)
   - a wrong password shows "Wrong email or password."
   - a refresh and a restart of Chrome keep them signed in
   - adding an organization works right after the first start (risk 2), and after a restart it's still there
   - `curl` to `SUPABASE_URL/rest/v1/deals`, with the publishable key, gets no rows (concern 17)
   - `/deals/12` opened directly works after a refresh
   - Sign out shows the sign-in screen (from phase 3)

Each new test is run once with the behavior it checks broken on purpose, then the code is put back. `docs/STATUS.md` says what was broken.

### Backend unit tests (pytest)

**`test_clock.py`** (new) and **`test_settings.py`**

- At 03:00 UTC on 2026-06-15, today is June 14 in `America/Los_Angeles` and June 15 in `Europe/London`, and now is on that zone's clock.
- `ACCOUNTABLE_TODAY` gives noon on that date in the team's zone.
- Without `ACCOUNTABLE_TIMEZONE`, today and now are the computer's own.
- Each new setting is read when it's asked for.

**`test_startup.py`** (new, concerns 16 and 18)

- The backend refuses to start, with its message, when the stand-in is on together with `SUPABASE_URL`, when it's on with a Postgres `DATABASE_URL`, and when neither is set.
- It refuses `ACCOUNTABLE_TIMEZONE=Mars/Olympus`.
- It starts with the stand-in on and SQLite, and with `SUPABASE_URL` and no stand-in.

**`test_auth.py`** (new, R15, concerns 18 and 20)

- A Supabase token signed with the tests' key is accepted, and the person is the token's.
- These are refused: an expired token, the wrong issuer, an audience or role other than `authenticated`, an anonymous user, a token signed with another key, a token using HS256 or `none`, a missing or malformed header, a stand-in token when Supabase is in use, and a Supabase token when the stand-in is on.
- The public keys are fetched once across many requests.
- A person named in the body or query is ignored.

**`test_sign_in_wall.py`** (new, R15)

- Signed out, every route the app has, found from the app itself, answers 401 with "Sign in to carry on."
- So do an unknown `/api` address, a wrong method, broken JSON and a bad id.
- The stand-in's sign-in answers with the stand-in on, and is a 401 like any other address with it off.
- Pages outside `/api` aren't refused, since the sign-in screen has to load.

**`test_people.py`** (new, R16, concern 19)

- The name is the display name, or the email when there's none or it's only spaces. The initials are DH for Dana Holt, and the email's first letter otherwise.
- A first request adds the person, and a new email or display name in the token updates them.
- Two first requests at once leave one row.
- A display name over 120 characters is cut to 120.

**`test_me.py`** (new)

- `GET /api/me` gives the id, name, email, initials and time zone, or no zone when it isn't set.
- The stand-in signs in each teammate by their email in any case, with "accountable".
- A wrong password, or an email that isn't a teammate's, is a 401 with "Wrong email or password."

**`test_who.py`** (new, R17)

- Adding sets both people to whoever added it, for each of the four kinds.
- A PATCH sets who last changed it. So do a stage change by moving the card, by the form and by adding straight to Won, and marking a follow-up done or not done.
- A won deal makes its contact a customer, changed by whoever moved the deal.
- Moving a card within its column, and links emptied by a delete, change neither the person nor the time.
- A body with `created_by` or `updated_by` is a 422.
- A record with no one recorded shows `null`.
- Lists, record pages, timelines, recent activity and follow-ups all carry the people.

**`test_one_server.py`** (new)

- With a built frontend in a temporary folder:
  - `/deals/12` gives the app's page
  - `/assets/app.js` and `/favicon.svg` give the files
  - signed in, `/api/nope` is a JSON 404
- Without a built frontend, none of that is served.
- The host check allows `RENDER_EXTERNAL_HOSTNAME` and still refuses others.

**`test_db.py`** and **`test_migrations.py`**

- A `postgresql://` URL makes a psycopg engine, without connecting.
- The migrations still give exactly `tables.py`, now with users and the eight new columns and their indexes.
- The row-level security list is every table plus `alembic_version`.
- `on_new` runs on a new database, and not on the next start.

**`test_api.py`** and **`test_speed.py`**

- The existing tests pass, signed in.
- `GET /api/search` joins the endpoints that must answer in under 300ms with the `--large` data (phase 2).

**`test_search.py`** (new, phase 2, R18, concern 21)

- It finds a name by any part of it. "har" and "HAR" find "Harbor Logistics", and "émile" finds "Émile", but "Emile" doesn't.
- `%` and `_` match only themselves.
- Spaces before and after are ignored, and empty or only spaces gives nothing. Over 200 characters is a 422.
- Up to 5 of each kind, with totals.
- Names that start with the search come first, then the rest, each alphabetical ignoring case.
- Each result has its second line's fields.

**`test_seed.py`** (part B)

- The four teammates are in users, and their names don't match any contact's.
- Every record and activity was added by one of them, in about the spec's shares.
- A deal's activities are mostly by whoever added it, and about one record in five was last changed by someone else.
- The data is the same every time for the same date, including who added and changed each record.
- `--large` spreads its records across the four the same way.
- `npm run seed` refuses a Postgres URL, with its message.

### Frontend unit tests (Vitest)

**`src/auth/`** (part C)

- `SignInScreen.test.tsx`:
  - the title, the labelled fields with their autocomplete, and Email focused
  - Enter in either field signs in
  - "Signing in..." can't be pressed twice
  - a wrong password shows its message, announced, and clears the password
  - when Supabase can't be reached, its message shows
  - the stand-in's small print shows with the stand-in, and the normal line without it
  - after a session ends, its message shows
- `SessionGate.test.tsx`:
  - while checking, nothing but the background
  - signed out, the sign-in screen at any address
  - signed in, the app at the same address, after `/api/me` has set the zone
  - a 401 shows the sign-in screen with "Your session has ended", and signing in returns to the same page
- `session.test.ts`:
  - signing out ends the session and empties the query cache
  - the stand-in's token is kept across a reload and dropped on sign-out
- `supabase.test.ts`, with Supabase's client mocked: its sign-in errors become the two messages, and its sign-out and expired sessions end the app's session.

**`src/lib/api.test.ts`**

- Every request sends the token.
- A 401 ends the session.
- The stand-in's own "Wrong email or password." doesn't.

**`src/lib/teamTime.test.ts`** (part D)

- The browser is in Los Angeles. With the team in Tokyo, at a fixed moment, today and now are Tokyo's. Without a zone, they're the browser's.

**Part D's other unit tests**

- `format.test.ts`: "Today" and "Yesterday" are counted from the team's now.
- `AddedBy.test.tsx`: both lines, the second left out until the record is changed, and nothing for a record with no one recorded.
- The three record pages: each shows `AddedBy` at the end of its details.
- `Timeline.test.tsx`: "Today, 2:30 PM, by Dana Holt" for an activity, and no name for stage and status changes.
- `FollowUps.test.tsx` and `RecentActivity.test.tsx`: who logged each activity.
- The pipeline and the forms: with the team's zone a day ahead of the browser's, a late card, the deal form's default close date and the activity form's default time follow the team's.
- A source check: no `new Date()` with no arguments in `src/features/` or `src/lib/format.ts`.

**Part E**

- `TopBar.test.tsx` and `AppShell.test.tsx`:
  - the top bar has a search area with the search box, and, from phase 3, the initials button
  - from phase 3, the sidebar has only the wordmark and the five sections, with no Dark mode switch
- `SearchBox.test.tsx`:
  - results show from the first character, and only spaces shows no list
  - the groups come in order, empty ones left out, with "Deals, 5 of 12"
  - each result has its icon, the semibold part and its second line
  - no results shows the message
  - the order is the server's
  - Up and Down move across groups, the first is highlighted as it opens, and Enter opens a result's page, clears the box and closes the list
  - Escape clears, and a second Escape does nothing
  - `/` focuses the box unless a field has focus
  - Tab and a click away close the list, keeping the text, and coming back opens it
  - the number of results is announced
- `highlight.test.ts`: the match at the start, in the middle and in another case, and no highlight when the folding doesn't line up.
- `UserMenu.test.tsx`:
  - it's announced as "Account, Dana Holt", a button that opens a menu
  - its tooltip gives the name
  - Enter, Space or Down opens it
  - it shows the name and email, and the email once when there's no display name
  - Up and Down move through the theme items and Sign out, and Escape returns focus to the button
  - Sign out calls `signOut()`

**Part F**

- `colorMode.test.ts`:
  - each choice applies and is saved
  - System follows the device, and changes when the device does
  - a bad saved value, or nothing saved, gives light
  - storage that throws still lets the choice work
  - the inline script, run in jsdom, handles every case above, including a device change after System is chosen from the menu
  - a choice saved by `setChoice` is read back by the inline script, so the two agree on the key
- `ThemeChoice.test.tsx`:
  - a group of three choices, with the chosen one checked
  - choosing one changes the mode at once, saves it and leaves the menu open

### End-to-end tests (Playwright with Chrome)

**`e2e/sign-in.spec.ts`** (phase 1, criterion 2)

- Signed out, every page in `PAGES` shows the sign-in screen, with no sidebar, top bar or data.
- Signing in on `/deals/12` shows that deal.
- A wrong password shows the message and clears the field. While signing in, the button says "Signing in..." and is disabled.
- The stand-in's small print is there.
- After a reload, the person is still signed in, and the sign-in screen never flashed. An init script watches `#root`, as the dark mode test does.
- Signed out, `/api/deals` and `/api/no-such-thing` answer 401.
- A spoiled token in storage gives "Your session has ended…", and signing in again returns to the same page.
- With dark saved, the sign-in screen is dark.
- axe finds nothing on the sign-in screen, with and without its error, in both modes.

**`e2e/people.spec.ts`** (phase 1, criterion 3)

- An organization, a contact and a deal each show "Added by" and, where the sample data has one, "Last changed by".
- Adding a record as Joel shows "Added by Joel Abara", and Dana editing it then shows "Last changed by Dana Holt".
- Logging an activity shows "by" with the person's name.
- The dashboard's follow-ups and recent activity show who logged each.

**`e2e/time-zone.spec.ts`** (phase 1, concern 16)

- With Chrome set to Asia/Tokyo, where it's already June 16, the app still follows the team's zone, Los Angeles:
  - the dashboard's date
  - "Today" in timelines
  - the activity form's default date and time
  - which pipeline cards are late

**`e2e/search.spec.ts`** (phase 2, criterion 4)

- Part of a name, in any case, finds an organization, a contact and a deal, each in its group with its second line.
- "Deals, 5 of N" shows for a search with more than 5 deals.
- "No organizations, contacts or deals match…" shows for no results.
- With the keyboard: `/`, Down and Enter open a result's page, and the box is cleared. Escape closes and clears.
- Clicking away keeps the text.

**`e2e/speed.spec.ts`**: with `--large` data, search results show within half a second of the last key.

**`e2e/keyboard.spec.ts`**: Tab goes through the skip link, the sections, the search box, the initials button (from phase 3), then the page.

**`e2e/user-menu.spec.ts`** (phase 3)

- The initials button shows DH, and the menu shows Dana's name and email.
- The menu works from the keyboard.
- Sign out shows the sign-in screen, with no record names left on the page. Signing in as Joel then shows JA and his own name.
- The theme choice stays after signing out.

**`e2e/theme.spec.ts`**, renamed from `dark-mode.spec.ts` (phase 3, criterion 5)

- Light is the default.
- Choosing Dark in the menu makes the page dark at once, leaves the menu open, and is remembered after a reload.
- System follows Chrome's color scheme, and changes while the page is open when Playwright switches it from light to dark.
- A saved Dark or System on a dark device is in place before the app first draws.
- The theme choice is in the menu on every section and on Page not found.
- The existing color checks for charts, dialogs and messages stay, now turned on through the menu.

**`e2e/accessibility.spec.ts`**: every existing check, plus the open search results (phase 2) and the open user menu (phase 3), in both modes.

**The tests already there** all pass, signed in through the setup project. That shows sign-in, the new columns and the time zone haven't changed how the app behaves.
