// npm run format: rewrites the frontend's files with Prettier and the backend's with ruff format.

import { setup } from './setup.mjs'
import { FORMATTERS, runSteps } from './steps.mjs'

await setup()
process.exit(await runSteps(FORMATTERS))
