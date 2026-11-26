// The steps behind npm test, npm run check and npm run format, and running them with a summary.

import { run } from './setup.mjs'

// Prettier and ESLint cover the frontend, the end-to-end tests and these scripts.
export const NODE_PATHS = ['frontend', 'e2e', 'scripts', 'eslint.config.js']
export const BACKEND_PATHS = ['backend']

export const TESTS = [
  { name: 'Vitest: frontend unit tests, 80% coverage', command: 'npm', args: ['test', '--workspace', 'frontend'] },
  {
    name: 'pytest: backend tests, 80% coverage',
    command: 'uv',
    args: ['run', 'pytest', '--cov', '--cov-report=term:skip-covered'],
  },
  {
    name: 'Playwright: end-to-end tests',
    command: 'npx',
    args: ['playwright', 'test', '--config', 'e2e/playwright.config.ts'],
    endToEnd: true,
  },
]

export const CHECKS = [
  // The history scan uses .gitleaks.toml, which gitleaks reads by itself. Only the files scan
  // allows the git-ignored .env.
  { name: 'gitleaks: git history', command: 'gitleaks', args: ['git', '.', '--redact', '--verbose', '--no-banner'] },
  {
    name: 'gitleaks: files',
    command: 'gitleaks',
    args: ['dir', '.', '--config', '.gitleaks-files.toml', '--redact', '--verbose', '--no-banner'],
  },
  { name: 'Prettier: frontend, e2e and scripts', command: 'npx', args: ['prettier', '--check', ...NODE_PATHS] },
  { name: 'ruff format: backend', command: 'uv', args: ['run', 'ruff', 'format', '--check', ...BACKEND_PATHS] },
  { name: 'ESLint: frontend, e2e and scripts', command: 'npx', args: ['eslint', '--max-warnings', '0', ...NODE_PATHS] },
  { name: 'ruff check: backend', command: 'uv', args: ['run', 'ruff', 'check', ...BACKEND_PATHS] },
  { name: 'tsc: frontend and e2e', command: 'npm', args: ['run', 'typecheck', '--workspace', 'frontend'] },
  { name: 'ty: backend', command: 'uv', args: ['run', 'ty', 'check', ...BACKEND_PATHS] },
]

export const FORMATTERS = [
  { name: 'Prettier: frontend, e2e and scripts', command: 'npx', args: ['prettier', '--write', ...NODE_PATHS] },
  { name: 'ruff format: backend', command: 'uv', args: ['run', 'ruff', 'format', ...BACKEND_PATHS] },
]

// Runs every step even if an earlier one fails, and returns 1 if any failed.
export async function runSteps(steps) {
  const results = []
  for (const { name, command, args } of steps) {
    console.log(`\n=== ${name} ===\n`)
    const started = performance.now()
    const code = await run(command, args)
    results.push({ name, passed: code === 0, seconds: (performance.now() - started) / 1000 })
  }

  console.log('\nSummary')
  for (const { name, passed, seconds } of results) {
    console.log(`  ${passed ? 'passed' : 'FAILED'}  ${name} (${seconds.toFixed(1)}s)`)
  }
  return results.every(({ passed }) => passed) ? 0 : 1
}
