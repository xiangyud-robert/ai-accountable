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

- `npm run dev` starts Accountable and prints the address to open in Chrome: http://localhost:5173. Sign in as a sample teammate, such as `dana.holt@example.com`, with the password `accountable`. It uses the stand-in sign-in and its own database, never reaches Supabase, and takes only `ACCOUNTABLE_TIMEZONE` from `.env`. A restart of the backend ends the session, so sign in again after one. The first run installs the npm and Python packages (and Python 3.12 if needed), which needs the internet and takes a few minutes. Ctrl+C stops it.
- `npm start` builds the frontend and runs the app the way Render does, at http://localhost:8000, against the team's database on Supabase, so it changes the real data. It needs the Supabase project and `.env` described under Supabase and Render. Ctrl+C stops it.
- `npm test` runs the frontend, backend and end-to-end tests, and fails if any test fails or unit test coverage is under 80%. It uses its own database and ports (8100 and 5273), so it works while the app is open. The end-to-end tests sign in through the stand-in. Their saved session and the traces of failed tests go outside the repo, in `accountable-e2e-` and 8 characters in the computer's temporary folder (`$TMPDIR` on a Mac), since both hold stand-in tokens that gitleaks would flag. The HTML report stays in `playwright-report/`.
- `npm run check` runs gitleaks, Prettier, ESLint, ruff format, ruff check, tsc, ty and `npm test`, and fails if any of them fails. `npm run check:quick` is the same without the end-to-end tests. It needs gitleaks, installed once with `brew install gitleaks` on a Mac or `winget install -e --id Gitleaks.Gitleaks` on Windows. The pre-commit hook needs it too.
- `npm run format` fixes the formatting, with Prettier for the frontend and ruff format for the backend.
- `npm run seed` replaces all the data with fresh sample data, dated from today. If the app is open, refresh the page to see it. `npm run seed -- --large` adds 500 of each kind of record, for checking speed. It works only on a SQLite database, so it can't replace the team's data.

With `npm run dev`, the data lives in `data/accountable.db`, which git ignores. Deleting that file also resets to the sample data on the next start. Set `DATABASE_URL` in the shell to use another SQLite database. The team's data lives in Postgres on Supabase.

## Supabase and Render

**Supabase,** set up once, before the first `npm start`:

1. In Authentication, turn off "Allow new users to sign up".
2. Under JWT Keys, check that the project signs with an asymmetric key, and switch from the legacy JWT secret if it doesn't. The backend has no secret, so a project on the legacy secret would refuse everyone.
3. Add each person in Authentication, Users, with an email and a password, and set `display_name` in their user metadata, for example in the SQL editor with `update auth.users set raw_user_meta_data = raw_user_meta_data || '{"display_name": "Dana Holt"}' where email = '...';`. Until it's set they show by their email, and a new name shows once their token is next renewed, within the hour.

**`.env`,** at the repo root, one `NAME=value` on each line. A hook keeps agents out of it, so fill it in yourself:

- `DATABASE_URL`: the session pooler's connection string from the project's Connect panel, port 5432, with the database password filled in. Its host names the project's region, such as `aws-0-us-west-1`.
- `SUPABASE_URL`: the project's URL, such as `https://abcd.supabase.co`.
- `SUPABASE_PUBLISHABLE_KEY`: the publishable key (`sb_publishable_...`), never the secret key.
- `ACCOUNTABLE_TIMEZONE`: the team's time zone, such as `America/Los_Angeles`. Set it once, before anyone uses the app. Times are stored on its clock, so changing it later shifts every time already stored.

A setting exported in the shell wins over `.env`. `npm start` stops with a message naming every one of the four that's missing or empty, and never uses the stand-in, even if the shell sets `ACCOUNTABLE_STAND_IN`. On the first start against a new database it creates the tables and loads the sample data. It leaves the build in `frontend/dist`, which git ignores, with the Supabase URL and publishable key in it, neither of them secret.

**Render,** set up once, at Deploy, after phase 3:

1. Before creating the service, set `region` in `render.yaml` to the one nearest the Supabase project, since it can't be changed once the service exists: `oregon` for us-west-1 or us-west-2, `virginia` for us-east-1, `ohio` for us-east-2, `frankfurt` for eu-*, and `singapore` for ap-southeast-1 or ap-south-1. These five are all the free plan has. Set `ACCOUNTABLE_TIMEZONE` there to the same zone as `.env`. Both are set already: the project is in us-east-2, so the region is `ohio`, and the zone is `America/Los_Angeles`.
2. In Render's dashboard, create a Blueprint from the repo, which reads `render.yaml`, and choose the branch. It deploys that branch each time CI passes on it.
3. Enter `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` when asked. Render asks only this once, so a later change is made on the service's Environment page.
4. On the first deploy, check the build log: Node should be 24 or later, with no EBADENGINE warning from `npm ci`. Render's docs don't say whether `NODE_VERSION` applies to a Python service. If the start fails with `uv: command not found`, the start command can use `.venv/bin/uvicorn` instead of `uv run`.
5. Open the service's `onrender.com` address and sign in.

On the free plan it sleeps after 15 minutes without visits, and the next visit takes about a minute. The migrations run each time it starts.

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
- Hooks (Nov 26, 2026), listed in `docs/TECH_STACK.md`:
  - The pre-commit hook (`lefthook.yml`) is installed by lefthook's postinstall, which `allowScripts` in `package.json` approves, since npm blocks dependencies' install scripts by default. A commit takes about 2 seconds. In a scratch clone, it formatted and staged badly formatted TypeScript and Python, keeping a partly staged file's unstaged lines out of the commit and in the working tree. It refused commits with a complexity of 16, a tsc error, a ruff error, a ty error, the course's fake key (`frontend/src/main.tsx`, line 1, `generic-api-key`, redacted) and gitleaks missing (with how to install it). `--no-verify` skips it.
  - The Stop hook (`scripts/claude-hooks/check-on-stop.mjs`) sends back only the failed steps' output and the summary. The full log is in `node_modules/.cache/check-on-stop/output.log`. A headless Claude session with a planted type error got the tsc failure once, couldn't fix it with its tools turned off, and was let stop.
  - The `.env` hook (`scripts/claude-hooks/protect-env.mjs`) blocked a Write and a shell write to a `.env` in this session, and let `.env.example` through. It matches the name in any case and in any folder. It blocks if the script itself fails (`onFailure: block`), which wasn't tried live.
  - gitleaks now runs with `--verbose` everywhere, because without it a finding said only "leaks found: 1", not where.
- CI (Nov 26, 2026): `.github/workflows/ci.yml` has one job, `check`, on every push to any branch, with no secrets. It checks out every branch's history, installs gitleaks 8.30.1 from its GitHub release (checking its checksum) and scans the history first. Then it installs Node 26 and the latest uv (setup-uv v10.4.0), runs `npm ci` and `npm run check` with the runner's Google Chrome, and uploads `playwright-report/` if the run fails. Playwright now writes that HTML report on every run, without opening it. Checked before the first push: actionlint and shellcheck pass, the gitleaks install step ran with its checksum passing, and a fresh clone with `CI=true` in UTC passed `npm ci` and `npm run check` in 2.5 minutes, installing Python from nothing.
  - The first run on GitHub failed twice over. tsc found `'method' is declared but its value is never read` in `Board.test.tsx`. On Mac and Windows tsc had never checked that file, because `board.test.ts` beside it has the same name apart from case, and TypeScript keeps only the `.ts` of two such files. Linux is case-sensitive, so it checked both. `board.test.ts` is now `boardRules.test.ts`, and the argument is `_method`, as in the other tests. Five speed tests also took 1.2 to 1.7 seconds against their one-second limit, on a runner two to three times slower than this Mac across the run. Their limits changed as described under Notes on the build. Only tests changed. The spec and the app's code didn't.
  - CI later stopped running the end-to-end tests, as described under Subagents.
- The improvement step (Nov 26, 2026): `docs/IMPROVE.md` says how to improve the harness after each change, and `AGENTS.md` says to follow it at Deploy, after the review fixes and before the merge.
- Found while writing the tests, not fixed yet: a successful pipeline move fetches the deals twice (the app's refetch after every change, then the move's own `onSettled`); a failed save's message differs from a successful one only by a red dot, which a screen reader doesn't hear; `DealForm`'s `onSaved` prop is never passed; `Panel` drops a subtitle given without a title.

## Dark mode (Nov 26, 2026)

The `dark-mode` branch, built from `docs/changes/dark-mode/plan.md` in its order of work.

- Phase 0, light mode recorded before any change: `e2e/screenshots.config.ts` and the "light mode is unchanged" group in `e2e/screenshots.ts`, with 15 pictures in the git-ignored `tmp/light-baseline/`: every section and Page not found, the deal form, the Stage select, a picker, an activity's menu, a chart tooltip and the message after a save. A 16th, a hovered secondary button, was added in phase 3.
  - The first recording missed the open Stage select. A full-page picture makes Chrome resize the window, and Radix Select closes itself on `resize`. So the six pictures of things that open over the page are taken of the window, and only the sections are full-page. By then phase 1 had started, so the baseline was recorded again from the committed frontend, extracted with `git archive` to `/tmp` and served from there, leaving the working tree alone.
  - The plan's `style` option hid the switch in the first version, but `toHaveScreenshot` only takes `stylePath`, and since the options were a variable, tsc didn't flag it. The rule is now in `e2e/hide-dark-mode-switch.css`, and the options are typed, so tsc would catch it. Injecting any stylesheet makes Chrome repaint, which shifts the anti-aliasing of two pipeline cards by a few shades, even on the committed frontend. So the baseline is recorded with the stylesheet injected. It matches nothing there, so the pictures are still of today's app.
  - Against the committed frontend, the final baseline matched itself in two more runs. Before that, one run stalled for 1.5 minutes on the pipeline and then didn't find the page loaded, and one recording of the chart tooltip got two different pictures in a row. Neither came back in many more runs.
- Phase 1, the theme: `raised`, `on-primary` and `logo` roles with today's light values, the components moved onto them, and the dark block in `theme.css`. Tailwind copies a shadow's value into `shadow-panel` and `shadow-lift` (checked in the built CSS, risk 1), so the shadows now take their colors from three roles, `shadow`, `shadow-lift-near` and `shadow-lift-far`, which the dark block sets to black. The spec gives no dark value for the deeper shadow, so it's black at 50% and 60%. `theme.test.ts` checks every role has a dark value, contrast in both modes, Negotiation's dark colors, no `dark:` classes, and the favicon against light mode. Planting a low-contrast ink, a missing dark role and a `dark:` class each failed it. Setting light `raised` to `#fffffe` failed the light comparison, so it does see the surfaces that changed.
- Phase 2, the choice and the switch: the inline script in `index.html`, `src/lib/colorMode.ts`, `src/app/DarkModeSwitch.tsx` at the bottom of the sidebar, and their unit tests. `test-setup.ts` now clears the saved choice and the mode on `<html>` after each test. A different storage key in the inline script failed both of the tests that compare it with `setMode`.
- Phase 3, dark mode in the browser: `e2e/dark-mode.spec.ts` (9 tests), every `accessibility.spec.ts` check in both modes, and `turnOnDarkMode` in the fixtures. The `PAGES` list moved from `accessibility.spec.ts` to `fixtures.ts`, since three files use it.
  - Each test was shown to fail: no inline script, a black raised surface, and axe with a dark muted text of `#444444`.
  - The plan's concern 14 test, which notes the mode when the app adds its first element, still passed when the app set the mode itself in a `useEffect`. React's scheduler ran the render and the effect in the same task, before the observer's callback. The test now also notes the mode when `<body>` appears, before which nothing can draw, and that fails with the mode set late.
  - Walked through every screen in dark mode at 1440 by 900 and 1280 by 720: panels on the page, menus, the Stage list, the picker, tooltips and messages on the panels, dialogs over the overlay, focus rings, row hover, the sidebar's current section, the drop space in New and Negotiation, and every chart. A reload in dark mode, recorded frame by frame with Chrome's trace, goes from the dark page to Chrome's dark canvas to `#04232E`, with no light frame.
  - Two things needed more than a new value in `theme.css`, so, as the plan says, they were asked about first:
    - A secondary button's hover (`brightness-95`) changed Midnight by 3 to 4 levels per channel in dark mode, against 11 in light mode, so it barely showed (risk 7). Agreed fix: `--secondary-hover-brightness` in `theme.css`, 95% in light mode as before and 125% in dark mode, used by `Button.tsx`, and in the spec under Buttons. `theme.test.ts` checks the dark hover changes the button at least as much as the light one, and fails with 95% in dark mode. `dark-mode.spec.ts` checks the filter on hover in both modes. A 16th picture, a hovered secondary button, recorded from the committed frontend, shows light mode's hover is unchanged.
    - Switching isn't quite instant (concern 14). Things with Tailwind's `transition` class, such as the dashboard's stat tiles and the buttons, fade to the new mode over 150ms, while the rest changes at once. Measured on a stat tile: white when the switch is clicked, `rgb(210, 210, 210)` 50ms later, black by 350ms. Agreed: left as it is, and concern 14 in the spec now says so.
- Phase 4, proof: the "screenshots for the docs" group wrote `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png` and `pipeline-dark.png` to `docs/changes/dark-mode/`.
- The light comparison matched every picture pixel for pixel, with only the switch hidden: 15 after phase 1, after phase 2 and after phase 4, then all 16 with the hovered button, twice (Nov 26, 2026). Phase 3 changed only tests, so it wasn't run on its own. One run in between had the deals table differ, which matched in the 6 runs after it. Its pictures were gone before they could be looked at, so the cause isn't known.
- `npm run check` passes: 409 Vitest tests, 180 pytest tests and 97 end-to-end tests (74 before, plus 9 in `dark-mode.spec.ts` and 14 accessibility checks in dark mode).
- Beyond the plan's list of files: `e2e/hide-dark-mode-switch.css` (the light comparison's hiding rule, since `toHaveScreenshot` takes only a file), `frontend/src/test-setup.ts` (each unit test starts in light mode), and `PAGES` moved into `e2e/fixtures.ts`. `theme.css` has four variables beyond the plan's three roles: the three shadow colors (risk 1) and the secondary hover brightness.
- Review (Nov 26, 2026), against `docs/REVIEW.md`: no Important findings. `npm run check` passed, and the light comparison matched all 16 pictures again. Two findings don't block the merge and aren't fixed:
  1. `dark-mode.spec.ts` finds the chart gridline, the funnel's Negotiation step and the chart tooltip by Recharts' class names and order, and the message by Sonner's `data-sonner-toast`. An upgrade that renamed them would fail the tests while the app still works. No other end-to-end test does this.
  2. The spec's list of color roles leaves out `logo` and the three shadow colors, and the spec doesn't give the deeper shadow's dark values.
- Improvement step (Nov 26, 2026), from `docs/IMPROVE.md`:
  - Seen twice, so now in `AGENTS.md`:
    - A test that passed with the behavior broken: the MVP's concern 8 test (review finding 17) and dark mode's first concern 14 test. `AGENTS.md` now says to show each new test can fail. A check can't do this: mutation testing would be a new dependency, and it wouldn't reach an end-to-end test of timing like concern 14's.
    - Code the spec didn't describe: the MVP's review findings 24 and 26, and finding 2 above. `AGENTS.md` now says to check the spec after each piece of work. A check can't do this either, since the spec names roles in words, not by their names in `theme.css`.
  - Seen once so far: tests that rely on a library's class names (finding 1). A wrong `toHaveScreenshot` option that tsc missed because the options were an untyped variable. A full-page screenshot resizing the window, which closes a Radix select. Screenshot runs that differed once with no known cause.
  - `docs/IMPROVE.md` now says where to look for what went wrong, to ask the person what they corrected, and to record each round in `docs/STATUS.md` like this, including the mistakes seen once.

Running the screenshots, by hand and never on CI:

- `npx playwright test -c e2e/screenshots.config.ts --grep "light mode is unchanged"` compares light mode with `tmp/light-baseline/`. Add `--update-snapshots=all` to record it again, which only makes sense from the code before a change, since that's what it compares with.
- `npx playwright test -c e2e/screenshots.config.ts --grep "screenshots for the docs"` takes the four pictures in `docs/changes/dark-mode/` again.

## Subagents (Nov 26, 2026)

The `subagents` branch, from the course's Week 1 Day 5 prompt. It changes the harness, not the app, so it has no folder in `docs/changes/` and `docs/spec.md` doesn't change. `docs/TECH_STACK.md` and `AGENTS.md` describe the two subagents and the reviewer's hook. Claude Code loads new subagents when it starts, so they need a restart before they can be used.

- `reviewer` (`.claude/agents/reviewer.md`), on Sonnet, with Read, Grep, Glob and Bash. It reviews a commit or range it's given, or else the branch against `main` plus any uncommitted work. It reads `docs/REVIEW.md`, `AGENTS.md`, the spec, the change's intent and plan, `docs/STANDARDS.md` and the change's section here, makes each pass in `docs/REVIEW.md`, checks each finding before reporting it, and reports Important findings, other findings and at most five nits, each with its file and line.
- Its hook, `scripts/claude-hooks/read-only-bash.mjs`, runs before each of the reviewer's shell commands, since a subagent's tool list can't limit Bash to some commands. It splits the command the way the shell does and refuses it unless every part is on a list of commands that only read: git's reading commands (diff, log, show, status, grep, blame, ls-files and others), `git branch` with listing flags only, grep, cat, head, tail, ls, find without `-delete` or `-exec`, sort without `-o`, uniq with one file, `sed -n 'FROM,TOp'` and a few more. It also refuses `$(...)` and backticks, `&`, subshells, here-documents, and output written anywhere but `/dev/null`. git and GNU sort accept a shortened long option, so `--out=x` counts as `--output=x`. It never allows a command itself, so the usual permission checks still apply, and if the script fails, `onFailure: block` refuses the command.
  - Checked with a table of 123 commands, from a scratch script outside the repo: the 40 that only read passed, and the 83 that write, run another program or hide a command were refused. Malformed input makes the script exit 1. Taking out the backtick check let `` echo `rm x` `` through, and taking out the `--output` check let four `--output` commands through, so the table does catch a missing check. Like the other two hook scripts, it isn't covered by `npm test`.
  - In a headless Claude session, the reviewer ran `git log --oneline -3`, and the hook refused `git branch hook-probe-should-not-exist` and `touch /tmp/...` with its own message. No branch or file was made.
- `ui-check` (`.claude/agents/ui-check.md`), on Sonnet, with Read, Grep, Glob and 14 Playwright MCP tools, leaving out the ones that type, fill forms, drag, upload files or run Playwright code. The brand skill is preloaded. It checks the pages it's asked about, or else every screen in the spec, one record page of each kind and Page not found, in light and dark mode at 1440 by 900. It reports what's broken, what's off-brand or off-spec, and small points, each with its screenshot and the rule it breaks. It turns dark mode back off at the end, since the MCP's browser keeps it. It can't start the app, so the session starts `npm run dev` first.
  - Screenshots: the Playwright MCP (0.0.86) saves a screenshot given a file name relative to the project's root, not its output folder, so `dashboard.png` would land in the root. ui-check always passes `.playwright-mcp/<page>-<mode>.png`. A screenshot saved that way landed in `.playwright-mcp/`, and `git check-ignore` confirmed git ignores it.
- `model: sonnet` follows Claude Code's Sonnet alias. On this Mac, Claude Code runs on Bedrock with only `ANTHROPIC_DEFAULT_OPUS_MODEL` set, so the alias gave Sonnet 4.5 (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) in the headless session. Setting `ANTHROPIC_DEFAULT_SONNET_MODEL` to `us.anthropic.claude-sonnet-5-5` in the user's own settings gives Sonnet 5.5, which answered a test call. The agent files keep the alias, so they work on any provider.
- CI runs `npm run check:quick` instead of `npm run check` (Nov 26, 2026), so it leaves out the end-to-end tests, which now run only locally. The step that uploaded `playwright-report/` is gone, since only the end-to-end tests write that report. Playwright still writes it locally. The timeout is now 15 minutes, down from 45: the last full run on GitHub (`dark-mode`, 8.5 minutes) spent 397 seconds on the end-to-end tests and about 1.5 minutes on every other step together. `AGENTS.md`, `docs/TECH_STACK.md` and the report's comment in `e2e/playwright.config.ts` now say so. actionlint 1.7.12 passes on the workflow, and `npm run check` passes locally (409 Vitest, 180 pytest and 97 end-to-end tests). The workflow hasn't run on GitHub yet, so the first push of this branch is its first real run.
  - The speed tests' limits (Notes on the build) were raised for GitHub's slower runner, which no longer runs them. They're unchanged.

## Spec split (Nov 26, 2026)

On the `multi-user` branch, before its plan. It moves the spec's text, not the product's behavior, so no code or tests changed.

- `docs/spec.md` is now a short summary: the problem, the product, a table of the 11 area files in `docs/specs/`, and an index of where each of the 14 concerns and the rules R1 to R14 live. The detail moved word for word into `dashboard.md`, `organizations.md`, `contacts.md`, `deals.md`, `pipeline.md`, `activities.md`, `records.md` (what every kind of record shares), `look.md`, `light-and-dark.md`, `sample-data.md` and `platform.md` (running it, quality, how it fits together, libraries, the rules every table and API route share, and the testing hooks).
- Concerns and rules keep their numbers. Each file's concerns are consecutive, so Markdown doesn't renumber them: concern 8 sits with 9 in `pipeline.md`, 11 with 12 in `records.md`, and 1 with 2 and 3 in `platform.md`.
- What changed in the words: the headings, run-in labels that became headings, references to other sections that now name the file, a line at the top of each area file pointing back to the summary, and "The API is only what's in this table", now "only what's in the API tables of the area files". The `PATCH` paragraph is split in two, its first sentence in `platform.md` and the deal rules in `deals.md`.
- Checked with a scratch script outside the repo: every non-blank line of the old spec is in the new files, except the 38 headings, labels and references above, and none is there twice except table headings and three table rows the old spec already had twice.
- `AGENTS.md` says to read `docs/spec.md` first, then only the area files a change touches, and to update every spec file a change affects. `docs/REVIEW.md`'s two spec passes cover the area files, and flag a spec file a change should have updated. `.claude/agents/reviewer.md` already reads the spec files `docs/spec.md` points to, and `ui-check.md` already reads the summary and the files for what it checks, so neither changed.

## Multi-user design (Nov 26, 2026)

On the `multi-user` branch: the spec now describes sign-in, search, the user menu, the team's time zone and the deploy to Render from `docs/changes/multi-user/intent.md`, as they will be once merged. Docs only, so no code or tests changed yet.

- New area files: `docs/specs/sign-in.md` (R15, R16, concerns 18 to 20, the users table, `GET /api/me` and the stand-in sign-in) and `docs/specs/search.md` (R18, concern 21, `GET /api/search`).
- Updated: `platform.md` (concerns 15 to 17, `npm start`, Render, the new libraries), `records.md` (R14's two exceptions, R17 for who added and changed a record), `light-and-dark.md` (Light, Dark and System in the user menu, in place of the switch), `look.md` (the top bar), `sample-data.md` (four made-up teammates), and the record pages, timelines and dashboard to show who added each record and activity. `docs/spec.md`'s summary and index list the new areas, concerns and rules.
- Still to change in the build: `docs/TECH_STACK.md` still says the app runs locally on SQLite, and `.claude/agents/ui-check.md` needs to sign in through the stand-in.

## Multi-user, phase 1: sign-in and the database (Nov 26, 2026)

Built from `docs/changes/multi-user/plan.md`, by parts A, B, C, D, G and H at the same time, with part I keeping the docs. `npm run check` passes (Nov 26, 2026), every step: 473 Vitest tests in 58 files, 378 pytest tests (96.75% coverage) and 117 end-to-end tests in 4.1 minutes, which are the sign-in setup, the 97 already there and 19 new.

- ui-check (step 8) went through the sign-in screen, with and without its wrong-password error, the Dashboard, and one organization, contact and deal page, in light and dark mode at 1440 by 900. It used `npm run dev` with the stand-in, on a throwaway database. It found nothing broken, off-brand or off-spec, no console errors and no failed requests. It measured the "Added by" and "Last changed by" lines at 12px Instrument Sans in Slate (`#4F6873`, and `#9DB1B8` in dark mode). It also checked the follow-ups' "Logged by", the names in timelines and the Raspberry error text. Its screenshots are in `.playwright-mcp/`.

**What was built:**

- Part A, the backend:
  - `psycopg[binary]`, `pyjwt[crypto]` and `tzdata`.
  - The new settings, each read when asked. `clock.py` on the team's clock, with `real_now()` the one place that reads the real clock.
  - Migration `0002_sign_in`: the users table, `created_by` and `updated_by` on the four kinds of record, and row-level security on Postgres.
  - `db.py`: psycopg for `postgresql://`, a check of each pooled connection before use, and `migrate(engine, on_new)`.
  - `auth.py`'s `SignInWall` middleware, inside the host check, with `CurrentUser`, the stand-in's tokens and Supabase's. `services/users.py` and `routers/me.py`.
  - `main.py`: the startup checks, Render's host, and serving the built frontend.
  - R17 in the four services and their routers. Who logged each activity in timelines, recent activity and follow-ups.
- Part B, the sample data: `backend/teammates.py` with the four teammates. `seed.py` loads them into users and gives every record its people: Dana 39.5%, Joel 25.5%, Nora 21.5% and Wes 13.5%, 84% of a deal's activities by whoever added the deal, and 22% of records last changed by someone else. On Postgres it moves each id sequence past the highest id, and `npm run seed` refuses a database that isn't SQLite before connecting.
- Part C, signing in: `@supabase/supabase-js`, the two build-time constants in `vite.config.ts`, and `src/auth/` (`config`, `service`, `standIn`, `supabase`, `session`, `useMe`, `SessionGate` and `SignInScreen`). `api.ts` sends the token and ends the session on a 401. A build without the Supabase settings leaves supabase-js out of the bundle.
- Part D, people and the team's clock: `src/lib/teamTime.ts` (`setTeamZone`, `teamNow`, `teamTodayISO`, with `Intl.DateTimeFormat` and no new dependency), `format.ts` and every use of the browser's clock moved onto it, `Person` in `types.ts`, `AddedBy` at the end of each record page's details, and "by Dana Holt" in timelines, recent activity and follow-ups.
- Part G, the end-to-end tests: a setup project signs in as Dana once through the sign-in screen, and every test starts from that session. The fixtures fail a test on any request off this computer, and add `signIn`, `SIGNED_OUT` and an `api` fixture signed in as Dana. New: `sign-in.spec.ts` (10 tests), `people.spec.ts` (5) and `time-zone.spec.ts` (4).
- Part H, running it: `scripts/env.mjs` reads `.env` with Node's `util.parseEnv`, and `scripts/servers.mjs` holds the port check, the wait and the stopping that `dev.mjs` and the new `start.mjs` share. A server counts as started when it answers at all (risk 7). `npm start` in `package.json`, and `render.yaml`.
- Part I, the docs: `ui-check.md` signs in through the stand-in, with `browser_type` added to its tools for the sign-in form only. It checks the sign-in screen first, and for the dark sign-in screen removes the stand-in's token from local storage, since there's no Sign out until phase 3. `docs/TECH_STACK.md` now says where the app runs. The spec files below.

**Spec files updated** for what the build settled beyond the plan:

- `sign-in.md`: the stand-in token's 12 hours, the asymmetric signing key, the keys fetched again every 5 minutes, the 503 when they can't be fetched, `/api/me`'s empty zone, the sign-in screen's messages, focus and structure, sessions ending in the browser, the stand-in's address existing only with it on, and the e2e tests' saved session.
- `platform.md`: `tzdata`, set the time zone once, `npm start`'s checks, empty settings counting as not set, Render's build and start, the app's page sent with no-cache, `postgres://`, the pre-ping, the first start's single transaction, times sent with a zone, and the tests' network checks.
- `records.md`: when "Last changed by" shows. `dashboard.md`: "· Logged by Dana Holt" on follow-ups, and the recent activity wording. `activities.md`: the name's font and no name before sign-in. `sample-data.md`: later change times, customers changed by whoever won their first deal, `--large`, and the id counters. `docs/spec.md` didn't need to change.

**Where the build differs from the plan:**

- The signing keys are fetched again once they're 5 minutes old, and for a token naming an unknown key, at most every 30 seconds: `PyJWKClient`'s defaults, which pick up a key Supabase changes. The spec said once.
- If Supabase's keys can't be fetched, the API answers 503 "Can't reach the sign-in service. Try again in a moment.", not 401, so a network blip doesn't sign anyone out. The browser shows its usual "Can't reach Accountable's server".
- Row-level security is turned on for a fixed list of tables in `0002`, not the metadata's, since a table a later migration adds wouldn't exist yet when `0002` runs. The test renders every migration's Postgres SQL offline and checks it covers every table in `tables.py` plus `alembic_version`.
- On SQLite, `foreign_keys_off()` now opens the transaction itself with `BEGIN`. SQLite's driver committed each `CREATE TABLE` on its own, so a failed sample-data load left tables with no Alembic version, and the next start crashed with "table organizations already exists" (reproduced).
- SQLAlchemy 2.1 already picks psycopg for `postgresql://`, so the plan's "would otherwise pick psycopg2" no longer holds. The driver is named anyway, and `postgres://`, which SQLAlchemy refuses, is accepted.
- The Playwright config deletes `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from its own environment, since Playwright adds its whole environment to every server it starts, whatever their `env` says.

**Decisions the lead made during the build:**

- The e2e saved session is in `<os.tmpdir()>/accountable-e2e-<first 8 hex characters of sha256(repo root)>/dana.json`, not the plan's `e2e/.auth/dana.json`. `gitleaks dir` scans git-ignored files too (checked in a scratch repo: a git-ignored file with a stand-in token was flagged), and its `jwt` rule flags the token. No gitleaks config changed, and the plan's `.gitignore` line for `e2e/.auth/` was left out.
- Playwright's `outputDir` moved to the same folder (`test-results/`, and `screenshot-results/` for the screenshots config). While a test runs, Playwright writes its raw trace with each request's `Authorization` header, and a run killed partway left them in the repo for the next gitleaks scan to fail on. `playwright-report/` stays in the repo, since its traces are zipped. A test failed on purpose put its trace in the temp folder, and gitleaks found nothing in the repo.
- Existing tests changed, where the plan said they'd pass with no change. Only how they reach the API, or one match, changed: no expectation, step or test name.
  - `activities`, `dashboard`, `pipeline-drag` and `won.spec.ts` called the backend from Node with no token and got 401. They now use the `api` fixture.
  - `deals.spec.ts:88` has `{ exact: true }`, since the new "Last changed by Dana Holt on Jun 13, 2026" has the same date as the close date.
- Files no part owned, changed only for an interface change: `frontend/src/features/dashboard/chartData.test.ts` (`created_by: null` on two fixtures), and `test_activities`, `test_contacts_rules`, `test_dashboard`, `test_deletes`, `test_deals_rules`, `test_followups` and `test_timeline`, which now pass `by=DANA.id` to the services. The services keep `by` required, so a route can't leave it out.

Within the parts' own files, two existing tests in `api.test.ts` now also expect the token header, and `DealList.test.tsx` takes this year from `teamNow()`.

**Files beyond the plan's list:** `frontend/src/auth/service.ts` (the type both sign-ins follow, so `standIn.ts` and `supabase.ts` don't import `session.ts`), `frontend/src/auth/config.test.ts`, `scripts/servers.mjs`, and the test files above. `.gitignore` didn't change.

**What each new test broke to fail.** Each was run with the behavior broken on purpose, then the code was put back. Part A made 75 breaks in a copy of `backend/` under `/tmp`, and each failed its tests:

- `test_clock.py`, `test_settings.py`: UTC in place of the team's zone, or of the computer's without one; noon made midnight; a setting read once and cached; not trimmed.
- `test_startup.py`: each check off; the stand-in allowed with Postgres; a bad zone let through.
- `test_auth.py`: each of the issuer, audience, role, anonymous user, expiry and signature not checked; a token with no key id read unsigned; a shared-secret key trusted; no email or id let through; the keys fetched on every request; no `apikey` sent; the stand-in's key the same every start; its tokens lasting 24 hours; its expiry, signature or issuer not checked; the person taken from the query; 401 in place of 503; conftest's network guard not recording.
- `test_sign_in_wall.py`: only two routes behind the wall; pages behind it too; the stand-in's sign-in closed, or open with Supabase. The route list also failed for real when it was found with `isinstance(route, APIRoute)`, since FastAPI 0.165 nests included routers.
- `test_people.py`: initials from one word; spaces not trimmed or counted as a name; no 120 cut; never updated, or written on every request; a plain insert, so two first requests clash.
- `test_me.py`: no zone; the email's case mattering; any email or password; the body taking any field.
- `test_who.py`: `updated_by` not set by a change in each service, by adding, by a stage change or by a won deal's contact; moving within a column counted as a change; renumbering or emptied links setting `updated_at`; unknown fields allowed; no one shown as an empty person; timelines, follow-ups or lists losing the people; a status change given a person.
- `test_one_server.py`: no app page; the page cacheable; built files not served, or files outside the build served; long names and null bytes unguarded; `/api` given the page; served without a build; Render's host refused, or any `onrender.com` allowed; conftest not hiding a real `frontend/dist`.
- `test_db.py`, `test_migrations.py`, `test_api.py`: `postgres://` left to SQLAlchemy; no pre-ping; everything counted as SQLite; no index or foreign key on the people columns; old records given a made-up person; users or `alembic_version` left out of row-level security; row-level security sent to SQLite; `on_new` on every start, or in its own transaction; SQLite's `BEGIN` removed; a zoned time converted to the computer's zone.
- `test_seed.py` (part B): no teammates in users, or users not loaded; a teammate id that doesn't start with zeros; a contact named Wes Moreno; equal shares; the deal adder's chance at 0; someone else changing 40%; no later change time; no customer step; an unseeded generator; every `--large` record given to Dana, or people chosen after the `--large` records; the activities table's sequence skipped; the SQLite check removed, or refusing SQLite.
- `src/auth/` and `api.test.ts` (part C): no token sent, or one sent with sign-ins; no `refused()` on a 401, or one for sign-ins; the 401 branch removed; Vitest reading the shell's Supabase settings; no cache clearing; the stand-in's token kept in memory, or not removed on sign-out; the service not told on a 401; no "ended" message, or not announced; no focus on Email; the wrong autocomplete; Enter not submitting; the button not disabled while busy; the password not cleared, or cleared after any error; the error not announced; the small print always the normal line; the panel without its name; the sign-in screen shown while checking; the app drawn before `/api/me`; `setTeamZone` not called; no unreachable message; every Supabase error counted as wrong details, or every API error (429 caught it); `detectSessionInUrl` removed; sign-out on every device; the token not read from the session; Supabase's `SIGNED_OUT` ignored. Removing a separate busy guard in the submit handler failed nothing, since the disabled button already stops Enter, so the guard was deleted as dead code.
- Part D: `setTeamZone` ignoring the zone; `hourCycle: 'h23'` removed; the browser's date a day off; `new Date()` as the defaults in `format.ts`, in `localMinute`, in `DealForm`, `Board.tsx` and `deals/queries.ts`, or in `shortDate`; `AddedBy`'s second line always shown, or comparing only the person or only the time, or no early return; `AddedBy` removed from each record page, or moved above the deal's details; the name removed from timelines, follow-ups and recent activity, or forced onto stage changes. The source check for `new Date()` caught a real one in `DealList.test.tsx`, then one put back on purpose in `format.ts`.
- Part G, from the test side: signed in first; `/` opened in place of `/deals/12`; the normal small print expected; a valid token sent to the 401 checks; the right password; a password field put in `#root` for a moment; the token not spoiled; dark not chosen; a low-contrast paragraph for axe, in each mode; every API reply's people set to null; "Last changed by" forced onto a record never changed; Dana in place of Joel; the dashboard reply's `today` moved on; `/api/me` answering no zone; a temporary test fetching `example.supabase.co`, which the off-machine check failed.

**The slowest unit tests** (risk 17), all under a second:

- pytest, `uv run pytest --durations=10 -q`, while other parts were testing: 378 passed in 8.05 seconds, the slowest 0.17 seconds (a setup in `test_api.py`), then 0.14 to 0.08 seconds. On a quiet machine the run took about 4.5 seconds, the slowest 0.08 seconds.
- Vitest, `npx vitest run --reporter=verbose` without coverage, also while other parts were testing: 473 passed in 23 seconds. The slowest were 626ms (`Board.test.tsx`, a drag onto a card in another column), 586ms and 557ms (`DashboardPage.test.tsx`), 517ms (`ContactForm.test.tsx`), then 395ms and under.

**Still to do or check:**

- The person sets up the Supabase project, as under Supabase and Render, and fills in `.env`. Part H's runs found `.env` had no `ACCOUNTABLE_TIMEZONE`. It's set now, to `America/Los_Angeles` (after phase 3). The project's other setup steps are checked by criterion 6's run.
- Criterion 1: the person runs `npm run check` three times, with the four settings in `.env`, with them exported in the shell, and with Wi-Fi off. Not run yet.
- Criterion 6: the person runs the checklist in the plan's Proof with `npm start` against Supabase, apart from its two phase 3 items. Not run yet. That run also shows whether the key address needs the `apikey` header (it's sent either way), and tries row-level security, the pooler, psycopg and the id sequences, which no test reaches.
- The Render region and the team's time zone: both set after phase 3. The region is `ohio`, the nearest to the Supabase project in us-east-2, and the zone is `America/Los_Angeles`, the same in `.env` and `render.yaml`.
- Maybe a certificate problem on this Mac: uv's Python checks HTTPS against `/etc/ssl/cert.pem`, which lacks the root behind Cloudflare's certificates. `supabase.co` itself verifies fine. If the key fetch fails with CERTIFICATE_VERIFY_FAILED, the API answers 503 and the backend logs why.
- `frontend/dist` after `npm start` holds the Supabase URL and publishable key. gitleaks' files scan does read git-ignored files, so it reads them. A build with a fake key in the publishable key's format, scanned outside the repo, had no findings, since the key is a bare string with no name beside it. Criterion 1's first run, after a real `npm start`, will show it for the real key.
- Seen once, early, while part B was still changing the seed: a reseed in the e2e tests failed with "FOREIGN KEY constraint failed" on organizations. It hasn't come back in any run since.
- Vite warns on every build about a chunk over 500 kB. It did before this change.

## Multi-user, phase 2: search (Nov 26, 2026)

Built by parts A, E and G at the same time, with part I keeping the docs. `npm run check` passes (Nov 26, 2026), every step: 503 Vitest tests in 61 files, 409 pytest tests (96.88% coverage) and 127 end-to-end tests in 4.9 minutes, which are phase 1's 117 and 10 new.

- ui-check (step 4), at 1440 by 900 in light and dark mode, on a throwaway database, looked at:
  - the top bar on the Dashboard, the Deals list and a deal page
  - the results list for "ri" and for "zzz"
  - Down and Escape

  It found nothing broken, off-brand or off-spec. It measured the search box at 400 by 36, the list 480 wide with 48px results, and the 24px gap to the page header. Its screenshots are in `.playwright-mcp/`.
- ui-check also made two claims that were wrong. It reported an initials button, which doesn't exist until phase 3. It also said `/` typed in a text area went to the search box. Checked in the browser, "a/b" typed in an activity's Description kept all three characters there, and `/` with nothing focused moved focus to the search box without typing itself.

**What was built:**

- Part A, the backend:
  - `services/search.py` (R18, concern 21) reads the id and name of every organization, contact and deal, folds each with `str.lower()`, and matches, sorts and counts in Python. Nothing goes through `LIKE`.
  - Only the top 5 of each kind get their second line's fields, in one query per kind. The queries use outer joins, so a contact or deal with no organization is still found.
  - `routers/search.py` serves `GET /api/search`, with an optional `q` of up to 200 characters. The reply's schemas are in `schemas.py`, and `main.py` includes the router.
  - `/api/search?q=a` joined the endpoints `test_speed.py` holds under 300ms with the `--large` data. `test_sign_in_wall.py` found the new route by itself.
- Part E, the frontend:
  - `app/TopBar.tsx` is a search area labelled "Search", above every page. `AppShell.tsx` puts it outside `<main>`, in the same 1440px column as the page.
  - `features/search/`:
    - `types.ts`
    - `queries.ts`: `useSearch` waits for typing to pause, gives each search its own key, and keeps the last results while the next ones load
    - `highlight.ts`
    - `SearchBox.tsx`, with cmdk told not to filter or sort
- Part G, the end-to-end tests:
  - `search.spec.ts` (6 tests)
  - `searchBox()` and `searchResults()` in the fixtures
  - one test each in `speed.spec.ts` and `keyboard.spec.ts`
  - one in `accessibility.spec.ts` for each mode
- Part I, the docs:
  - `search.md`: the 150ms wait, the second line leaving out what a record doesn't have, equal names in the order they were added, the highlighted result's focus ring, no list with no results, the announcement, the landmark and the labels, what counts as a field for `/`, Home and End, and the API's limits and empty replies
  - `look.md`: the top bar sits outside the main area, so "Skip to content" goes past it
  - `docs/spec.md` didn't need to change

**Beyond the plan:**

- The search box waits for typing to pause for 150ms before it searches, so a word sends one request, not one per letter, which matters on Render and Supabase.
- When the box is emptied, by Escape or by choosing a result, the empty search's own results are none. Without that, the next search briefly showed the results from before it.
- The box is the search box's own `<input role="combobox">` inside cmdk, not cmdk's `Command.Input`, which always says it's expanded.
- The highlighted result starts again in a fresh list each time new results come in, so screen readers are never pointed at a result that's gone, which axe flags. For the same reason there's no list at all with no results, only the message.
- Home and End move the cursor in the box. cmdk would otherwise take them for the highlight.
- The highlighted result has the 2px Cerulean focus ring as well as the tint, as picker options have had since the MVP's review.
- Names that sort the same are ordered by id. No `q` is the same as an empty one, so it isn't a 422.
- No existing test changed, unit or end-to-end. The `[cmdk-input]` scoping the lead had approved for the picker locators wasn't needed, since the search box doesn't carry it. No file outside the plan's list changed.

**What each new test broke to fail.** Each was run with the behavior broken on purpose, then the code was put back:

- `test_search.py` (part A, 29 tests, in a copy of `backend/` under `/tmp`):
  - the names or the search not folded, or only A to Z folded, as SQLite does
  - `%` and `_` as wildcards
  - spaces not stripped, or the spaces inside collapsed
  - an empty search finding everything, or every name matching
  - no 200-character limit
  - 10 of each kind, or a total counting only those shown
  - no starts-with-first, sorting by case, or the top 5 in the database's order
  - an inner join
  - the wrong field on the organization's second line
  - A 310ms sleep failed the speed test, and `/api/search` left outside the wall failed the wall test.
  - The first starts-with-first break failed nothing, since the test's names sorted the same either way. "Alban Group" and "Alan Brown" were added, which contain the search but sort before the names that start with it, and then both order tests failed.
- Part E's unit tests: a scratch script broke each of 34 behaviors in turn under the lock, and every one failed its tests:
  - the hint shown with text in the box
  - no trimming, or no wait
  - no "5 of 12"
  - empty parts kept in the second line, no semibold, or the wrong icon
  - the results sorted in the browser
  - an empty list in place of the message
  - no status
  - the arrows not reaching cmdk
  - the highlight not starting again, or no `aria-activedescendant`
  - the text left after choosing
  - no `preventDefault` on the list's mousedown
  - Escape ignored
  - Home and End reaching cmdk
  - the list kept open on blur, or the old highlight kept
  - no `keepPreviousData`, one key for every search, or no `initialData` for the empty search
  - `/` typing itself, `/` taken in fields, or modifier keys ignored
  - in `highlight.ts`: the match moved one place, case not folded, spaces kept, an empty search matching, or no length check
  - no `role="search"`, the top bar inside `<main>` or taken out of the shell, and the deals icon swapped
- Part G, from the test side:
  - an intercept emptied the reply's contacts, reversed the deals or added a result
  - Down not pressed
  - `/` pressed with focus on the page instead of the table's search box
  - the box clicked instead of away
  - each reply held back 1.6 seconds, which the speed test failed at 1798ms
  - the search box left out of the expected Tab order
  - a low-contrast line added to the open list, in each mode

**Speed:**

- The top bar's search took 186ms and 199ms in two runs, from the last key to the results with 500 of each kind. That includes the 150ms wait, and the spec promises half a second. The end-to-end test fails past 1.5 seconds, three times the promise, the same rule as the other speed tests, which the lead approved.
- On the backend, the worst case, `q=a` with the `--large` data (333, 432 and 515 matches), took about 3ms in the test client, against the 300ms limit (risk 15).
- The slowest unit tests, all under a second:
  - pytest ran 409 tests in 4.09 seconds, the slowest 0.05 seconds.
  - Vitest, `npx vitest run --reporter=verbose` without coverage on a quiet machine, ran 503 tests in 14 seconds. The slowest were 314ms (`Board.test.tsx`, a drag onto a card in another column), 288ms (`DashboardPage.test.tsx` and `ContactForm.test.tsx`), then 266ms and under. The slowest search box test took 107ms.

**For later test writers:** Vitest's fake timers need `vi.stubGlobal('jest', { advanceTimersByTime })` for Testing Library's user-event and `waitFor` to move them on. `SearchBox.test.tsx` does this, and `unstubGlobals` puts it back after each test.

**Seen, not fixed:**

- At 1440 wide, the dashboard scrolls 28px sideways. Its chart tables for screen readers are `sr-only` with no positioned ancestor, so they stretch past the right edge (`components/ChartTable.tsx`). The phase 0 light baseline, `tmp/light-baseline/the-dashboard.png`, is 1463px wide too, so it was there before this change.
- The top bar has no landmark of its own around it, so from phase 3 the initials button sits outside any landmark. The axe tags the tests use leave out the best-practice `region` rule, so nothing fails. The top bar could become a `<header>`. (Phase 3 made it one.)

## Multi-user, phase 3: the user menu (Nov 26, 2026)

Built by parts E, F and G at the same time, with part I keeping the docs. `npm run check` passes (Nov 26, 2026, after the skip-link waits below), every step: 536 Vitest tests in 62 files, 409 pytest tests and 135 end-to-end tests in 4.4 minutes, which are phase 2's 127 less `dark-mode.spec.ts`'s 9, and 17 new.

- ui-check (step 4), first run, at 1440 by 900: the sign-in screen, the Dashboard, a deal's page and the open user menu, in Light, Dark and System, with System checked on a dark device and with the device switched to light while the page was open. It found nothing broken, off-brand or off-spec. System followed the device without a reload, the menu's dividers show in dark mode, and the sidebar has no switch.
- ui-check's second run covered Organizations, Contacts, Deals and the Pipeline, an organization's and a contact's page, and Page not found, each in Light, Dark and System on a dark device. It also checked the sign-in screen in System on a dark device. It found nothing broken, off-brand or off-spec. System matched Dark on every page, and every page had the top bar with the search box and the DH button, with no switch in the sidebar. The record pages had "Added by" and "Last changed by". The console had no errors, and every API request answered 200. Together, the two runs cover every page in all three modes. The screenshots are in `.playwright-mcp/`.

**What was built:**

- Part F, the theme choice:
  - `src/lib/colorMode.ts`: the choice is light, dark or system, with `currentChoice()` and `setChoice()` in place of `currentMode()` and `setMode()`. It keeps the choice on `<html>` as `data-theme-choice`, applies it at once and saves it under `accountable-mode`.
  - The inline script in `index.html`: it takes only exactly `dark` or `system`, sets `data-theme-choice` on every load, and is the one listener for the device's setting. The listener reads the choice from `<html>` each time, so it follows a choice made in the menu, even when the browser won't save.
  - `src/app/ThemeChoice.tsx`: the "Theme" label, and Light, Dark and System as a radio group with their icons and a check on the chosen one. The menu stays open after a choice.
  - `DarkModeSwitch.tsx` and its test deleted, at the moment part E took the switch out of `AppShell.tsx`.
- Part E, the user menu:
  - `src/app/UserMenu.tsx`: the initials button, with its tooltip, and the menu, with the name and email, `<ThemeChoice />` and Sign out, from Radix's DropdownMenu.
  - `TopBar.tsx`: the top bar is now a `<header>`, with the search area on the left and the initials button on the right.
  - `AppShell.tsx`: the sidebar holds only the wordmark and the five sections.
- Part G, the end-to-end tests:
  - `user-menu.spec.ts` (4 tests).
  - `theme.spec.ts` (11 tests) replaces `dark-mode.spec.ts` (9), written anew as the plan's rename. It adds "the user menu is Midnight" in dark mode.
  - The fixtures: `turnOnDarkMode` chooses Dark in the menu, and there are new helpers for the initials button, the menu, its theme items, opening it and signing out.
  - `accessibility.spec.ts` checks the open menu in each mode, and `keyboard.spec.ts`'s Tab order has the initials button after the search box.
- Part I, the docs:
  - `ui-check.md` checks every page in Light, Dark and System. It sets the device's scheme with `browser_emulate_media`, newly in its tools, and checks the sign-in screen in other modes through the real Sign out, so it no longer writes to local storage. It leaves the theme as it found it.
  - `sign-in.md`: the button's spoken name, focus on Light when the menu opens, Tab and a click outside, and the menu not being modal.
  - `look.md`: the top bar as the banner landmark, and the divider raised role.
  - `light-and-dark.md`: divider raised's dark value, exactly which saved values count, `data-theme-choice` and the one listener, the label's size, and the storage key.

**Beyond the plan, with the lead's decisions:**

- The initials button is named "Account, Dana Holt, DH", or "Account, sam@example.com, S" with no display name, where the plan had "Account, Dana Holt". axe's `label-content-name-mismatch` (WCAG 2.5.3, label in name) failed the old name on every page in both modes, which broke all the existing axe tests. Hiding the initials from screen readers didn't help, since axe compares the name with what's on screen.
- The menu is `modal={false}`. Radix's modal menu sets `aria-hidden` on the app while its links can still take focus, which axe reports as `aria-hidden-focus`. Focus still moves into the menu, stays there with Tab, and goes back to the button on Escape, and a click outside closes it.
- The top bar is a `<header>`, the page's banner landmark, so the initials button is inside a landmark.
- `theme.css` changed, where the plan said it wouldn't: a new role, `--color-divider-raised`, for the menu's dividers on the raised surface. In dark mode the divider was 1.07:1 against Midnight, and no existing role works in both modes. Its light value is the divider's `#E3EAEC`, and its dark value the page's `#04232E`, 1.35:1 on Midnight. `theme.test.ts` lists the role and checks, in both modes, that a menu's divider shows on the raised surface at least as well as light mode's divider shows on the panel. No check was loosened.
- `frontend/src/test-setup.ts` does two more things:
  - After each test it also removes `data-theme-choice`. Without that, a choice leaked into the next test.
  - It stubs `window.matchMedia` as a light device, since jsdom has none and `setChoice('system')` would throw in any unit test. A test that needs another device stubs its own.
- Only the inline script listens for the device's setting, agreed with the lead, so a bug in one listener can't be hidden by the other.
- Files deleted: `DarkModeSwitch.tsx` and `DarkModeSwitch.test.tsx`, `e2e/dark-mode.spec.ts` (now `theme.spec.ts`), and `e2e/hide-dark-mode-switch.css`, which hid the switch for the light comparison. In `e2e/screenshots.ts`, `EXACTLY` no longer passes `stylePath`, and two comments changed.

**Existing tests changed** (no check changed in any of them):

- `sign-in.spec.ts`: the dark sign-in screen test and the two axe tests of the sign-in screen sign out with the real Sign out. Until phase 3 they forgot the saved token and reloaded (risk 19). Their block is renamed "when the session ends or someone signs out".
- `people.spec.ts`: Joel signs out with Sign out before Dana signs in, in place of clearing local storage and reloading.
- `keyboard.spec.ts`: phase 2's Tab order has the initials button after the search box, in place of the Dark mode switch's stop.
- The existing dark-mode axe and color checks turn dark on through the menu, by way of `turnOnDarkMode`.
- `AppShell.test.tsx`: "the sidebar has the Dark mode switch" became "the sidebar holds only the wordmark and the five sections". It and `TopBar.test.tsx` now start with the signed-in person as data, since the shell reads `/api/me`. `colorMode.test.ts` was rewritten for the three choices.
- The skip-link race: `keyboard.spec.ts` "criterion 8: the skip link…" and `first-run.spec.ts` "a skip link comes first" failed 3 times in 20 repeats, with nothing being saved. They opened `/` and pressed Tab before the app had drawn. Since phase 1 the page shows only its background until `/api/me` answers, as the spec intends. Over 30 loads, the app had drawn by the Tab 25 times, and the skip link got focus. The other 5 times focus stayed on the page's body. Each test now waits for the Dashboard heading before its first Tab (`keyboard.spec.ts:25`, `first-run.spec.ts:92`), with no check or step changed. After that, 40 of 40 repeats passed, and so did a full run of 135 in 4.3 minutes.

**What each new test broke to fail.** Each was run with the behavior broken on purpose, then the code was put back:

- Part E (22 breaks, each run by a scratch script under the lock):
  - the initials left out of the button's name, or the name shown in place of the initials
  - the email in the tooltip
  - key presses swallowed on the button
  - no `aria-labelledby` on the menu
  - `ThemeChoice` or a divider left out, or the theme items left out
  - no semibold on the name
  - the email line always shown, or the old name without the initial
  - the menu made modal again
  - focus not sent back after Escape
  - Sign out doing nothing, or without its icon
  - a button drawn before `/api/me` answered
  - the top bar a `<div>`, or the initials button first
  - a switch put back in the sidebar
  - `divider-raised`'s light value removed, or its dark value set to the old divider
- Part F:
  - in `colorMode.ts`: System ignoring the device, no save, no mark on `<html>`, the save not guarded, a default of system, the mode returned in place of the choice, and another storage key
  - in the inline script: `system` not taken, the saved value lower-cased, the device applied whatever the choice, `getItem` not guarded, no listener, and a listener using the choice from load in place of the one on `<html>`
  - in `ThemeChoice.tsx`: no `aria-labelledby`, the menu closing after a choice, the check not moving, the mode not changing, and the chosen item always starting at Light
  - The proof that System keeps following the device after it's chosen in the menu is "follows the device after System is chosen in the app, and stops after Light or Dark is". It fails with the inline listener removed, and with one that reads the choice from load.
- Part G, from the test side:
  - `/api/me` answered with Joel
  - the first Down skipped
  - a deal's name put back on the page after Sign out
  - the saved theme removed after Sign out
  - Dark saved before the page loaded
  - local storage refusing to save
  - Dark chosen in place of System
  - the saved choice removed before the reload
  - the menu not opened
  - dark mode not turned on before the color checks
  - the initials button expected before the search box
  - a low-contrast line added to the open menu, in each mode
  - One timing fix in the new keyboard test, approved by the lead: after each Escape it waits for focus to come back to the button, as the spec says, since Radix moves focus on a timer.
- While part E was saving `AppShell.tsx` and `theme.css`, the existing keyboard test "criterion 8" failed twice on its first Tab. The cause turned out to be the skip-link race under Existing tests changed, not the saves.

**Speed:**

- The top bar's search took 187ms in this run's speed test.
- Vitest, `npx vitest run --reporter=verbose` without coverage, while ui-check was running on the dev server: 536 tests in 20 seconds.
  - The slowest were 415ms (`ContactForm.test.tsx`, a new contact sending every field) and 362ms (`PipelinePage.test.tsx`), then 360ms and under.
  - The slowest new tests were `ThemeChoice.test.tsx` at 244ms and `UserMenu.test.tsx` at 171ms. Part E and part F measured theirs at under 60ms on a quiet machine.
- pytest is unchanged from phase 2.

**Seen, not fixed:**

- The light-mode screenshot comparison's baseline in `tmp/light-baseline` was taken before the dark mode change. It has no top bar, user menu or "Added by" lines, and the dashboard alone is 60px shorter and 20% different. Retake it with `npx playwright test -c e2e/screenshots.config.ts --update-snapshots` before using it to check that a later change leaves light mode alone. Nothing is injected any more, so the earlier note about the stylesheet shifting two pipeline cards no longer applies. Don't run the "screenshots for the docs" group for now, since it would overwrite `docs/changes/dark-mode/*.png` with pictures that show the top bar.
- The activity menu in `Timeline.tsx` is a modal DropdownMenu too. axe reports `aria-hidden-focus` while it's open, as the user menu's did, but no test runs axe with it open. `modal={false}` would fix it.
- The dashboard's 28px of sideways scroll at 1440 wide, from phase 2, is still there.

**Success criteria for the multi-user change** (`docs/changes/multi-user/intent.md`):

| Criterion | Covered by | Not covered by a test |
|---|---|---|
| 1. `npm run check` passes and never touches Supabase | `npm run check`; the backend tests fail on any network connection, and the end-to-end tests on any request off this computer | The person's three runs: with the settings in `.env`, exported in the shell, and with Wi-Fi off |
| 2. Signed out, the sign-in screen and 401s; signed in, everything as before | `test_sign_in_wall.py`, `sign-in.spec.ts`, and every existing test passing signed in, with the changes listed in each phase | |
| 3. Every record and activity shows who added it | `test_who.py`, `test_seed.py`, `AddedBy.test.tsx`, `people.spec.ts` | |
| 4. Search by part of a name, in any case | `test_search.py`, `SearchBox.test.tsx`, `search.spec.ts` | |
| 5. The theme choice is remembered, and System follows the device | `colorMode.test.ts`, `ThemeChoice.test.tsx`, `theme.spec.ts`, `user-menu.spec.ts` | |
| 6. The built app runs here the way Render runs it, against Supabase | `test_one_server.py`, `test_startup.py` | The person's checklist with `npm start`, below |

**Still to do, by the person:**

1. Check the Supabase project's setup and `.env`'s other three settings, as under Supabase and Render. `ACCOUNTABLE_TIMEZONE` is already set.
2. Criterion 1: run `npm run check` three times, with the four settings in `.env`, with them exported in the shell, and with Wi-Fi off.
3. Criterion 6: run `npm start` against Supabase and check that:
   - it stops, naming the setting, when one is missing from `.env`
   - the sign-in screen shows the normal small print, with no stand-in
   - the person added in Supabase signs in and sees the sample data, with their display name and email in the user menu, and their initials on its button
   - a wrong password shows "Wrong email or password."
   - a refresh and a restart of Chrome keep them signed in
   - adding an organization works right after the first start (risk 2), and after a restart it's still there
   - `curl` to `SUPABASE_URL/rest/v1/deals`, with the publishable key, gets no rows (concern 17)
   - `/deals/12` opened directly works after a refresh
   - Light, Dark and System in the user menu each work, and the choice stays after a reload
   - Sign out shows the sign-in screen
4. At Deploy, after the review: create the Render service as under Supabase and Render.

The Render region and the team's time zone are both set. The Supabase project is in us-east-2, so `render.yaml`'s region is `ohio`. `ACCOUNTABLE_TIMEZONE` is `America/Los_Angeles` in `.env`, which the lead confirmed through `npm run dev`'s `/api/me`, and in `render.yaml`.

## Success criteria and their tests

The MVP's success criteria, from `docs/changes/mvp/intent.md`.

| Criterion | Covered by | Not covered by a test |
|---|---|---|
| 1. One command, lands on the dashboard with sample data | `first-run.spec.ts`; the first run from nothing was checked by hand on a Mac | Windows and Linux, which haven't been tried yet |
| 2. Add, find, sort, edit, delete; kept after a refresh and a restart; reset | `organizations`, `contacts`, `deals` and `reset` specs; `test_db.py` for a restart | |
| 3. Status filter, linked records on each page | `contacts.spec.ts`, `organizations.spec.ts`, `ContactsPage.test.tsx` | |
| 4. Dragging changes stage and probability, places stay, figures change at once, late deals stand out | `pipeline-drag.spec.ts`, `won.spec.ts`, `deals.spec.ts`, `boardRules.test.ts` | |
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
- The speed tests time each screen opened from the sidebar and reloaded, not a brand-new browser fetching every file from the dev server for the first time, which takes about a second on its own. They don't record a Playwright trace, which nearly doubles a reload's time (about 930ms against 520ms for the Deals table with 545 rows). They fail past 3 seconds a screen and 2 seconds for the search, the same on every machine, since GitHub's runner is two to three times slower than a typical laptop. Each prints its times, to compare with the spec's one second: on a 2026 Mac, 150 to 820ms a screen and 855ms for the search.
- `Board.tsx` is imported with its extension, because on Mac and Windows `./Board` would find `board.ts` first.
- `theme.css` uses `@theme static`, because Tailwind 4 otherwise leaves out theme variables that no utility class uses, and the stage and status roles are used through `var(...)`.
