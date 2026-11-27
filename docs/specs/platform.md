# How it's built and run

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

**On this computer:**

1. **Fonts that work offline.** The brand's fonts come from Google Fonts, but `npm run dev` has to work with no internet connection, and the team's app shouldn't send every visit to Google. The same three fonts are bundled into the app with the `@fontsource` npm packages, so nothing is loaded from Google.
2. **The first run needs the internet once.** Setting everything up on the first run means downloading the npm packages, the Python packages and, if it's missing, Python 3.12 itself (uv does this). After that, `npm run dev` and the tests need no connection. `npm start` and Render always need one, for Supabase.
3. **One command before anything is installed.** `npm run dev` normally needs `npm install` first. Here `npm run dev` runs a small Node script with no dependencies of its own. It checks the Node.js version and that uv is installed, and says what to do if either is missing. Then it installs what's missing, creates the database with sample data if there isn't one, starts both servers and prints the address to open in Chrome.

**On the web:**

15. **Two ways to run it.** `npm run dev` runs Accountable on this computer with a SQLite database of its own, the sample data and the stand-in sign-in (concern 18). It takes only `ACCOUNTABLE_TIMEZONE` from `.env` and leaves the rest out, so it never reaches Supabase. `npm start` builds the app and runs it the way Render does, against the team's database on Supabase, so it needs the internet and changes the real data. `npm run seed` works only on a SQLite database and refuses any other, and the tests never read `.env`, so nothing run on this computer by mistake can replace the team's data.
16. **One time zone for the team.** Everyone shares one time zone, set by `ACCOUNTABLE_TIMEZONE` as a name such as `Europe/London`. Render's servers run on UTC, and a teammate's laptop may be set to another zone while they travel, so neither the server's clock nor the browser's decides what today is.
    - The backend works out today, now, late, overdue, due soon and months in the team's zone, and keeps times in it.
    - The browser gets the zone from the backend (`GET /api/me`) and uses it for the dates it works out itself, such as late cards and the forms' defaults, and for every time it shows.
    - Without `ACCOUNTABLE_TIMEZONE`, the zone is the computer's own, and the browser's own in the browser. A name that isn't a time zone stops the backend from starting, with a message.
    - Times are stored on the team's clock, with no zone, so changing `ACCOUNTABLE_TIMEZONE` later would shift every time already stored. It's set once.
17. **Row-level security on every table.** Supabase serves every table in the database's `public` schema through its Data API to anyone holding the publishable key, and that key is in every browser by design. So a migration turns on row-level security for every table, Alembic's own included, with no policies, which leaves the Data API nothing it can read or change. The backend connects as the database's owner, which row-level security doesn't limit. A later table turns it on in the migration that adds it. On SQLite this step is skipped.

## Running it

Commands work the same on Mac, Linux and Windows.

- **Before you start:** Node.js 24 or later (26 recommended), uv and Google Chrome. Nothing else needs installing beforehand. `docs/STATUS.md` says how to install them on Mac, Linux and Windows. `npm start` also needs a Supabase project, with sign-ups turned off, an asymmetric JWT signing key (`docs/specs/sign-in.md`) and at least one person added, and `.env` with its four settings.
- **`.env`**, which git ignores, holds `DATABASE_URL` (the session pooler's connection string from Supabase, port 5432), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ACCOUNTABLE_TIMEZONE`, one `NAME=value` on each line. Only `npm start` reads all four. A setting set in the shell wins over `.env`, and an empty one counts as not set.
- **`npm run dev`** starts Accountable on this computer. On the first run it checks Node.js and uv, installs the npm and Python packages, and creates the database with the sample data. Then it starts the backend and frontend and prints "Accountable is running at http://localhost:5173. Open it in Google Chrome." Sign in as a sample teammate (concern 18). Ctrl+C, or closing the terminal, stops both.
- **`npm start`** builds the frontend and runs the app the way Render does: one server, at http://localhost:8000, serving the built frontend and the API, against Supabase with the settings in `.env`. It runs the migrations as it starts and, if the database is new, loads the sample data. It stops with a message naming every setting that's missing or empty, before anything else runs, and stops before building if port 8000 is taken. It never uses the stand-in, even if the shell sets `ACCOUNTABLE_STAND_IN`. Sign in as someone added in Supabase. Ctrl+C stops it. The build stays in `frontend/dist`, which git ignores.
- **`npm run seed`** replaces all the data in the local SQLite database with fresh sample data, dated from today, and prints what it created. It refuses a database that isn't SQLite (concern 15), before connecting, with a message that doesn't repeat the address, so a password in it is never printed. If the app is running, refresh the browser to see the new data. `npm run seed -- --large` adds 500 of each kind of record, for checking speed.
- **`npm test`** runs every test against a database and ports of its own (8100 and 5273), so it works while the app is open. A test left with `.only` fails the run.
- **The local data** lives in `data/accountable.db`, which git ignores, unless `DATABASE_URL` names another database. Deleting that file also resets to the sample data on the next start. The team's data lives in Postgres on Supabase, and starts with the sample data.

## On Render

The team's Accountable is one web service on Render's free plan, described by `render.yaml` at the repo root.

- Render installs the packages, builds the frontend and starts the app as `npm start` does, with its settings from Render instead of `.env`. The migrations run each time it starts.
- Render adds uv to its Python runtime by itself, since the repo has `uv.lock`. The build installs the Python packages from `uv.lock` without the dev group, and fails if the lock is out of date. Render's proxy handles HTTPS, so the server trusts the headers it forwards.
- It answers at its `onrender.com` address, over HTTPS.
- `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are entered in Render when the service is first set up, and never written in `render.yaml`. The file sets `ACCOUNTABLE_TIMEZONE`, which isn't secret, `PYTHON_VERSION` to a 3.12 release, since Render's default Python is newer, `NODE_VERSION` to 24, for the frontend's build, and the Render region nearest the Supabase project, since every query crosses between the two.
- It deploys `main` each time CI passes on it. `render.yaml` names no branch, so the branch chosen when the service is set up applies.
- It has no health check path, since Render's check would come to an address the host check refuses.
- On the free plan it sleeps after 15 minutes without visits, and the next visit takes about a minute to wake it.

## Quality

- **Browser:** the current Google Chrome on Mac, Linux and Windows. Other browsers aren't checked.
- **Screen:** designed for 1440 by 900, and works from 1280 by 720 upwards.
- **Speed:** with 500 of each kind of record, every screen shows its data within a second on a typical laptop running `npm run dev`, the table searches keep up with typing, the top bar's search shows its results within half a second, and a dragged card follows the pointer smoothly.
- **Console:** no errors or warnings in Chrome's console during normal use.
- **Where it listens:** `npm run dev` and `npm start` listen on this computer (127.0.0.1) only, not on the network. On Render it listens on the port Render gives it. The backend answers only requests addressed to `localhost` or `127.0.0.1`, and on Render also its own `onrender.com` address, which Render passes in as `RENDER_EXTERNAL_HOSTNAME`, so a web page can't reach it by pointing its own name at the computer. The frontend's dev server allows no other origin and doesn't serve the database files.
- **Secrets:** the browser holds only the publishable key. Nothing secret is in git, the built frontend or `render.yaml`. CI needs no secrets.
- **Tests:** each unit test, frontend and backend, old and new, runs in under a second on this computer, since CI runs on a much slower machine. `npm run check` never reaches Supabase, with or without the settings in `.env`.
- **Keyboard and contrast:** as described under Keyboard and accessibility in `docs/specs/look.md`.

## How it fits together

- **`frontend/`:** a React, Vite and TypeScript app. With `npm run dev`, its dev server forwards `/api` to the backend, so the browser talks to one address.
- **`backend/`:** a FastAPI app, organized by kind of record, with the business rules (R1 to R11) in one service layer. Dragging a card, saving the form and adding a deal all go through the same code. Each request runs in a single database transaction, so a move to Won changes the deal, its stage history, its main contact and their status history together or not at all.
- **One server:** with `npm start` and on Render, FastAPI serves the built frontend as well as the API. Any address that isn't under `/api` and isn't a file gets the app's page, so the frontend's own addresses, such as `/deals/12`, work after a refresh. The browser is told to check for a new copy of the page each time, since it names the current build's files. Nothing outside the build is served, and an unknown `/api` address is still the API's JSON 404.
- **Sign-in:** every route checks the person's token before anything else (R15), as described in `docs/specs/sign-in.md`.
- **The database:** named by `DATABASE_URL`: a SQLite file on this computer for `npm run dev`, a SQLite database of their own for the tests, and Postgres on Supabase for `npm start` and Render. The tables are defined with SQLAlchemy Core and created and changed by Alembic migrations, which are in git and run when the app starts. The sample data is loaded if the database was new, in the same transaction as the migrations, so a first start that fails partway leaves the database as it was, on SQLite as on Postgres.
- **Postgres details:** the backend connects through Supabase's session pooler, on port 5432, since the direct connection is IPv6 only on the free plan and Render can't reach it. A `postgresql://` or `postgres://` address connects with psycopg. The pooler drops connections left idle, as they are while Render sleeps, so each connection is checked before it's used and replaced if it's gone. Every table has row-level security on (concern 17).
- **SQLite details:** when the database is SQLite, every connection turns on foreign keys (`PRAGMA foreign_keys = ON`), or SQLite silently ignores the delete rules. It also uses WAL mode, so the seed command can run while the app is open.
- **Who decides:** the backend decides what's late, overdue and due soon, and works out every dashboard figure, in the team's time zone (concern 16). The pipeline recalculates its own totals as soon as a card moves, using R1 and R2, and then refreshes from the server.

## Libraries

Popular, well-supported libraries, as `docs/TECH_STACK.md` asks:

| Need | Library |
|---|---|
| Pages and addresses | React Router |
| Loading and caching data, instant card moves | TanStack Query |
| Sorting and searching tables | TanStack Table |
| Pipeline drag and drop with the mouse | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Charts | Recharts |
| Dialogs, menus (the user menu included), selects, checkboxes and tooltips | Radix UI primitives |
| Pickers you can search, and the top bar's search results | cmdk |
| Forms and field checks | React Hook Form with Zod |
| Styling, with the brand as theme tokens | Tailwind CSS |
| Icons | lucide-react |
| Messages | sonner |
| Dates | date-fns |
| Fonts, served from the app | `@fontsource/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono` |
| Signing in, in the browser | Supabase's JavaScript client (`@supabase/supabase-js`) |
| API | FastAPI, Pydantic, Uvicorn |
| Database | SQLAlchemy Core |
| Connecting to Postgres | psycopg |
| Checking tokens | PyJWT, with its `crypto` extra |
| Time zone names on any computer, since Windows has none of its own | tzdata |
| Database changes | Alembic |
| Tests | Vitest with React Testing Library, pytest with FastAPI's test client, Playwright Test using Chrome |

## Data model

Columns use SQLAlchemy's own types (`Date`, `DateTime`, `Boolean`, `Integer`, `String`, `Text`), so the same tables work on SQLite and Postgres. The API sends dates as `YYYY-MM-DD` and times as ISO 8601, in the team's time zone (concern 16), and times are stored in that zone. A time sent with a zone is converted to the team's clock. Money is stored in whole US dollars. Every table has `id`, an integer primary key, except users, whose `id` is the person's Supabase user id. The four kinds of record also have `created_at` and `updated_at`, and `created_by` and `updated_by`, which link to users (R17). The server sets all four.

Each table is in the file for its area: organizations in `docs/specs/organizations.md`, contacts and status_changes in `docs/specs/contacts.md`, deals and stage_changes in `docs/specs/deals.md`, activities in `docs/specs/activities.md`, and users in `docs/specs/sign-in.md`.

Indexes cover every link column, `created_by` and `updated_by` included, `deals (stage, position)` and `activities (follow_up_date)`.

## API

JSON under `/api`, with snake_case names. Every route needs someone signed in (R15). A failed field check returns 422 with a message for each field, which the form shows under that field. A missing record returns 404, and so does an id in the address that can't be a record's, such as `abc`. A link in the body to an id that can't be a record's returns 422. The API is only what's in the API tables of the area files, with no `/docs`, `/redoc` or `/openapi.json`.

Each route is in the file for its area: stages and deals in `docs/specs/deals.md`, the signed-in person in `docs/specs/sign-in.md`, search in `docs/specs/search.md`, and organizations, contacts, activities and the dashboard in their own files.

Each organization, contact, deal and activity the API returns has `created_by` and `updated_by`, each with the person's id, name and initials (R16), or empty for a record from before sign-in (R17). A body can't set them: like any field the API doesn't take, they return 422.

`PATCH` sends only the fields that changed. What a deal's `PATCH` fills in is in `docs/specs/deals.md`.

## Testing hooks

- `DATABASE_URL` sets the database, so the tests use their own.
- `ACCOUNTABLE_TODAY` fixes the date the backend treats as today, with noon in the team's time zone as the time now, so the tests for late deals, follow-ups and months always give the same results. The end-to-end tests set Chrome's clock to 11:00 on the same date, in the same zone, since the pipeline works out late cards in the browser too, and a time Chrome fills in as now is then never later than the backend's now.
- The tests set `ACCOUNTABLE_TIMEZONE` themselves, so their results don't depend on the computer's own zone.
- The tests don't read `.env`, and leave `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` out of their servers' settings even when the shell has them, so they never reach Supabase. They sign in with the stand-in (`docs/specs/sign-in.md`). A backend test fails if it tries to open a network connection, and an end-to-end test fails on any request to a host other than 127.0.0.1.
- A unit test fails if `new Date()` with no arguments appears in `src/features/` or `src/lib/format.ts`, since the browser's clock isn't the team's. The frontend reads the date and time only through `src/lib/teamTime.ts`.
- The sample data generator takes today's date as an input, for the same reason.
- `ACCOUNTABLE_API_PORT` and `ACCOUNTABLE_WEB_PORT` set the ports the frontend's dev server uses, so the tests can run their own copy of the app while it's open.
