# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: the whole product as it stands today. Read it first.
- `docs/changes/<branch name>/`: one folder for each change, named after its branch, with the change's `intent.md` (what it's for) and `plan.md` (how it gets built). Read only the folder for the branch you're on. The others are past changes, which `docs/spec.md` already describes.
- `docs/TECH_STACK.md`: the stack
- `docs/STANDARDS.md`: how to write code in this repo
- `docs/STATUS.md`: what's done so far

Update `docs/STATUS.md` when you finish a piece of work

## Checks

- `npm run check` runs every check: gitleaks over the git history and the files, Prettier and ESLint for the frontend, ruff format and ruff check for the backend, tsc and ty, and `npm test`. It runs them all even if one fails, prints a summary, and exits with 1 if any failed.
- Run `npm run check` before calling a piece of work done, and fix every failure first. Don't skip, delete or loosen a test, and don't weaken a rule with a disable comment, a config change or a coverage exclusion. If a rule doesn't suit the code, ask first.
- `npm run check:quick` is the same without the end-to-end tests, for quick feedback while working. `npm run format` fixes the formatting.
- ESLint and ruff allow a cyclomatic complexity of at most 15 per function.
- Hooks: a git pre-commit hook (lefthook) formats the staged files, then runs lint, types and gitleaks. Claude Code runs `npm run check:quick` when it finishes a turn and gets any failure back once to fix. A hook blocks every edit to `.env`, and any shell command that names it. Don't skip or loosen a hook either. To change `.env`, tell the person what to change.
- CI (`.github/workflows/ci.yml`) runs gitleaks, then `npm run check`, on every push to any branch. If it fails there but passes locally, find the root cause in the run's log or the uploaded Playwright report, and fix it without weakening a test.

## Tests

- `npm test` runs every test: the frontend unit tests (Vitest), the backend tests (pytest) and the end-to-end tests in Chrome (Playwright). It runs all three even if one fails, prints a summary, and exits with 1 if any test failed.
- The unit tests fail if their coverage is under 80% (statements, branches, functions and lines for Vitest; lines and branches together for pytest).
- A test left with `.only` fails the run, because it would skip every other test.
- It uses its own database and ports (8100 and 5273), so it never changes your data and works while `npm run dev` is running.
