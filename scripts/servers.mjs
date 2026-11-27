// Running the app's servers, shared by dev.mjs and start.mjs: checking their ports are free,
// waiting until they answer, and stopping them together.

import { createServer } from 'node:net'
import { fail, stop } from './setup.mjs'

const STARTUP_SECONDS = 120

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

// `ports` pairs each port with what needs it, and `command` is what to run again, for the message.
export async function requireFreePorts(ports, command) {
  for (const [port, what] of ports) {
    if (!(await portIsFree(port))) {
      fail(
        `Port ${port} is already in use, and Accountable needs it for ${what}.\n` +
          `Close the other program using it (or another copy of Accountable), then run ${command} again.`,
      )
    }
  }
}

// Any answer counts, whatever its status, since the API answers 401 to anyone signed out.
// uvicorn answers only once the app has started, so the migrations have run by then.
async function waitUntilAnswering(url, child) {
  const deadline = Date.now() + STARTUP_SECONDS * 1000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false
    try {
      await fetch(url)
      return true
    } catch {
      // Not answering yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

// Each server is { name, child, url }. They run until Ctrl+C, closing the terminal, or one of
// them stopping by itself, which stops the rest. Once every one answers, it says what to open.
export async function runUntilStopped(servers, address) {
  let stopping = false
  function stopAll(code) {
    if (stopping) return
    stopping = true
    servers.forEach(({ child }) => stop(child))
    process.exit(code)
  }

  for (const { name, child } of servers) {
    child.on('exit', () => {
      if (stopping) return
      console.error(`\nThe ${name} stopped unexpectedly, so Accountable has stopped too.`)
      stopAll(1)
    })
  }
  process.on('SIGINT', () => stopAll(0))
  process.on('SIGTERM', () => stopAll(0))
  // Closing the terminal sends SIGHUP. The children lead their own process groups on Mac and
  // Linux, so they don't get it, and would keep the ports if they weren't stopped here.
  process.on('SIGHUP', () => stopAll(0))

  const ready = await Promise.all(servers.map(({ child, url }) => waitUntilAnswering(url, child)))

  if (ready.every(Boolean)) {
    console.log(`\nAccountable is running at ${address}. Open it in Google Chrome.`)
    console.log('Press Ctrl+C to stop it.\n')
  } else if (!stopping) {
    console.error(`\nAccountable didn't start within ${STARTUP_SECONDS} seconds. The messages above may say why.`)
    stopAll(1)
  }
}
