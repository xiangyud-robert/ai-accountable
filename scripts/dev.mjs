// npm run dev: set up on the first run, then start the backend and frontend together.

import { createServer } from 'node:net'
import { setup, start, stop } from './setup.mjs'

const API_PORT = 8000
const WEB_PORT = 5173
const STARTUP_SECONDS = 120

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

async function waitFor(url, child) {
  const deadline = Date.now() + STARTUP_SECONDS * 1000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // Not answering yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

await setup()

for (const [port, what] of [
  [API_PORT, 'the backend'],
  [WEB_PORT, 'the frontend'],
]) {
  if (!(await portIsFree(port))) {
    console.error(
      `\nPort ${port} is already in use, and Accountable needs it for ${what}.\n` +
        'Close the other program using it (or another copy of Accountable), then run npm run dev again.\n',
    )
    process.exit(1)
  }
}

console.log('Starting Accountable...')

const children = {
  backend: start('uv', [
    'run',
    'uvicorn',
    'backend.main:app',
    '--host',
    '127.0.0.1',
    '--port',
    String(API_PORT),
    '--log-level',
    'warning',
  ]),
  frontend: start('npm', ['run', 'dev', '--workspace', 'frontend', '--', '--logLevel', 'warn']),
}

let stopping = false
function stopAll(code) {
  if (stopping) return
  stopping = true
  Object.values(children).forEach(stop)
  process.exit(code)
}

for (const [name, child] of Object.entries(children)) {
  child.on('exit', () => {
    if (stopping) return
    console.error(`\nThe ${name} stopped unexpectedly, so Accountable has stopped too.`)
    stopAll(1)
  })
}
process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

const ready = await Promise.all([
  waitFor(`http://127.0.0.1:${API_PORT}/api/stages`, children.backend),
  waitFor(`http://127.0.0.1:${WEB_PORT}/`, children.frontend),
])

if (ready.every(Boolean)) {
  console.log(`\nAccountable is running at http://localhost:${WEB_PORT}. Open it in Google Chrome.`)
  console.log('Press Ctrl+C to stop it.\n')
} else if (!stopping) {
  console.error(`\nAccountable didn't start within ${STARTUP_SECONDS} seconds. The messages above may say why.`)
  stopAll(1)
}
