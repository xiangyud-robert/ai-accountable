This project will use the following high level technical stack:

1. Node.js 26, the current LTS (24 or later works) / TypeScript for the frontend, using React and Vite, in `frontend/`
2. Python 3.12 for the backend using uv, with FastAPI, in `backend/`, with `pyproject.toml` and `uv.lock` at the repo root

The frontend gets its data from the backend's JSON API. The backend keeps the data in a local SQLite database file, using SQLAlchemy Core with no raw SQL, and fills it with the sample data when the database is new.

Prefer popular, well-supported libraries to custom code, such as for the data tables, the charts and the drag-and-drop pipeline. Don't hand-roll what a mature library does well.

For now it runs locally. Later, Supabase will provide sign-in and the database, and the app will be deployed to Render.

Commands are npm scripts in a `package.json` at the repo root, with `frontend/` as an npm workspace, so they work the same on Mac, Linux and Windows:

- `npm run dev` starts the backend and the frontend together
- `npm test` runs all the tests and fails if any test fails
- `npm run seed` resets the database to the sample data
- `npm run check` runs every check below and all the tests, and fails if any of them fails; `npm run check:quick` is the same without the end-to-end tests
- `npm run format` fixes the formatting

The checks:

1. gitleaks across the git history and the files, allowing only the git-ignored `.env` (gitleaks is installed separately)
2. Prettier and ESLint for the frontend, the end-to-end tests and the scripts, with the recommended rules of typescript-eslint, React Hooks and jsx-a11y
3. ruff format and ruff check for the backend
4. A cyclomatic complexity of at most 15 per function, with ESLint's `complexity` and ruff's C901
5. tsc for the frontend and the end-to-end tests, and ty for the backend
6. At least 80% unit test coverage, for Vitest and pytest

typescript-eslint needs the TypeScript 6 API, which TypeScript 7 no longer has, so the repo root has TypeScript 6 for ESLint, and `frontend/` has TypeScript 7 for tsc.

The hooks:

1. A git pre-commit hook, with lefthook (`lefthook.yml`), which `npm install` sets up. It formats the staged files and stages the result, then runs ESLint and ruff check on them, tsc and ty across the project, and gitleaks over the staged changes. It skips the tests, so committing stays quick.
2. Claude Code hooks in `.claude/settings.json`, with their scripts in `scripts/claude-hooks/`. When Claude finishes a turn, one runs `npm run check:quick` and sends any failure back to it to fix. It blocks only once a turn, and skips the check if no file changed since it last passed. The other blocks any edit to `.env`, and any shell command that names it.
3. A Claude Code hook in the reviewer subagent's file (`.claude/agents/reviewer.md`), with its script in `scripts/claude-hooks/read-only-bash.mjs`. It refuses any shell command the reviewer runs that isn't on a list of commands that only read, such as `git diff`, `git log`, `git show`, `git grep` and `grep`, and any output written to a file other than `/dev/null`. A command it lets through still needs the session's usual permission.
4. CI on GitHub Actions (`.github/workflows/ci.yml`), on every push to any branch. It scans every branch's history with gitleaks first, so a leaked secret fails in a minute, then runs `npm run check` with the Google Chrome on GitHub's Ubuntu runner. If it fails, it uploads the Playwright report.

The Claude Code subagents, in `.claude/agents/`, both on Sonnet:

1. `reviewer` reviews a branch's changes, or a commit, against `docs/REVIEW.md` and reports its findings by severity. It reads files and runs shell commands that only read, and changes nothing.
2. `ui-check` opens the running app with the Playwright MCP server (`.mcp.json`), takes a screenshot of each page in light and dark mode, checks it against the brand skill and the spec, and reports anything off-brand or broken. It has no tools that write files, and its screenshots go in the git-ignored `.playwright-mcp/`.

`docs/STATUS.md` says how to run the app. `README.md` is the course's own guide, so leave it as it is.

Testing will cover:

1. Unit tests for the frontend, using Vitest
2. Unit tests for the backend, using pytest
3. End-to-end tests of the whole app in a browser, in `e2e/`, using Playwright Test (`@playwright/test`) with the installed Google Chrome. They start the app themselves, so `npm test` needs nothing else running.

The tests use a database of their own, so running them never changes your data.
