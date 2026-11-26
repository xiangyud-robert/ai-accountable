// The pre-commit hook's secret scan: gitleaks over the staged changes. It uses .gitleaks.toml,
// which has no exceptions, so a staged .env fails it too.

import { requireGitleaks, run } from './setup.mjs'

requireGitleaks('The pre-commit hook')
process.exit(await run('gitleaks', ['git', '--pre-commit', '--staged', '--redact', '--verbose', '--no-banner', '.']))
