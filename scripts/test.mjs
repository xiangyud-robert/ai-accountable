// npm test: set up on the first run, then run all three test suites, one after another.
// Every suite runs even if an earlier one fails, and the exit code is 1 if any failed.

import { run, setup } from './setup.mjs'

const SUITES = [
  ['Frontend unit tests (Vitest)', 'npm', ['test', '--workspace', 'frontend']],
  ['Backend tests (pytest)', 'uv', ['run', 'pytest']],
  ['End-to-end tests (Playwright)', 'npx', ['playwright', 'test', '--config', 'e2e/playwright.config.ts']],
]

await setup()

const results = []
for (const [name, command, args] of SUITES) {
  console.log(`\n=== ${name} ===\n`)
  results.push([name, await run(command, args)])
}

console.log('\nSummary')
for (const [name, code] of results) {
  console.log(`  ${code === 0 ? 'passed' : 'FAILED'}  ${name}`)
}
process.exit(results.some(([, code]) => code !== 0) ? 1 : 0)
