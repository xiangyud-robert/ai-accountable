// npm test: set up on the first run, then run all three test suites, one after another.
// Every suite runs even if an earlier one fails, and the exit code is 1 if any failed.
// The unit test suites also fail if their coverage is under 80%.

import { setup } from './setup.mjs'
import { TESTS, runSteps } from './steps.mjs'

await setup()
process.exit(await runSteps(TESTS))
