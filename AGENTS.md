# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: a short summary of the whole product as it stands today, with an index of the area files and of the numbered concerns and rules. Read it first.
- `docs/specs/`: the detail of the spec, in one file per product area, such as `docs/specs/deals.md`. After `docs/spec.md`, read only the area files the current change touches.
- `docs/changes/<branch name>/`: one folder for each change, named after its branch, with the change's `intent.md` (what it's for) and `plan.md` (how it gets built). Read only the folder for the branch you're on. The others are past changes, which the spec already describes.
- `docs/TECH_STACK.md`: the stack
- `docs/STANDARDS.md`: how to write code in this repo
- `docs/STATUS.md`: what's done so far
- `.claude/agents/`: two subagents. `reviewer` reviews a change against `docs/REVIEW.md`, and `ui-check` checks the running app in the browser against the brand skill and the spec. Neither changes any code.

Update `docs/STATUS.md` when you finish a piece of work. Then check that the spec describes everything the change does, including anything beyond its plan, such as a new theme role or a limit the code enforces. In the same change, update every spec file it affects: the area files in `docs/specs/`, and `docs/spec.md` when the product summary, the list of areas or the index of concerns and rules changes. A new area gets its own file and a line in the index.

At Deploy, after the review fixes and before the merge, follow `docs/IMPROVE.md`.

## Checks

- `npm run check` runs every check: gitleaks over the git history and the files, Prettier and ESLint for the frontend, ruff format and ruff check for the backend, tsc and ty, and `npm test`. It runs them all even if one fails, prints a summary, and exits with 1 if any failed.
- Run `npm run check` before calling a piece of work done, and fix every failure first. Don't skip, delete or loosen a test, and don't weaken a rule with a disable comment, a config change or a coverage exclusion. If a rule doesn't suit the code, ask first.
- `npm run check:quick` is the same without the end-to-end tests, for quick feedback while working. `npm run format` fixes the formatting.
- ESLint and ruff allow a cyclomatic complexity of at most 15 per function.
- Hooks: a git pre-commit hook (lefthook) formats the staged files, then runs lint, types and gitleaks. Claude Code runs `npm run check:quick` when it finishes a turn and gets any failure back once to fix. A hook blocks every edit to `.env`, and any shell command that names it. The reviewer subagent has its own hook, which refuses any shell command that doesn't only read. Don't skip or loosen a hook either. To change `.env`, tell the person what to change.
- CI (`.github/workflows/ci.yml`) runs gitleaks, then `npm run check:quick`, on every push to any branch. It leaves out the end-to-end tests, so they run only locally, in `npm run check`. If CI fails but passes locally, find the root cause in the run's log, and fix it without weakening a test.

## Tests

- `npm test` runs every test: the frontend unit tests (Vitest), the backend tests (pytest) and the end-to-end tests in Chrome (Playwright). It runs all three even if one fails, prints a summary, and exits with 1 if any test failed.
- The unit tests fail if their coverage is under 80% (statements, branches, functions and lines for Vitest; lines and branches together for pytest).
- A test left with `.only` fails the run, because it would skip every other test.
- Show that each new test can fail: run it once with the behavior it checks broken or missing on purpose, then put the code back, and say in `docs/STATUS.md` what you broke. A test that passes either way proves nothing.
- It uses its own database and ports (8100 and 5273), so it never changes your data and works while `npm run dev` is running.
