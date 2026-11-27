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
- `npm run check` runs gitleaks, Prettier, ESLint, ruff format, ruff check, tsc, ty and `npm test`, and fails if any of them fails. `npm run check:quick` is the same without the end-to-end tests. It needs gitleaks, installed once with `brew install gitleaks` on a Mac or `winget install -e --id Gitleaks.Gitleaks` on Windows. The pre-commit hook needs it too.
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
