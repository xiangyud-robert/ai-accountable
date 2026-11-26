// npm run check: secrets, formatting, lint, types and every test. Every step runs even if an
// earlier one fails, and the exit code is 1 if any failed.
// npm run check:quick (--quick): the same without the end-to-end tests.

import { fail, isInstalled, setup } from './setup.mjs'
import { CHECKS, TESTS, runSteps } from './steps.mjs'

const quick = process.argv.includes('--quick')
const tests = quick ? TESTS.filter((test) => !test.endToEnd) : TESTS

// The one tool the first-run setup can't install.
if (!isInstalled('gitleaks', ['version'])) {
  fail(
    'npm run check needs gitleaks, and it was not found.\n' +
      'Install it with `brew install gitleaks` on a Mac, `winget install -e --id Gitleaks.Gitleaks` on Windows, ' +
      'or from https://github.com/gitleaks/gitleaks#installing, then run the command again.',
  )
}

await setup()
process.exit(await runSteps([...CHECKS, ...tests]))
