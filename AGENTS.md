# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/intent.md`: what we're building
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

Update `docs/STATUS.md` when you finish a piece of work

## Tests

- `npm test` runs every test: the frontend unit tests (Vitest), the backend tests (pytest) and the end-to-end tests in Chrome (Playwright). It runs all three even if one fails, prints a summary, and exits with 1 if any test failed.
- Run `npm test` before calling a piece of work done, and fix every failure first. Don't skip, delete or loosen a test to get it passing.
- A test left with `.only` fails the run, because it would skip every other test.
- It uses its own database and ports (8100 and 5273), so it never changes your data and works while `npm run dev` is running.
