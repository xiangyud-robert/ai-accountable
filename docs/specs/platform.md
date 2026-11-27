# How it's built and run

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

## Concerns

1. **Fonts that work offline.** The brand's fonts come from Google Fonts, but Accountable has to work with no internet connection. The same three fonts are bundled into the app with the `@fontsource` npm packages, so nothing is loaded from Google.
2. **The first run needs the internet once.** Setting everything up on the first run means downloading the npm packages, the Python packages and, if it's missing, Python 3.12 itself (uv does this). After that, no connection is needed.
3. **One command before anything is installed.** `npm run dev` normally needs `npm install` first. Here `npm run dev` runs a small Node script with no dependencies of its own. It checks the Node.js version and that uv is installed, and says what to do if either is missing. Then it installs what's missing, creates the database with sample data if there isn't one, starts both servers and prints the address to open in Chrome.

## Running it

Accountable runs locally, with commands that work the same on Mac, Linux and Windows. After the first run it needs no internet connection.

- **Before you start:** Node.js 24 or later (26 recommended), uv and Google Chrome. Nothing else needs installing beforehand. `docs/STATUS.md` says how to install them on Mac, Linux and Windows.
- **`npm run dev`** starts Accountable. On the first run it checks Node.js and uv, installs the npm and Python packages, and creates the database with the sample data. Then it starts the backend and frontend and prints "Accountable is running at http://localhost:5173. Open it in Google Chrome." Ctrl+C, or closing the terminal, stops both.
- **`npm run seed`** replaces all the data with fresh sample data, dated from today, and prints what it created. If the app is running, refresh the browser to see the new data. `npm run seed -- --large` adds 500 of each kind of record, for checking speed.
- **`npm test`** runs every test against a database and ports of its own (8100 and 5273), so it works while the app is open. A test left with `.only` fails the run.
- **The data** lives in `data/accountable.db`, which git ignores, unless `DATABASE_URL` names another database. Deleting that file also resets to the sample data on the next start.

## Quality

- **Browser:** the current Google Chrome on Mac, Linux and Windows. Other browsers aren't checked.
- **Screen:** designed for 1440 by 900, and works from 1280 by 720 upwards.
- **Speed:** with 500 of each kind of record, every screen shows its data within a second on a typical laptop, the search keeps up with typing, and a dragged card follows the pointer smoothly.
- **Console:** no errors or warnings in Chrome's console during normal use.
- **Local only:** the servers listen on this computer (127.0.0.1) only, not on the network. The backend answers only requests addressed to `localhost` or `127.0.0.1`, so a web page can't reach it by pointing its own name at this computer, and the frontend's dev server allows no other origin and doesn't serve the database files.
- **Keyboard and contrast:** as described under Keyboard and accessibility in `docs/specs/look.md`.

## How it fits together

- **`frontend/`:** a React, Vite and TypeScript app. Its dev server forwards `/api` to the backend, so the browser talks to one address.
- **`backend/`:** a FastAPI app, organized by kind of record, with the business rules (R1 to R11) in one service layer. Dragging a card, saving the form and adding a deal all go through the same code. Each request runs in a single database transaction, so a move to Won changes the deal, its stage history, its main contact and their status history together or not at all.
- **The database:** named by `DATABASE_URL`, which defaults to a SQLite file on this computer. The tables are defined with SQLAlchemy Core and created and changed by Alembic migrations, which are in git and run when the app starts. The sample data is loaded if the database was new. Moving to Postgres on Supabase later means changing `DATABASE_URL`.
- **SQLite details:** when the database is SQLite, every connection turns on foreign keys (`PRAGMA foreign_keys = ON`), or SQLite silently ignores the delete rules. It also uses WAL mode, so the seed command can run while the app is open.
- **Who decides:** the backend decides what's late, overdue and due soon, and works out every dashboard figure. The pipeline recalculates its own totals as soon as a card moves, using R1 and R2, and then refreshes from the server.

## Libraries

Popular, well-supported libraries, as `docs/TECH_STACK.md` asks:

| Need | Library |
|---|---|
| Pages and addresses | React Router |
| Loading and caching data, instant card moves | TanStack Query |
| Sorting and searching tables | TanStack Table |
| Pipeline drag and drop with the mouse | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Charts | Recharts |
| Dialogs, menus, selects, checkboxes, tooltips, the Dark mode switch | Radix UI primitives |
| Pickers you can search | cmdk |
| Forms and field checks | React Hook Form with Zod |
| Styling, with the brand as theme tokens | Tailwind CSS |
| Icons | lucide-react |
| Messages | sonner |
| Dates | date-fns |
| Fonts, served from the app | `@fontsource/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono` |
| API | FastAPI, Pydantic, Uvicorn |
| Database | SQLAlchemy Core |
| Database changes | Alembic |
| Tests | Vitest with React Testing Library, pytest with FastAPI's test client, Playwright Test using Chrome |

## Data model

Columns use SQLAlchemy's own types (`Date`, `DateTime`, `Boolean`, `Integer`, `String`, `Text`), so the same tables work on Postgres later. The API sends dates as `YYYY-MM-DD` and times as ISO 8601, in local time. Money is stored in whole US dollars. Every table has `id` (an integer primary key), and the four kinds of record also have `created_at` and `updated_at`, set by the server.

Each table is in the file for its area: organizations in `docs/specs/organizations.md`, contacts and status_changes in `docs/specs/contacts.md`, deals and stage_changes in `docs/specs/deals.md`, and activities in `docs/specs/activities.md`.

Indexes cover every link column, `deals (stage, position)` and `activities (follow_up_date)`.

## API

JSON under `/api`, with snake_case names. A failed field check returns 422 with a message for each field, which the form shows under that field. A missing record returns 404, and so does an id in the address that can't be a record's, such as `abc`. A link in the body to an id that can't be a record's returns 422. The API is only what's in the API tables of the area files, with no `/docs`, `/redoc` or `/openapi.json`.

Each route is in the file for its area: stages and deals in `docs/specs/deals.md`, and organizations, contacts, activities and the dashboard in their own files.

`PATCH` sends only the fields that changed. What a deal's `PATCH` fills in is in `docs/specs/deals.md`.

## Testing hooks

- `DATABASE_URL` sets the database, so the tests use their own.
- `ACCOUNTABLE_TODAY` fixes the date the backend treats as today, with noon as the time now, so the tests for late deals, follow-ups and months always give the same results. The end-to-end tests set Chrome's clock to 11:00 on the same date, since the pipeline works out late cards in the browser too, and a time Chrome fills in as now is then never later than the backend's now.
- The sample data generator takes today's date as an input, for the same reason.
- `ACCOUNTABLE_API_PORT` and `ACCOUNTABLE_WEB_PORT` set the ports the frontend's dev server uses, so the tests can run their own copy of the app while it's open.
