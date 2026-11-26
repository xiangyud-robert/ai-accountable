// npm run check: secrets, formatting, lint, types and every test. Every step runs even if an
// earlier one fails, and the exit code is 1 if any failed.
// npm run check:quick (--quick): the same without the end-to-end tests.

import { requireGitleaks, setup } from './setup.mjs'
import { CHECKS, TESTS, runSteps } from './steps.mjs'

const quick = process.argv.includes('--quick')
const tests = quick ? TESTS.filter((test) => !test.endToEnd) : TESTS

requireGitleaks('npm run check')
await setup()
process.exit(await runSteps([...CHECKS, ...tests]))
