// First-run setup shared by dev.mjs and test.mjs. Plain Node with no dependencies,
// because it runs before `npm install` has.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, statSync, utimesSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const isWindows = process.platform === 'win32'

const MIN_NODE = 24

// npm and uv are .cmd files on Windows, so they need a shell there. A shell takes one command
// line, since passing the arguments separately is deprecated (DEP0190). None has a space.
export function commandLine(command, args) {
  return isWindows ? [[command, ...args].join(' '), []] : [command, args]
}

export function start(command, args, options = {}) {
  return spawn(...commandLine(command, args), {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    // On Mac and Linux each child leads its own process group, so stop() can end its children too.
    detached: !isWindows,
    ...options,
  })
}

export function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = start(command, args, { detached: false, ...options })
    child.on('error', (error) => {
      console.error(`Couldn't run ${command}: ${error.message}`)
      resolve(1)
    })
    child.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
}

export function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {
    // Already gone.
  }
}

export function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0])
  if (major < MIN_NODE) {
    fail(
      `Accountable needs Node.js ${MIN_NODE} or later, and this is Node.js ${process.versions.node}.\n` +
        'Install the current LTS from https://nodejs.org, then run the command again.',
    )
  }
}

export function isInstalled(command, versionArgs = ['--version']) {
  const result = spawnSync(...commandLine(command, versionArgs), { cwd: root, shell: isWindows, stdio: 'ignore' })
  return !result.error && result.status === 0
}

// The one tool the first-run setup can't install. `who` names what needs it, for the message.
export function requireGitleaks(who) {
  if (!isInstalled('gitleaks', ['version'])) {
    fail(
      `${who} needs gitleaks, and it was not found.\n` +
        'Install it with `brew install gitleaks` on a Mac, `winget install -e --id Gitleaks.Gitleaks` on Windows, ' +
        'or from https://github.com/gitleaks/gitleaks#installing, then run the command again.',
    )
  }
}

function checkUv() {
  if (!isInstalled('uv')) {
    fail(
      'Accountable needs uv, and it was not found.\n' +
        'Install it from https://docs.astral.sh/uv/getting-started/installation/, ' +
        'then open a new terminal and run the command again.',
    )
  }
}

function needsNpmInstall() {
  const marker = join(root, 'node_modules', '.package-lock.json')
  if (!existsSync(marker)) return true
  return statSync(marker).mtimeMs < statSync(join(root, 'package-lock.json')).mtimeMs
}

export async function setup() {
  checkNode()
  checkUv()

  if (needsNpmInstall()) {
    console.log('Installing packages (first run only). This needs the internet and can take a few minutes.')
    const code = await run('npm', ['install', '--no-audit', '--no-fund'])
    if (code !== 0) fail('Installing the npm packages failed. The command was: npm install')
    // npm leaves the marker alone when nothing changed, so mark this install as up to date.
    const now = new Date()
    utimesSync(join(root, 'node_modules', '.package-lock.json'), now, now)
  }

  if (!existsSync(join(root, '.venv'))) {
    console.log('Installing Python and its packages (first run only).')
  }
  const code = await run('uv', ['sync', '--quiet'])
  if (code !== 0) fail('Installing the Python packages failed. The command was: uv sync')
}
