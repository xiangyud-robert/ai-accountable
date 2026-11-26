// Claude Code's Stop hook (see .claude/settings.json): runs npm run check:quick when Claude
// finishes a turn, and sends any failure back to Claude to fix. It blocks once per turn: when
// Claude stops again, stop_hook_active is set and it lets Claude stop, so it can't loop forever.
// A turn that changed no file since the check last passed skips it.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { commandLine, isWindows, root } from '../setup.mjs'

const CACHE = join(root, 'node_modules', '.cache', 'check-on-stop')
const OUTPUT = join(CACHE, 'output.log')
const PASSED = join(CACHE, 'passed-fingerprint')
const MAX_STEP_OUTPUT = 10_000

function git(...args) {
  const { status, stdout } = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (status !== 0) throw new Error(`git ${args[0]} failed`)
  return stdout
}

// Everything the check reads: the files git doesn't ignore, and every branch for the history scan.
// Null if git can't tell, so the check runs.
function fingerprint() {
  try {
    const hash = createHash('sha256').update(git('for-each-ref', '--format=%(objectname) %(refname)'))
    const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean)
    for (const file of files) {
      const path = join(root, file)
      hash.update(`\0${file}\0`)
      hash.update(statSync(path, { throwIfNoEntry: false })?.isFile() ? readFileSync(path) : '\0deleted')
    }
    return hash.digest('hex')
  } catch {
    return null
  }
}

function readPassed() {
  try {
    return readFileSync(PASSED, 'utf8')
  } catch {
    return null
  }
}

// Runs the check with its output and errors interleaved in one file, as they'd show in a terminal.
function runCheck() {
  mkdirSync(CACHE, { recursive: true })
  const output = openSync(OUTPUT, 'w')
  const result = spawnSync(...commandLine('npm', ['run', '--silent', 'check:quick']), {
    cwd: root,
    shell: isWindows,
    stdio: ['ignore', output, output],
  })
  closeSync(output)
  const log = stripVTControlCharacters(readFileSync(OUTPUT, 'utf8'))
  return { passed: result.status === 0, log: result.error ? `${log}\n${result.error.message}` : log }
}

function lastChars(text, max) {
  return text.length > max ? `(earlier output cut)\n${text.slice(-max)}` : text
}

// check.mjs prints each step's output under "=== name ===", then a summary marking each step
// passed or FAILED. This keeps the failed steps and the summary.
function failedSteps(log) {
  const summaryAt = log.lastIndexOf('\nSummary\n')
  if (summaryAt === -1) return lastChars(log.trim(), MAX_STEP_OUTPUT)
  const summary = log.slice(summaryAt).trim()
  const failed = new Set([...summary.matchAll(/^ {2}FAILED {2}(.+) \([\d.]+s\)$/gm)].map(([, name]) => name))
  const parts = log.slice(0, summaryAt).split(/^=== (.+) ===$/m)
  const steps = []
  for (let i = 1; i < parts.length; i += 2) {
    if (failed.has(parts[i])) steps.push(`=== ${parts[i]} ===\n${lastChars(parts[i + 1].trim(), MAX_STEP_OUTPUT)}`)
  }
  return [...steps, summary].join('\n\n')
}

const { stop_hook_active: alreadyBlocked } = JSON.parse(readFileSync(0, 'utf8'))
if (alreadyBlocked) process.exit(0)

const before = fingerprint()
if (before && before === readPassed()) process.exit(0)

const { passed, log } = runCheck()
if (passed) {
  if (before) writeFileSync(PASSED, before)
  process.exit(0)
}

const reason =
  'npm run check:quick failed when you finished your turn. Fix what it found without weakening any rule ' +
  "(see Checks in AGENTS.md), then run npm run check:quick again to confirm. This hook won't stop you a second " +
  "time this turn, so if something can't be fixed, tell the person why.\n" +
  `The full output is in ${relative(root, OUTPUT)}. The failed steps:\n\n${failedSteps(log)}`
console.log(JSON.stringify({ decision: 'block', reason }))
